from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from app.core.security import get_current_admin, verify_password, create_access_token, log_admin_action, get_password_hash
from app.core.database import get_collection
from app.services.alert_service import get_active_alerts, format_alert_response
from app.services.user_service import get_all_users, format_user_response
from app.models.user import AdminUserUpdate, AdminCreate
import uuid
import secrets
import string
from app.websockets.socket_manager import get_connected_count
from datetime import datetime, timedelta
from loguru import logger

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])

def get_alert_filter(admin: dict) -> dict:
    role = admin.get("role")
    if role in ["super_admin", "admin"]:
        return {}
    elif role == "regional_admin":
        return {"location.division": admin.get("division")}
    elif role == "district_admin":
        return {"location.district": admin.get("district")}
    return {"_id": "unauthorized"}

def get_user_filter(admin: dict) -> dict:
    role = admin.get("role")
    if role in ["super_admin", "admin"]:
        return {}
    elif role == "regional_admin":
        return {"division": admin.get("division")}
    elif role == "district_admin":
        return {"district": admin.get("district")}
    return {"_id": "unauthorized"}

class AdminLoginRequest(BaseModel):
    identifier: str
    password: str

@router.post("/login")
async def admin_login(credentials: AdminLoginRequest):
    """Admin login with email or admin_id and password bypassing 2FA."""
    users_col = get_collection("users")
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    user = await users_col.find_one({
        "$or": [{"email": credentials.identifier}, {"admin_id": credentials.identifier}]
    })
    if not user or user.get("role") not in ["admin", "super_admin", "regional_admin", "district_admin"]:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    if not verify_password(credentials.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Admin account is deactivated")
        
    token = create_access_token({"sub": user["_id"], "email": user["email"], "role": "admin"})
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": format_user_response(user)
    }


@router.get("/stats")
async def get_dashboard_stats(current_admin: dict = Depends(get_current_admin)):
    """Get real-time dashboard statistics."""
    try:
        alerts_col = get_collection("alerts")
        users_col = get_collection("users")
        predictions_col = get_collection("ai_predictions")

        alert_filter = get_alert_filter(current_admin)
        user_filter = get_user_filter(current_admin)

        total_users = await users_col.count_documents(user_filter) if users_col is not None else 0
        
        active_filter = {"status": "active", **alert_filter}
        active_alerts = await alerts_col.count_documents(active_filter) if alerts_col is not None else 0
        
        total_alerts_today = 0
        critical_alerts = 0

        if alerts_col is not None:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            today_filter = {"created_at": {"$gte": today_start}, **alert_filter}
            total_alerts_today = await alerts_col.count_documents(today_filter)
            
            crit_filter = {"severity": "critical", "status": "active", **alert_filter}
            critical_alerts = await alerts_col.count_documents(crit_filter)

        total_predictions = await predictions_col.count_documents({}) if predictions_col is not None else 0
        socket_stats = get_connected_count()

        return {
            "total_users": total_users,
            "active_alerts": active_alerts,
            "total_alerts_today": total_alerts_today,
            "critical_alerts": critical_alerts,
            "total_ai_predictions": total_predictions,
            "connected_users": socket_stats["total_users"],
            "live_tracking_users": socket_stats["live_tracking"],
            "timestamp": datetime.utcnow().isoformat(),
        }
    except Exception as e:
        logger.error(f"Error in get_dashboard_stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/live-users")
async def get_live_users(_: dict = Depends(get_current_admin)):
    """Get all users currently connected to the websocket."""
    from app.websockets.socket_manager import live_locations
    
    live_data = []
    for user_id, loc in live_locations.items():
        live_data.append({
            "user_id": user_id,
            "latitude": loc.get("latitude"),
            "longitude": loc.get("longitude"),
            "timestamp": loc.get("timestamp"),
            "user_name": loc.get("user_name", "Active User")
        })
    
    return {"live_users": live_data, "count": len(live_data)}

