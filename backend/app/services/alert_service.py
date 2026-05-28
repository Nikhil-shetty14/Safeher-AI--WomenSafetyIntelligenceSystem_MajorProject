import uuid
from datetime import datetime
from typing import List, Optional
from app.core.database import get_collection
from app.models.alert import SOSAlertCreate, AlertSeverity, AlertStatus
from app.services.twilio_service import send_emergency_sms, make_emergency_call
from app.services.notification_service import send_push_notification
from app.core.database import get_collection
from loguru import logger
import asyncio


async def create_sos_alert(alert_data: SOSAlertCreate, ai_analysis: dict = None) -> dict:
    collection = get_collection("alerts")
    if collection is None:
        return {"error": "Database unavailable"}

    alert_id = str(uuid.uuid4())
    now = datetime.utcnow()

    # Determine severity from AI analysis
    severity = AlertSeverity.high.value
    priority_score = 3
    if ai_analysis:
        danger_level = ai_analysis.get("danger_level", "high")
        severity_map = {
            "safe": AlertSeverity.low.value,
            "low": AlertSeverity.low.value,
            "medium": AlertSeverity.medium.value,
            "high": AlertSeverity.high.value,
            "critical": AlertSeverity.critical.value,
        }
        priority_map = {
            "safe": 1,
            "low": 2,
            "medium": 3,
            "high": 4,
            "critical": 5
        }
        severity = severity_map.get(danger_level, AlertSeverity.high.value)
        priority_score = priority_map.get(danger_level, 4)

    # Validate incoming location; if invalid or (0,0), attempt to use last known location from history
    loc_obj = alert_data.location.dict()
    lat = loc_obj.get("latitude")
    lng = loc_obj.get("longitude")
    try:
        lat_f = float(lat) if lat is not None else None
    except Exception:
        lat_f = None
    try:
        lng_f = float(lng) if lng is not None else None
    except Exception:
        lng_f = None

    need_fallback = False
    if lat_f is None or lng_f is None:
        need_fallback = True
    else:
        # treat obvious invalid 0,0 as missing
        if abs(lat_f) < 1e-6 and abs(lng_f) < 1e-6:
            need_fallback = True

    if need_fallback:
        try:
            lh_col = get_collection("location_history")
            if lh_col is not None:
                last = await lh_col.find_one({"user_id": alert_data.user_id}, sort=[("timestamp", -1)])
                if last and last.get("latitude") is not None and last.get("longitude") is not None:
                    loc_obj = {
                        "latitude": last.get("latitude"),
                        "longitude": last.get("longitude"),
                        "accuracy": last.get("accuracy"),
                        "timestamp": last.get("timestamp"),
                    }
                    logger.info(f"Alert {alert_id}: used fallback location from history for user {alert_data.user_id}")
        except Exception as e:
            logger.warning(f"Could not lookup fallback location: {e}")

    alert_doc = {
        "_id": alert_id,
        "user_id": alert_data.user_id,
        "trigger_type": alert_data.trigger_type,
        "severity": severity,
        "status": AlertStatus.active.value,
        "location": loc_obj,
        "message": alert_data.message,
        "ai_analysis": ai_analysis,
        "audio_file_path": alert_data.audio_file_path,
        "contacts_notified": [],
        "priority_score": priority_score,
        "created_at": now,
        "resolved_at": None,
    }

    await collection.insert_one(alert_doc)
    logger.warning(f"SOS Alert created: {alert_id} for user {alert_data.user_id}")

    # Notify emergency contacts asynchronously
    asyncio.create_task(notify_emergency_contacts(alert_data.user_id, alert_doc))

    return alert_doc


