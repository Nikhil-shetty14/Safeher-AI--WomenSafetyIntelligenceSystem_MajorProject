from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from app.models.location import LocationUpdate
from app.core.security import get_current_user, get_current_admin
from app.core.database import get_collection
from app.websockets.socket_manager import broadcast_to_admins, live_locations
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/location", tags=["GPS Tracking"])


@router.post("/update")
async def update_location(
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user's live GPS location."""
    try:
        user_id = str(current_user["_id"])
        location.user_id = user_id

        # Store in DB
        collection = get_collection("location_history")
        if collection is not None:
            doc = {
                "_id": str(uuid.uuid4()),
                "user_id": user_id,
                "latitude": location.latitude,
                "longitude": location.longitude,
                "accuracy": location.accuracy,
                "speed": location.speed,
                "heading": location.heading,
                "altitude": location.altitude,
                "timestamp": datetime.utcnow(),
            }
            await collection.insert_one(doc)

        # Broadcast to admins via WebSocket
        await broadcast_to_admins("user_location_update", {
            "user_id": user_id,
            "user_name": current_user.get("name"),
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timestamp": datetime.utcnow().isoformat(),
        })

        # Update live locations cache
        live_locations[user_id] = {
            "user_id": user_id,
            "user_name": current_user.get("name"),
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timestamp": datetime.utcnow().isoformat(),
        }

        return {"status": "ok", "message": "Location updated"}
    except Exception as e:
        logger.error(f"Error in update_location: {str(e)}")
        logger.exception(e) # This will log the full traceback
        raise HTTPException(status_code=500, detail=f"Location update failed: {str(e)}")


@router.get("/history")
async def get_location_history(
    hours: int = 24,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's location history."""
    collection = get_collection("location_history")
    if collection is None:
        return []

    from datetime import timedelta
    since = datetime.utcnow() - timedelta(hours=hours)
    cursor = collection.find(
        {"user_id": current_user["_id"], "timestamp": {"$gte": since}}
    ).sort("timestamp", -1).limit(200)
    history = await cursor.to_list(length=200)
    return [_format_location(loc) for loc in history]


@router.get("/live-users")
async def get_live_users(_: dict = Depends(get_current_admin)):
    """Get all users with active live location (admin only)."""
    return {
        "live_users": list(live_locations.values()),
        "count": len(live_locations),
    }


@router.get("/user/{user_id}/history")
async def get_user_location_history(
    user_id: str,
    hours: int = 24,
    _: dict = Depends(get_current_admin)
):
    """Get a specific user's location history (admin only)."""
    collection = get_collection("location_history")
    if collection is None:
        return []

    from datetime import timedelta
    since = datetime.utcnow() - timedelta(hours=hours)
    cursor = collection.find(
        {"user_id": user_id, "timestamp": {"$gte": since}}
    ).sort("timestamp", 1).limit(500)
    history = await cursor.to_list(length=500)
    return [_format_location(loc) for loc in history]


def _format_location(loc: dict) -> dict:
    return {
        "id": loc["_id"],
        "user_id": loc["user_id"],
        "latitude": loc["latitude"],
        "longitude": loc["longitude"],
        "accuracy": loc.get("accuracy"),
        "speed": loc.get("speed"),
        "heading": loc.get("heading"),
        "altitude": loc.get("altitude"),
        "timestamp": loc["timestamp"],
    }
