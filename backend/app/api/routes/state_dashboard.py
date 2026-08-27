from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from datetime import datetime, timedelta
from loguru import logger
import statistics

from app.core.security import get_current_admin
from app.core.database import get_collection
from app.services.alert_service import format_alert_response
from app.api.routes.complaints import format_complaint_response

router = APIRouter(prefix="/api/state", tags=["State Dashboard"])

# SLA Thresholds
SOS_SLA_MINUTES = 15
COMPLAINT_SLA_HOURS = 48

def is_state_admin(admin: dict):
    if admin.get("role") not in ["super_admin", "admin"]:
        raise HTTPException(status_code=403, detail="State Command Center access restricted to State Admins")

@router.get("/performance")
async def get_state_performance(current_admin: dict = Depends(get_current_admin)):
    """Get statewide performance metrics including average response times and SLA compliance."""
    is_state_admin(current_admin)
    
    alerts_col = get_collection("alerts")
    complaints_col = get_collection("complaints")
    
    if alerts_col is None or complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)
    
    # 1. SOS Performance
    # Consider only resolved or false_alarm alerts for response time calculation
    resolved_alerts_cursor = alerts_col.find({
        "status": {"$in": ["resolved", "false_alarm"]},
        "created_at": {"$gte": thirty_days_ago}
    })
    resolved_alerts = await resolved_alerts_cursor.to_list(length=1000)
    
    sos_response_times = []
    sos_sla_met = 0
    
    for alert in resolved_alerts:
        created = alert.get("created_at")
        updated = alert.get("updated_at")
        if created and updated:
            diff_mins = (updated - created).total_seconds() / 60
            sos_response_times.append(diff_mins)
            if diff_mins <= SOS_SLA_MINUTES:
                sos_sla_met += 1
                
    avg_sos_response_time = round(statistics.mean(sos_response_times), 1) if sos_response_times else 0
    sos_sla_compliance = round((sos_sla_met / len(sos_response_times)) * 100, 1) if sos_response_times else 100
    
    # 2. Complaint Performance
    resolved_complaints_cursor = complaints_col.find({
        "status": "resolved",
        "created_at": {"$gte": thirty_days_ago}
    })
    resolved_complaints = await resolved_complaints_cursor.to_list(length=1000)
    
    complaint_response_times = []
    complaint_sla_met = 0
    
    for complaint in resolved_complaints:
        created = complaint.get("created_at")
        updated = complaint.get("updated_at")
        if created and updated:
            diff_hours = (updated - created).total_seconds() / 3600
            complaint_response_times.append(diff_hours)
            if diff_hours <= COMPLAINT_SLA_HOURS:
                complaint_sla_met += 1
                
    avg_complaint_response_time = round(statistics.mean(complaint_response_times), 1) if complaint_response_times else 0
    complaint_sla_compliance = round((complaint_sla_met / len(complaint_response_times)) * 100, 1) if complaint_response_times else 100
    
    # Overall SLA
    total_cases = len(sos_response_times) + len(complaint_response_times)
    total_met = sos_sla_met + complaint_sla_met
    overall_sla = round((total_met / total_cases) * 100, 1) if total_cases > 0 else 100

    return {
        "sos": {
            "avg_response_time_mins": avg_sos_response_time,
            "sla_compliance_pct": sos_sla_compliance,
            "total_resolved": len(sos_response_times)
        },
        "complaints": {
            "avg_response_time_hours": avg_complaint_response_time,
            "sla_compliance_pct": complaint_sla_compliance,
            "total_resolved": len(complaint_response_times)
        },
        "overall_sla_compliance_pct": overall_sla
    }

@router.get("/rankings")
async def get_admin_rankings(current_admin: dict = Depends(get_current_admin)):
    """Get performance rankings for District and Division Admins."""
    is_state_admin(current_admin)
    
    users_col = get_collection("users")
    alerts_col = get_collection("alerts")
    complaints_col = get_collection("complaints")
    
    if users_col is None or alerts_col is None or complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    
    # Get all sub-admins
    admins_cursor = users_col.find({"role": {"$in": ["district_admin", "regional_admin"]}})
    admins = await admins_cursor.to_list(length=100)
    
    rankings = []
    
    for admin in admins:
        admin_filter = {}
        if admin["role"] == "district_admin" and admin.get("district"):
            admin_filter = {"location.district": admin["district"]}
            comp_filter = {"district": admin["district"]}
        elif admin["role"] == "regional_admin" and admin.get("division"):
            admin_filter = {"location.division": admin["division"]}
            comp_filter = {"division": admin["division"]}
        else:
            continue
            
        # Resolved SOS count
        sos_count = await alerts_col.count_documents({
            "status": {"$in": ["resolved", "false_alarm"]},
            "created_at": {"$gte": thirty_days_ago},
            **admin_filter
        })
        
        # Resolved Complaints count
        comp_count = await complaints_col.count_documents({
            "status": "resolved",
            "created_at": {"$gte": thirty_days_ago},
            **comp_filter
        })
        
        # Total active issues (pending load)
        active_sos = await alerts_col.count_documents({
            "status": "active",
            **admin_filter
        })
        
        active_comp = await complaints_col.count_documents({
            "status": {"$in": ["pending", "investigating"]},
            **comp_filter
        })
        
        score = (sos_count * 2) + comp_count # Simple scoring algorithm
        
        rankings.append({
            "admin_id": admin.get("admin_id"),
            "name": admin.get("name"),
            "role": admin.get("role"),
            "region": admin.get("district") or admin.get("division"),
            "resolved_sos": sos_count,
            "resolved_complaints": comp_count,
            "pending_load": active_sos + active_comp,
            "score": score
        })
        
    # Sort by score descending
    rankings.sort(key=lambda x: x["score"], reverse=True)
    return rankings

@router.get("/escalations")
async def get_escalations(current_admin: dict = Depends(get_current_admin)):
    """Get active alerts and pending complaints that have breached SLA thresholds."""
    is_state_admin(current_admin)
    
    alerts_col = get_collection("alerts")
    complaints_col = get_collection("complaints")
    
    now = datetime.utcnow()
    
    # SOS Escalations (> 15 mins)
    sos_sla_time = now - timedelta(minutes=SOS_SLA_MINUTES)
    sos_cursor = alerts_col.find({
        "status": "active",
        "created_at": {"$lt": sos_sla_time}
    }).sort("created_at", 1)
    escalated_sos = await sos_cursor.to_list(length=50)
    
    # Complaint Escalations (> 48 hours)
    comp_sla_time = now - timedelta(hours=COMPLAINT_SLA_HOURS)
    comp_cursor = complaints_col.find({
        "status": {"$in": ["pending", "investigating"]},
        "created_at": {"$lt": comp_sla_time}
    }).sort("created_at", 1)
    escalated_comp = await comp_cursor.to_list(length=50)
    
    formatted_sos = [await format_alert_response(a) for a in escalated_sos]
    formatted_comp = [format_complaint_response(c) for c in escalated_comp]
    
    return {
        "breached_sos_count": len(formatted_sos),
        "breached_complaints_count": len(formatted_comp),
        "sos_escalations": formatted_sos,
        "complaint_escalations": formatted_comp,
        "total_escalations": len(formatted_sos) + len(formatted_comp)
    }