async def notify_emergency_contacts(user_id: str, alert: dict):
    """Notify all emergency contacts via SMS and call safely without throwing uncaught async loop exceptions."""
    import traceback
    try:
        contacts_collection = get_collection("emergency_contacts")
        users_collection = get_collection("users")

        if contacts_collection is None or users_collection is None:
            logger.warning("Database unavailable during emergency contact notification")
            return

        user = await users_collection.find_one({"_id": user_id})
        if not user:
            logger.error(f"User {user_id} not found when trying to notify emergency contacts")
            return

        contacts = await contacts_collection.find({"user_id": user_id}).to_list(length=10)
        if not contacts:
            logger.info(f"No emergency contacts configured for user {user.get('name')}")
            return

        location = alert.get("location", {})
        lat = location.get("latitude", 0)
        lng = location.get("longitude", 0)

        maps_link = f"https://maps.google.com/?q={lat},{lng}"
        sms_message = (
            f"🚨 SafeHer AI EMERGENCY ALERT 🚨\n\n"
            f"I ({user.get('name', 'User')}) may be in danger! Track my live location here:\n"
            f"{maps_link}\n\n"
            f"Alert Time: {alert.get('created_at', datetime.utcnow()).strftime('%H:%M:%S UTC')}\n"
            f"Please check on me immediately!"
        )

        # Notify all contacts in parallel for maximum speed
        tasks = []
        for contact in contacts:
            logger.info(f"Triggering emergency workflow for {contact.get('name')} ({contact.get('phone')})")
            
            # SMS for all
            if contact.get("phone"):
                tasks.append(send_emergency_sms(user_id, contact["phone"], sms_message))
                
            # Calls for all (as requested: 'triggers phone calls to saved emergency contacts')
            if contact.get("phone"):
                tasks.append(make_emergency_call(user_id, contact["phone"], user.get("name", "User")))

        if tasks:
            # Wait for all initial attempts safely
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log results and check if any exceptions were thrown
            for res in results:
                if isinstance(res, Exception):
                    logger.error(f"Emergency worker task failed: {res}")
            
            logger.success(f"Emergency notification cycle complete for {user.get('name')}. Processes triggered: {len(tasks)}")
        else:
            logger.warning(f"No valid phone numbers found for emergency contacts of {user.get('name')}")

        # Update alert record with notification status
        alerts_collection = get_collection("alerts")
        if alerts_collection is not None:
            await alerts_collection.update_one(
                {"_id": alert["_id"]},
                {"$set": {
                    "notified_timestamp": datetime.utcnow(),
                    "emergency_broadcast_active": True
                }}
            )

        # Send push notification to user safely
        if user.get("fcm_token"):
            try:
                await send_push_notification(
                    user["fcm_token"],
                    "SOS Alert Sent",
                    f"Emergency contacts have been notified. Help is on the way!",
                )
            except Exception as push_err:
                logger.error(f"Failed to send push notification: {push_err}")

    except Exception as e:
        logger.error(f"CRITICAL ERROR inside notify_emergency_contacts background task: {str(e)}")
        traceback.print_exc()


async def get_active_alerts(skip: int = 0, limit: int = 50) -> List[dict]:
    collection = get_collection("alerts")
    if collection is None:
        return []
    cursor = collection.find({"status": "active"}).sort([("priority_score", -1), ("created_at", -1)]).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


async def get_user_alerts(user_id: str, skip: int = 0, limit: int = 20) -> List[dict]:
    collection = get_collection("alerts")
    if collection is None:
        return []
    cursor = collection.find({"user_id": user_id}).sort("created_at", -1).skip(skip).limit(limit)
    return await cursor.to_list(length=limit)


async def resolve_alert(alert_id: str) -> Optional[dict]:
    collection = get_collection("alerts")
    if collection is None:
        return None
    await collection.update_one(
        {"_id": alert_id},
        {"$set": {"status": AlertStatus.resolved.value, "resolved_at": datetime.utcnow()}}
    )
    return await collection.find_one({"_id": alert_id})


async def format_alert_response(alert: dict) -> dict:
    from app.core.database import get_collection
    users_col = get_collection("users")
    user_info = {}
    
    if users_col is not None:
        user = await users_col.find_one({"_id": alert["user_id"]})
        if user:
            user_info = {
                "user_name": user.get("name", "Unknown User"),
                "user_email": user.get("email", "N/A"),
                "user_phone": user.get("phone", "N/A")
            }

    return {
        "id": alert["_id"],
        "user_id": alert["user_id"],
        **user_info,
        "trigger_type": alert["trigger_type"],
        "severity": alert["severity"],
        "status": alert["status"],
        "location": alert["location"],
        "message": alert.get("message"),
        "ai_analysis": alert.get("ai_analysis"),
        "audio_file_path": alert.get("audio_file_path"),
        "contacts_notified": alert.get("contacts_notified", []),
        "priority_score": alert.get("priority_score", 0),
        "created_at": alert["created_at"],
        "resolved_at": alert.get("resolved_at"),
    }
