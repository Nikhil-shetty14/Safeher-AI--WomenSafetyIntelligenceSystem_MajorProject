from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Body
from typing import List, Optional
from datetime import datetime
import uuid
import os
import shutil
import json
from loguru import logger

from app.models.complaint import ComplaintCreate, ComplaintUpdate, ComplaintResponse, ComplaintStatus, LocationData
from app.core.security import get_current_user, get_current_admin
from app.core.database import get_collection
from app.core.config import settings
from app.websockets.socket_manager import broadcast_to_admins
from app.utils.geo_mapping import get_division_for_district

def get_complaint_filter(admin: dict) -> dict:
    role = admin.get("role")
    if role in ["super_admin", "admin"]:
        return {}
    elif role == "regional_admin":
        return {"division": admin.get("division")}
    elif role == "district_admin":
        return {"district": admin.get("district")}
    return {"_id": "unauthorized"}

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])

def format_complaint_response(c: dict) -> dict:
    return {
        "id": c["_id"],
        "user_id": c["user_id"],
        "state": c.get("state", ""),
        "district": c.get("district", ""),
        "taluk": c.get("taluk", ""),
        "address": c.get("address", ""),
        "title": c.get("title", ""),
        "description": c.get("description", ""),
        "media_urls": c.get("media_urls", []),
        "location": c.get("location"),
        "status": c.get("status", ComplaintStatus.pending.value),
        "admin_remarks": c.get("admin_remarks"),
        "user_details": c.get("user_details"),
        "created_at": c.get("created_at"),
        "updated_at": c.get("updated_at"),
    }

async def populate_user_details(complaints: list) -> list:
    users_col = get_collection("users")
    if users_col is None:
        return complaints

    user_ids = list(set([c["user_id"] for c in complaints if "user_id" in c]))
    if not user_ids:
        return complaints

    # SafeHer stores user _id as a string in MongoDB, so we can query directly
    users = await users_col.find({"_id": {"$in": user_ids}}).to_list(length=len(user_ids))
    user_map = {
        u["_id"]: {
            "name": u.get("name", "Unknown User"),
            "email": u.get("email", "No Email"),
            "phone": u.get("phone", "No Phone")
        } for u in users
    }

    for c in complaints:
        if c["user_id"] in user_map:
            c["user_details"] = user_map[c["user_id"]]

    return complaints

@router.post("/submit", response_model=ComplaintResponse)
async def submit_complaint(
    state: str = Form(...),
    district: str = Form(...),
    taluk: str = Form(...),
    address: str = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    files: List[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user)
):
    try:
        complaints_col = get_collection("complaints")
        if complaints_col is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        complaint_id = f"CMP-{str(uuid.uuid4())[:8].upper()}"
        now = datetime.utcnow()
        
        media_urls = []
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        if files:
            for file in files:
                if file.filename:
                    ext = os.path.splitext(file.filename)[1]
                    file_id = str(uuid.uuid4())
                    filename = f"cmp_{file_id}{ext}"
                    filepath = os.path.join(settings.UPLOAD_DIR, filename)
                    with open(filepath, "wb") as buffer:
                        shutil.copyfileobj(file.file, buffer)
                    media_urls.append(f"/uploads/{filename}")

        loc = None
        if latitude is not None and longitude is not None:
            loc = {"latitude": latitude, "longitude": longitude}

        complaint_doc = {
            "_id": complaint_id,
            "user_id": current_user["_id"],
            "state": state,
            "division": get_division_for_district(district),
            "district": district,
            "taluk": taluk,
            "address": address,
            "title": title,
            "description": description,
            "media_urls": media_urls,
            "location": loc,
            "status": ComplaintStatus.pending.value,
            "admin_remarks": None,
            "created_at": now,
            "updated_at": now,
        }

        await complaints_col.insert_one(complaint_doc)

        formatted_complaint = format_complaint_response(complaint_doc)

        try:
            await broadcast_to_admins("new_complaint", {
                "complaint_id": complaint_id,
                "title": title,
                "district": district,
                "user_name": current_user.get("name")
            })
        except Exception as e:
            logger.error(f"Failed broadcasting new complaint: {e}")

        return formatted_complaint
    except Exception as e:
        logger.error(f"Error submitting complaint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/my-complaints", response_model=List[ComplaintResponse])
async def get_my_complaints(current_user: dict = Depends(get_current_user)):
    complaints_col = get_collection("complaints")
    if complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    cursor = complaints_col.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    complaints = await cursor.to_list(length=100)
    return [format_complaint_response(c) for c in complaints]

@router.get("/admin/all", response_model=List[ComplaintResponse])
async def get_all_complaints(current_admin: dict = Depends(get_current_admin)):
    complaints_col = get_collection("complaints")
    if complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
        
    query = get_complaint_filter(current_admin)
    cursor = complaints_col.find(query).sort("created_at", -1)
    complaints = await cursor.to_list(length=1000)
    complaints = await populate_user_details(complaints)
    return [format_complaint_response(c) for c in complaints]

@router.patch("/admin/{complaint_id}", response_model=ComplaintResponse)
async def update_complaint_status(
    complaint_id: str,
    update_data: ComplaintUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    complaints_col = get_collection("complaints")
    if complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")

    update_dict["updated_at"] = datetime.utcnow()

    # Note: Using update_one and then find_one to get updated document
    result = await complaints_col.update_one(
        {"_id": complaint_id},
        {"$set": update_dict}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Complaint not found")

    updated_complaint = await complaints_col.find_one({"_id": complaint_id})
    return format_complaint_response(updated_complaint)

@router.delete("/admin/{complaint_id}")
async def delete_complaint(
    complaint_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    complaints_col = get_collection("complaints")
    if complaints_col is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = await complaints_col.delete_one({"_id": complaint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Complaint not found")
        
    return {"success": True}
