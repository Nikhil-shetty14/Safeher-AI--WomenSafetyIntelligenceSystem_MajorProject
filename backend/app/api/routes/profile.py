from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from app.models.user import UserResponse, UserUpdate, SafetyPreferences, NotificationSettings, SecuritySettings
from app.core.security import get_current_user
from app.core.database import get_collection
from app.services.user_service import update_user, format_user_response
from app.core.config import settings
from datetime import datetime
import os
import uuid
import aiofiles

from app.utils.activity_logger import log_activity

router = APIRouter(prefix="/api/profile", tags=["Profile Management"])


@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's full profile including preferences."""
    return format_user_response(current_user)


@router.put("/update", response_model=UserResponse)
async def update_my_profile(
    update_data: UserUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update basic profile information."""
    updated = await update_user(current_user["_id"], update_data)
    await log_activity(current_user["_id"], "update_profile", {"fields": list(update_data.dict(exclude_none=True).keys())})
    return format_user_response(updated)


@router.put("/preferences/safety", response_model=UserResponse)
async def update_safety_preferences(
    prefs: SafetyPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Update SOS and tracking preferences."""
    update_data = UserUpdate(safety_preferences=prefs)
    updated = await update_user(current_user["_id"], update_data)
    await log_activity(current_user["_id"], "update_safety_prefs", prefs.dict())
    return format_user_response(updated)


@router.put("/preferences/notifications", response_model=UserResponse)
async def update_notification_settings(
    settings: NotificationSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update notification preferences."""
    update_data = UserUpdate(notification_settings=settings)
    updated = await update_user(current_user["_id"], update_data)
    await log_activity(current_user["_id"], "update_notification_settings", settings.dict())
    return format_user_response(updated)


@router.put("/preferences/security", response_model=UserResponse)
async def update_security_settings(
    sec_settings: SecuritySettings,
    current_user: dict = Depends(get_current_user)
):
    """Update security features like biometric login."""
    update_data = UserUpdate(security_settings=sec_settings)
    updated = await update_user(current_user["_id"], update_data)
    await log_activity(current_user["_id"], "update_security_settings", sec_settings.dict())
    return format_user_response(updated)


@router.post("/upload-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload and set profile picture."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"profile_{current_user['_id']}_{uuid.uuid4().hex[:8]}{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    async with aiofiles.open(file_path, "wb") as out_file:
        content = await file.read()
        await out_file.write(content)

    # Update user record with relative path
    photo_url = f"/uploads/{filename}"
    update_data = UserUpdate(profile_image=photo_url)
    await update_user(current_user["_id"], update_data)

    return {"profile_image": photo_url}


@router.get("/history/summary")
async def get_safety_history_summary(current_user: dict = Depends(get_current_user)):
    """Get summary stats for safety history."""
    alerts_col = get_collection("alerts")
    ai_col = get_collection("ai_predictions")
    logs_col = get_collection("activity_logs")
    
    user_id = current_user["_id"]
    
    alert_count = await alerts_col.count_documents({"user_id": user_id})
    prediction_count = await ai_col.count_documents({"user_id": user_id})
    
    # Get last 5 activities
    cursor = logs_col.find({"user_id": user_id}).sort("timestamp", -1).limit(5)
    recent_activities = await cursor.to_list(length=5)
    
    return {
        "total_sos_alerts": alert_count,
        "total_ai_checks": prediction_count,
        "recent_activities": [
            {
                "action": a.get("action"),
                "timestamp": a.get("timestamp"),
                "details": a.get("details")
            } for a in recent_activities
        ]
    }
