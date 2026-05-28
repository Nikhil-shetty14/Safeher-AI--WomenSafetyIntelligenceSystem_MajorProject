from fastapi import APIRouter, Depends, HTTPException
from app.core.security import get_current_admin
from app.core.database import get_collection
from app.services.alert_service import get_active_alerts, format_alert_response
from app.services.user_service import get_all_users
from app.models.user import AdminUserUpdate
from app.websockets.socket_manager import get_connected_count
from datetime import datetime, timedelta
from loguru import logger

router = APIRouter(prefix="/api/admin", tags=["Admin Dashboard"])


@router.get("/stats")
async def get_dashboard_stats(_: dict = Depends(get_current_admin)):
    """Get real-time dashboard statistics."""
    try:
        alerts_col = get_collection("alerts")
        users_col = get_collection("users")
        predictions_col = get_collection("ai_predictions")

        total_users = await users_col.count_documents({}) if users_col is not None else 0
        active_alerts = await alerts_col.count_documents({"status": "active"}) if alerts_col is not None else 0
        total_alerts_today = 0
        critical_alerts = 0

        if alerts_col is not None:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            total_alerts_today = await alerts_col.count_documents({"created_at": {"$gte": today_start}})
            critical_alerts = await alerts_col.count_documents({"severity": "critical", "status": "active"})

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
async def get_active_alerts(_: dict = Depends(get_current_admin)):
    """Get all currently active SOS alerts."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        return []
        
    cursor = alerts_col.find({"status": "active"}).sort("created_at", -1)
    alerts = await cursor.to_list(length=100)
    
    return [await format_alert_response(a) for a in alerts]


@router.get("/alerts/recent")
async def get_recent_alerts(limit: int = 50, _: dict = Depends(get_current_admin)):
    """Get recent SOS alerts history."""
    try:
        alerts_col = get_collection("alerts")
        if alerts_col is None:
            return []
            
        cursor = alerts_col.find().sort("created_at", -1).limit(limit)
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
    _: dict = Depends(get_current_admin)
):
    """List all registered users."""
    users = await get_all_users(skip, limit)
    return [
        {
            "id": u.get("_id"),
            "name": u.get("name"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "role": u.get("role", "user"),
            "is_active": u.get("is_active", True),
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
async def get_alerts_heatmap(_: dict = Depends(get_current_admin)):
    """Get alert locations for risk heatmap visualization."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        return []

    since = datetime.utcnow() - timedelta(days=30)
    cursor = alerts_col.find(
        {"created_at": {"$gte": since}},
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
async def get_danger_trends(_: dict = Depends(get_current_admin)):
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
        cursor = alerts_col.find(
            {"created_at": {"$gte": since}},
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