@router.get("/alerts/active")
async def get_active_alerts(current_admin: dict = Depends(get_current_admin)):
    """Get all currently active SOS alerts."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        return []
        
    query = {"status": "active", **get_alert_filter(current_admin)}
    cursor = alerts_col.find(query).sort("created_at", -1)
    alerts = await cursor.to_list(length=100)
    
    return [await format_alert_response(a) for a in alerts]


@router.get("/alerts/recent")
async def get_recent_alerts(limit: int = 50, current_admin: dict = Depends(get_current_admin)):
    """Get recent SOS alerts history."""
    try:
        alerts_col = get_collection("alerts")
        if alerts_col is None:
            return []
            
        query = get_alert_filter(current_admin)
        cursor = alerts_col.find(query).sort("created_at", -1).limit(limit)
        alerts = await cursor.to_list(length=limit)
        
        # Must await each alert formatting call
        return [await format_alert_response(a) for a in alerts]
    except Exception as e:
        logger.error(f"Error in get_recent_alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users")
async def list_users(
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin)
):
    """List all registered users."""
    users_col = get_collection("users")
    if users_col is None:
        return []
    query = get_user_filter(current_admin)
    cursor = users_col.find(query).sort("created_at", -1).skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    return [
        {
            "id": u.get("_id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "role": u.get("role", "user"),
            "is_active": u.get("is_active", True),
            "division": u.get("division"),
            "district": u.get("district"),
            "created_at": u.get("created_at"),
        }
        for u in users
    ]


@router.put("/users/{user_id}")
async def update_user(
    user_id: str,
    update_data: AdminUserUpdate,
    _: dict = Depends(get_current_admin)
):
    """Update a user's details (admin only)."""
    users_col = get_collection("users")
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if not update_dict:
        return {"success": True, "message": "No fields to update"}
        
    update_dict["updated_at"] = datetime.utcnow()

    result = await users_col.update_one(
        {"_id": user_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"ADMIN ACTION | Updated user {user_id}")
    return {"success": True, "message": f"User {user_id} updated"}


@router.get("/alerts/heatmap")
async def get_alerts_heatmap(current_admin: dict = Depends(get_current_admin)):
    """Get alert locations for risk heatmap visualization."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        return []

    since = datetime.utcnow() - timedelta(days=30)
    query = {"created_at": {"$gte": since}, **get_alert_filter(current_admin)}
    cursor = alerts_col.find(
        query,
        {"location": 1, "severity": 1, "created_at": 1}
    ).limit(500)
    alerts = await cursor.to_list(length=500)

    return [
        {
            "lat": a["location"]["latitude"],
            "lng": a["location"]["longitude"],
            "severity": a.get("severity", "medium"),
            "timestamp": a["created_at"].isoformat(),
        }
        for a in alerts if "location" in a
    ]


@router.get("/analytics/danger-trends")
async def get_danger_trends(current_admin: dict = Depends(get_current_admin)):
    """Get AI danger prediction and SOS alert trends for last 7 days."""
    predictions_col = get_collection("ai_predictions")
    alerts_col = get_collection("alerts")
    
    since = datetime.utcnow() - timedelta(days=7)
    
    # Fetch AI predictions
    predictions = []
    if predictions_col is not None:
        cursor = predictions_col.find(
            {"created_at": {"$gte": since}},
            {"danger_level": 1, "created_at": 1}
        )
        predictions = await cursor.to_list(length=1000)
        
    # Fetch SOS alerts
    alerts = []
    if alerts_col is not None:
        query = {"created_at": {"$gte": since}, **get_alert_filter(current_admin)}
        cursor = alerts_col.find(
            query,
            {"severity": 1, "created_at": 1}
        )
        alerts = await cursor.to_list(length=1000)

    # Initialize with last 7 days to ensure a continuous graph
    trends = {
        (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d"): {"high": 0, "medium": 0, "low": 0}
        for i in range(7)
    }
    
    # Process AI predictions
    for p in predictions:
        day = p["created_at"].strftime("%Y-%m-%d")
        level = str(p.get("danger_level", "unknown")).lower()
        
        if level in ["high", "critical"]:
            norm_level = "high"
        elif level == "medium":
            norm_level = "medium"
        else:
            norm_level = "low"
            
        if day in trends:
            trends[day][norm_level] += 1
            
    # Process SOS alerts
    for a in alerts:
        day = a["created_at"].strftime("%Y-%m-%d")
        level = str(a.get("severity", "unknown")).lower()
        
        if level in ["high", "critical"]:
            norm_level = "high"
        elif level == "medium":
            norm_level = "medium"
        else:
            norm_level = "low"
            
        if day in trends:
            trends[day][norm_level] += 1

    return [
        {"date": date, "levels": levels}
        for date, levels in sorted(trends.items())
    ]


@router.get("/analytics/predictive-intel")
async def get_predictive_intel(current_admin: dict = Depends(get_current_admin)):
    """Get dynamic tactical risk report and predictive intel."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    # Find recent alerts to establish a hotspot
    since = datetime.utcnow() - timedelta(hours=48)
    query = {"created_at": {"$gte": since}, **get_alert_filter(current_admin)}
    cursor = alerts_col.find(query).sort("created_at", -1).limit(20)
    alerts = await cursor.to_list(length=20)
    
    target_zone = "Unknown Sector"
    lat, lng = 0.0, 0.0
    historical_count = len(alerts)
    
    if alerts:
        # Pick the most recent alert with a location
        for a in alerts:
            if "location" in a and "latitude" in a["location"]:
                lat = a["location"]["latitude"]
                lng = a["location"]["longitude"]
                district = a["location"].get("district")
                division = a["location"].get("division")
                if district:
                    target_zone = f"{district} District"
                elif division:
                    target_zone = f"{division} Division"
                else:
                    target_zone = "Central Urban District"
                break
    
    # If no recent alerts, default to a generic area or the admin's region
    if lat == 0.0:
        target_zone = current_admin.get("district", current_admin.get("division", "Statewide Sector"))
        if not target_zone:
            target_zone = "Statewide Sector"
            
    # Time of day string
    now_hour = datetime.utcnow().hour
    time_of_day = "Night" if now_hour < 6 or now_hour > 18 else "Daytime"
    
    # Call the LLM to predict risk
    from app.ai.llm_engine import predict_area_risk
    prediction = await predict_area_risk(lat, lng, time_of_day)
    
    # Map the LLM output to the dashboard format
    confidence = prediction.get("confidence", 0.85)
    risk_level = prediction.get("threat_level", "MEDIUM").upper()
    
    hotspot_reason = prediction.get("hotspot_reason", "Historical Pattern: Minor spike in distress signals.")
    factors = [hotspot_reason]
        
    recommended_actions = prediction.get("recommended_actions", ["Increase smart patrol dispatch."])
    
    # Construct mitigation guidelines
    mitigation_guidelines = [
        f"A. Smart Patrol Dispatch: Redirect active responders to {target_zone} for visual sweeps.",
        f"B. Ad-hoc Routing Warning: Push SafeRoute warnings to users near {target_zone}."
    ]
    for idx, action in enumerate(recommended_actions):
        mitigation_guidelines.append(f"C{idx+1}. Action: {action}")
    
    prediction_text = f"Predicted {risk_level.lower()} likelihood of incidents in {target_zone} due to {hotspot_reason.lower()}."
    
    return {
        "target_zone": target_zone,
        "prediction_text": prediction_text,
        "confidence_score": round(confidence * 100, 1),
        "historical_incidents_count": historical_count,
        "threat_breakdown": factors,
        "mitigation_guidelines": mitigation_guidelines,
        "risk_level": risk_level
    }


@router.delete("/alerts/{alert_id}")
async def delete_alert(alert_id: str, _: dict = Depends(get_current_admin)):
    """Permanently delete an SOS alert from the database (admin only)."""
    try:
        alerts_col = get_collection("alerts")
        if alerts_col is None:
            raise HTTPException(status_code=503, detail="Database unavailable")
            
        result = await alerts_col.delete_one({"_id": alert_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Alert not found")
            
        logger.warning(f"ADMIN ACTION | Permanent deletion of alert ID: {alert_id}")
        return {"success": True, "message": f"Alert {alert_id} permanently deleted"}
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error deleting alert {alert_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
async def change_admin_password(payload: ChangePasswordRequest, current_admin: dict = Depends(get_current_admin)):
    """Allow admin to change their password (enforces first login change)."""
    users_col = get_collection("users")
    if users_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    
    if not verify_password(payload.old_password, current_admin["hashed_password"]):
        raise HTTPException(status_code=400, detail="Incorrect old password")
        
    new_hashed = get_password_hash(payload.new_password)
    await users_col.update_one(
        {"_id": current_admin["_id"]},
        {"$set": {"hashed_password": new_hashed, "requires_password_change": False, "updated_at": datetime.utcnow()}}
    )
    
    await log_admin_action(current_admin["_id"], current_admin.get("email", ""), "change_password", current_admin["_id"])
    return {"success": True, "message": "Password updated successfully"}

@router.post("/management/create")
async def create_sub_admin(data: AdminCreate, current_admin: dict = Depends(get_current_admin)):
    """State admin creates a new sub-admin (Division or District)."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only State Admins can create new admins")
        
    users_col = get_collection("users")
    existing = await users_col.find_one({"$or": [{"email": data.email}, {"phone": data.phone}]})
    if existing:
        raise HTTPException(status_code=400, detail="Email or phone already registered")
        
    # Use manually provided admin ID and password
    admin_id = data.admin_id
    temp_password = data.password
    
    now = datetime.utcnow()
    user_doc = {
        "_id": str(uuid.uuid4()),
        "admin_id": admin_id,
        "name": data.name,
        "phone": data.phone,
        "email": data.email,
        "hashed_password": get_password_hash(temp_password),
        "role": data.role.value if hasattr(data.role, 'value') else data.role,
        "is_active": True,
        "requires_password_change": True,
        "division": data.division,
        "district": data.district,
        "created_at": now,
        "updated_at": now,
    }
    
    await users_col.insert_one(user_doc)
    await log_admin_action(current_admin["_id"], current_admin.get("email", ""), "create_admin", user_doc["_id"], f"Created {data.role} with ID {admin_id}")
    
    return {
        "success": True,
        "admin_id": admin_id,
        "temp_password": temp_password,
        "user": format_user_response(user_doc)
    }

@router.get("/management/list")
async def list_sub_admins(current_admin: dict = Depends(get_current_admin)):
    """List all sub-admins."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only State Admins can view this list")
        
    users_col = get_collection("users")
    cursor = users_col.find({"role": {"$in": ["regional_admin", "district_admin", "admin"]}}).sort("created_at", -1)
    admins = await cursor.to_list(length=1000)
    return [format_user_response(a) for a in admins]

@router.put("/management/{target_id}/status")
async def change_admin_status(target_id: str, active: bool, current_admin: dict = Depends(get_current_admin)):
    """Activate or deactivate a sub-admin."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    users_col = get_collection("users")
    result = await users_col.update_one({"_id": target_id}, {"$set": {"is_active": active, "updated_at": datetime.utcnow()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    await log_admin_action(current_admin["_id"], current_admin.get("email", ""), "change_status", target_id, f"Set active={active}")
    return {"success": True, "message": f"Admin status updated to {'active' if active else 'inactive'}"}

class ResetPasswordRequest(BaseModel):
    new_password: str

@router.put("/management/{target_id}/reset-password")
async def reset_admin_password(target_id: str, payload: ResetPasswordRequest, current_admin: dict = Depends(get_current_admin)):
    """Reset password for a sub-admin manually."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    users_col = get_collection("users")
    target = await users_col.find_one({"_id": target_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
        
    await users_col.update_one(
        {"_id": target_id},
        {"$set": {"hashed_password": get_password_hash(payload.new_password), "requires_password_change": True, "updated_at": datetime.utcnow()}}
    )
    
    await log_admin_action(current_admin["_id"], current_admin.get("email", ""), "reset_password", target_id)
    
    return {"success": True, "message": "Password reset successfully"}

@router.get("/management/logs")
async def get_admin_logs(limit: int = 100, current_admin: dict = Depends(get_current_admin)):
    """Fetch admin activity logs."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    logs_col = get_collection("admin_logs")
    if logs_col is None:
        return []
        
    cursor = logs_col.find({}).sort("created_at", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    return [
        {
            "id": l["_id"],
            "admin_id": l.get("admin_id"),
            "admin_email": l.get("admin_email"),
            "action": l.get("action"),
            "target_id": l.get("target_id"),
            "details": l.get("details"),
            "created_at": l.get("created_at")
        } for l in logs
    ]

@router.delete("/management/{target_id}")
async def delete_sub_admin(target_id: str, current_admin: dict = Depends(get_current_admin)):
    """Delete a sub-admin."""
    if current_admin.get("role") not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if current_admin["_id"] == target_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
        
    users_col = get_collection("users")
    result = await users_col.delete_one({"_id": target_id, "role": {"$in": ["regional_admin", "district_admin", "admin"]}})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found or cannot be deleted")
        
    await log_admin_action(current_admin["_id"], current_admin.get("email", ""), "delete_admin", target_id)
    return {"success": True, "message": "Admin deleted successfully"}

@router.get("/alerts/{alert_id}/intelligence")
async def get_alert_intelligence(alert_id: str, current_admin: dict = Depends(get_current_admin)):
    """Comprehensive incident intelligence report for an SOS alert."""
    alerts_col = get_collection("alerts")
    users_col = get_collection("users")
    contacts_col = get_collection("emergency_contacts")
    history_col = get_collection("location_history")
    complaints_col = get_collection("complaints")

    if any(col is None for col in [alerts_col, users_col, contacts_col, history_col, complaints_col]):
        raise HTTPException(status_code=503, detail="Database unavailable")

    alert = await alerts_col.find_one({"_id": alert_id})
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    user_id = alert["user_id"]
    user = await users_col.find_one({"_id": user_id}) or {}
    
    contacts_cursor = contacts_col.find({"user_id": user_id})
    contacts = await contacts_cursor.to_list(length=20)
    
    history_cursor = history_col.find({"user_id": user_id}).sort("timestamp", -1).limit(20)
    history = await history_cursor.to_list(length=20)
    
    past_alerts_cursor = alerts_col.find({"user_id": user_id, "_id": {"$ne": alert_id}}).sort("created_at", -1)
    past_alerts = await past_alerts_cursor.to_list(length=20)
    
    complaints_cursor = complaints_col.find({"user_id": user_id}).sort("created_at", -1)
    complaints = await complaints_cursor.to_list(length=20)

    # Format the data cleanly
    intel = {
        "incident_id": alert["_id"],
        "status": alert.get("status", "active"),
        "severity": alert.get("severity", "medium"),
        "trigger_type": alert.get("trigger_type", "unknown"),
        "created_at": alert.get("created_at"),
        "resolved_at": alert.get("resolved_at"),
        "message": alert.get("message"),
        "location": alert.get("location", {}),
        "ai_analysis": alert.get("ai_analysis", {}),
        "audio_file_path": alert.get("audio_file_path"),
        "contacts_notified": alert.get("contacts_notified", []),
        
        "subject_personnel": {
            "user_id": user.get("_id"),
            "name": user.get("name", "Unknown"),
            "email": user.get("email"),
            "phone": user.get("phone"),
            "blood_group": user.get("blood_group", "Unknown"),
            "medical_conditions": user.get("medical_conditions", "None listed"),
            "district": user.get("district"),
            "division": user.get("division"),
        },
        
        "emergency_contacts": [
            {
                "name": c.get("name"),
                "phone": c.get("phone"),
                "relationship": c.get("relationship")
            } for c in contacts
        ],
        
        "live_movement": [
            {
                "latitude": h.get("latitude"),
                "longitude": h.get("longitude"),
                "timestamp": h.get("timestamp")
            } for h in history
        ],
        
        "history": {
            "past_alerts": len(past_alerts),
            "past_complaints": len(complaints),
            "recent_complaints": [
                {"id": c["_id"], "subject": c.get("subject"), "status": c.get("status")}
                for c in complaints[:5]
            ]
        }
    }
    
    return intel

