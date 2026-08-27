from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional
import os
import uuid
import shutil
from app.core.config import settings
from app.models.broadcast import BroadcastCreate, BroadcastResponse, BroadcastType, BroadcastPriority, BroadcastTargetType
from app.services.broadcast_service import (
    create_broadcast,
    get_broadcast_history,
    mark_broadcast_as_read,
    get_active_broadcasts,
    get_all_user_broadcasts,
    delete_broadcast
)
from app.core.security import get_current_user, get_current_admin
from datetime import datetime

router = APIRouter(prefix="/api/broadcast", tags=["Broadcast"])


@router.post("/", response_model=BroadcastResponse)
async def create_new_broadcast(
    title: str = Form(...),
    body: str = Form(...),
    type: str = Form(...),
    priority: str = Form(...),
    target_type: str = Form(...),
    target_location: Optional[str] = Form(None),
    scheduled_for: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    current_admin: dict = Depends(get_current_admin)
):
    """Admin creates a new emergency broadcast."""
    try:
        image_url = None
        if image and image.filename:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
            ext = os.path.splitext(image.filename)[1]
            file_id = str(uuid.uuid4())
            filename = f"broadcast_{file_id}{ext}"
            filepath = os.path.join(settings.UPLOAD_DIR, filename)
            with open(filepath, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            image_url = f"/uploads/{filename}"

        dt_scheduled = None
        if scheduled_for:
            # Need to parse ISO string
            dt_scheduled = datetime.fromisoformat(scheduled_for.replace("Z", "+00:00"))

        data = BroadcastCreate(
            title=title,
            body=body,
            type=BroadcastType(type),
            priority=BroadcastPriority(priority),
            target_type=BroadcastTargetType(target_type),
            target_location=target_location,
            scheduled_for=dt_scheduled,
            image_url=image_url
        )

        doc = await create_broadcast(data)
        doc["id"] = doc.pop("_id")
        return doc
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[BroadcastResponse])
async def list_broadcast_history(
    skip: int = 0,
    limit: int = 50,
    current_admin: dict = Depends(get_current_admin)
):
    """Admin views broadcast history."""
    docs = await get_broadcast_history(skip, limit)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@router.get("/active", response_model=List[BroadcastResponse])
async def get_user_active_broadcasts(
    current_user: dict = Depends(get_current_user)
):
    """User retrieves recent active broadcasts."""
    docs = await get_active_broadcasts(current_user["_id"])
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@router.get("/my-notifications", response_model=List[BroadcastResponse])
async def get_my_notifications(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """User retrieves their comprehensive notification history."""
    docs = await get_all_user_broadcasts(current_user["_id"], skip, limit)
    for d in docs:
        d["id"] = d.pop("_id")
    return docs


@router.post("/{broadcast_id}/read")
async def mark_read(
    broadcast_id: str,
    current_user: dict = Depends(get_current_user)
):
    """User marks a broadcast as read."""
    await mark_broadcast_as_read(broadcast_id)
    return {"success": True}


@router.delete("/{broadcast_id}")
async def delete_broadcast_record(
    broadcast_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    """Admin deletes a broadcast."""
    await delete_broadcast(broadcast_id)
    return {"success": True}
