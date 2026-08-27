import uuid
from datetime import datetime
from typing import List, Optional
from loguru import logger
import asyncio
from app.core.database import get_collection
from app.models.broadcast import BroadcastCreate, BroadcastStatus
from app.services.notification_service import send_bulk_notifications
from app.websockets.socket_manager import broadcast_to_users


async def create_broadcast(data: BroadcastCreate) -> dict:
    collection = get_collection("broadcasts")
    if collection is None:
        raise Exception("Database unavailable")

    now = datetime.utcnow()
    status = BroadcastStatus.active.value
    if data.scheduled_for and data.scheduled_for > now:
        status = BroadcastStatus.scheduled.value

    doc = {
        "_id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.body,
        "type": data.type.value,
        "priority": data.priority.value,
        "target_type": data.target_type.value,
        "target_location": data.target_location,
        "status": status,
        "scheduled_for": data.scheduled_for,
        "image_url": data.image_url,
        "created_at": now,
        "delivery_stats": {
            "sent": 0,
            "read": 0,
            "failed": 0
        }
    }

    await collection.insert_one(doc)
    logger.info(f"Created broadcast {doc['_id']} with status {status}")

    if status == BroadcastStatus.active.value:
        try:
            await process_broadcast(doc)
        except Exception as e:
            logger.error(f"Error processing broadcast immediately: {e}")

    return doc


async def get_target_users(target_type: str, target_location: str = None) -> List[dict]:
    users_col = get_collection("users")
    if users_col is None:
        return []

    if target_type == "all":
        return await users_col.find({}).to_list(length=10000)
    
    if target_type == "location" and target_location:
        # Simple implementation: target by text search in user profile addresses or known locations
        # A more robust solution would use geospatial queries, but for now we regex match the district/taluk.
        import re
        pattern = re.compile(target_location, re.IGNORECASE)
        users = await users_col.find({"$or": [
            {"address": {"$regex": pattern}},
            {"city": {"$regex": pattern}},
            {"state": {"$regex": pattern}}
        ]}).to_list(length=10000)
        return users

    return []


async def process_broadcast(broadcast: dict):
    logger.info(f"Processing broadcast {broadcast['_id']}")
    users = await get_target_users(broadcast.get("target_type"), broadcast.get("target_location"))
    
    if not users:
        logger.warning(f"No target users found for broadcast {broadcast['_id']}")
        await update_broadcast_status(broadcast["_id"], BroadcastStatus.completed.value)
        return

    user_ids = [str(u["_id"]) for u in users]
    fcm_tokens = [u["fcm_token"] for u in users if u.get("fcm_token")]

    # 1. Socket.IO Broadcast
    # We must convert datetime to string before sending via Socket.IO
    broadcast_payload = broadcast.copy()
    if "created_at" in broadcast_payload and isinstance(broadcast_payload["created_at"], datetime):
        broadcast_payload["created_at"] = broadcast_payload["created_at"].isoformat()
    if "scheduled_for" in broadcast_payload and isinstance(broadcast_payload["scheduled_for"], datetime):
        broadcast_payload["scheduled_for"] = broadcast_payload["scheduled_for"].isoformat()

    await broadcast_to_users("emergency_broadcast", broadcast_payload, user_ids=user_ids)

    # 2. Push Notifications
    sent = 0
    failed = 0
    if fcm_tokens:
        data_payload = {
            "broadcast_id": broadcast["_id"],
            "priority": broadcast.get("priority", "normal")
        }
        results = await send_bulk_notifications(fcm_tokens, broadcast["title"], broadcast["body"], data_payload)
        sent = results.get("success", 0)
        failed = results.get("failure", 0)
    
    # 3. Update DB
    col = get_collection("broadcasts")
    if col is not None:
        await col.update_one(
            {"_id": broadcast["_id"]},
            {
                "$set": {"status": BroadcastStatus.completed.value},
                "$inc": {
                    "delivery_stats.sent": sent or len(user_ids), 
                    "delivery_stats.failed": failed
                }
            }
        )
    logger.success(f"Broadcast {broadcast['_id']} completed. Targeted {len(user_ids)} users.")


async def update_broadcast_status(broadcast_id: str, status: str):
    col = get_collection("broadcasts")
    if col is not None:
        await col.update_one({"_id": broadcast_id}, {"$set": {"status": status}})


async def mark_broadcast_as_read(broadcast_id: str):
    col = get_collection("broadcasts")
    if col is not None:
        await col.update_one(
            {"_id": broadcast_id},
            {"$inc": {"delivery_stats.read": 1}}
        )


async def get_broadcast_history(skip: int = 0, limit: int = 50) -> List[dict]:
    col = get_collection("broadcasts")
    if col is None:
        return []
    cursor = col.find({}).sort("created_at", -1).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


async def delete_broadcast(broadcast_id: str):
    """Delete a broadcast from history."""
    col = get_collection("broadcasts")
    if col is not None:
        await col.delete_one({"_id": broadcast_id})


async def get_active_broadcasts(user_id: str, skip: int = 0, limit: int = 10) -> List[dict]:
    # Returns recent completed broadcasts
    col = get_collection("broadcasts")
    if col is None:
        return []
    
    # A complete solution would check if user is in target_location if target_type is location.
    # For now, return recent completed broadcasts that are either 'all' or active.
    cursor = col.find({"status": "completed"}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get_all_user_broadcasts(user_id: str, skip: int = 0, limit: int = 50) -> List[dict]:
    """Returns the comprehensive notification history for a user."""
    col = get_collection("broadcasts")
    if col is None:
        return []
        
    # Same as active broadcasts for now, but allows more pagination for history.
    cursor = col.find({"status": "completed"}).sort("created_at", -1).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


async def poll_scheduled_broadcasts():
    """Background task to poll and send scheduled broadcasts."""
    while True:
        try:
            col = get_collection("broadcasts")
            if col is not None:
                now = datetime.utcnow()
                scheduled = await col.find({
                    "status": BroadcastStatus.scheduled.value,
                    "scheduled_for": {"$lte": now}
                }).to_list(length=50)

                for b in scheduled:
                    await col.update_one({"_id": b["_id"]}, {"$set": {"status": BroadcastStatus.active.value}})
                    asyncio.create_task(process_broadcast(b))
        except Exception as e:
            logger.error(f"Error in poll_scheduled_broadcasts: {e}")
        
        await asyncio.sleep(60) # Poll every minute
