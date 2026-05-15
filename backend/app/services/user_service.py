import uuid
from datetime import datetime
from typing import Optional
from app.core.database import get_collection
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models.user import UserCreate, UserUpdate, UserRole
from fastapi import HTTPException, status
from loguru import logger


async def create_user(user_data: UserCreate) -> dict:
    collection = get_collection("users")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    existing = await collection.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.utcnow()
    user_doc = {
        "_id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "phone": user_data.phone,
        "hashed_password": get_password_hash(user_data.password),
        "role": UserRole.user.value,
        "is_active": True,
        "age": user_data.age,
        "gender": user_data.gender,
        "address": user_data.address,
        "profile_image": None,
        "blood_group": None,
        "medical_conditions": None,
        "allergies": None,
        "fcm_token": None,
        "safety_preferences": {
            "sos_auto_activation": False,
            "shake_detection": False,
            "voice_triggered_sos": False,
            "hidden_sos_mode": False,
            "live_tracking_enabled": True
        },
        "notification_settings": {
            "sms_alerts": True,
            "emergency_calls": True,
            "push_notifications": True,
            "notification_sounds": True
        },
        "security_settings": {
            "biometric_login": False,
            "two_factor_auth": False
        },
        "created_at": now,
        "updated_at": now,
    }
    await collection.insert_one(user_doc)
    logger.info(f"New user created: {user_data.email}")
    return user_doc


async def authenticate_user(email: str, password: str) -> Optional[dict]:
    collection = get_collection("users")
    if collection is None:
        return None

    user = await collection.find_one({"email": email})
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


async def get_user_by_id(user_id: str) -> Optional[dict]:
    collection = get_collection("users")
    if collection is None:
        return None
    return await collection.find_one({"_id": user_id})


async def update_user(user_id: str, update_data: UserUpdate) -> Optional[dict]:
    collection = get_collection("users")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    
    # Handle nested models if they are provided as objects
    for field in ["safety_preferences", "notification_settings", "security_settings"]:
        if field in update_dict and update_dict[field] is not None:
            if hasattr(update_dict[field], "dict"):
                update_dict[field] = update_dict[field].dict()

    update_dict["updated_at"] = datetime.utcnow()

    await collection.update_one({"_id": user_id}, {"$set": update_dict})
    return await collection.find_one({"_id": user_id})


async def get_all_users(skip: int = 0, limit: int = 50) -> list:
    collection = get_collection("users")
    if collection is None:
        return []
    cursor = collection.find({}, {"hashed_password": 0}).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


def format_user_response(user: dict) -> dict:
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "phone": user["phone"],
        "role": user.get("role", "user"),
        "is_active": user.get("is_active", True),
        "age": user.get("age"),
        "gender": user.get("gender"),
        "address": user.get("address"),
        "profile_image": user.get("profile_image"),
        "blood_group": user.get("blood_group"),
        "medical_conditions": user.get("medical_conditions"),
        "allergies": user.get("allergies"),
        "safety_preferences": user.get("safety_preferences", {
            "sos_auto_activation": False,
            "shake_detection": False,
            "voice_triggered_sos": False,
            "hidden_sos_mode": False,
            "live_tracking_enabled": True
        }),
        "notification_settings": user.get("notification_settings", {
            "sms_alerts": True,
            "emergency_calls": True,
            "push_notifications": True,
            "notification_sounds": True
        }),
        "security_settings": user.get("security_settings", {
            "biometric_login": False,
            "two_factor_auth": False
        }),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"],
    }
