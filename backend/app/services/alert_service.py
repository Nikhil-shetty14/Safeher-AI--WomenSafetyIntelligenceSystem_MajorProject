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
    if ai_analysis:
        danger_level = ai_analysis.get("danger_level", "high")
        severity_map = {
            "safe": AlertSeverity.low.value,
            "low": AlertSeverity.low.value,
            "medium": AlertSeverity.medium.value,
            "high": AlertSeverity.high.value,
            "critical": AlertSeverity.critical.value,
        }
        severity = severity_map.get(danger_level, AlertSeverity.high.value)

    alert_doc = {
        "_id": alert_id,
        "user_id": alert_data.user_id,
        "trigger_type": alert_data.trigger_type,
        "severity": severity,
        "status": AlertStatus.active.value,
        "location": alert_data.location.dict(),
        "message": alert_data.message,
        "ai_analysis": ai_analysis,
        "audio_file_path": alert_data.audio_file_path,
        "contacts_notified": [],
        "created_at": now,
        "resolved_at": None,
    }

    await collection.insert_one(alert_doc)
    logger.warning(f"SOS Alert created: {alert_id} for user {alert_data.user_id}")

    # Notify emergency contacts asynchronously
    asyncio.create_task(notify_emergency_contacts(alert_data.user_id, alert_doc))

    return alert_doc


async def notify_emergency_contacts(user_id: str, alert: dict):
    """Notify all emergency contacts via SMS and call."""
    contacts_collection = get_collection("emergency_contacts")
    users_collection = get_collection("users")

    if contacts_collection is None or users_collection is None:
        return

    user = await users_collection.find_one({"_id": user_id})
    if not user:
        return

    contacts = await contacts_collection.find({"user_id": user_id}).to_list(length=10)
    location = alert.get("location", {})
    lat = location.get("latitude", 0)
    lng = location.get("longitude", 0)

    maps_link = f"https://maps.google.com/?q={lat},{lng}"
    message = (
        f"🚨 EMERGENCY ALERT 🚨\n"
        f"{user['name']} has triggered an SOS alert!\n"
        f"Location: {maps_link}\n"
        f"Time: {alert['created_at'].strftime('%Y-%m-%d %H:%M:%S')} UTC\n"
        f"Please call them immediately or contact authorities!"
    )

    notified = []
    for contact in contacts:
        try:
            logger.info(f"Attempting to notify contact: {contact['name']} ({contact['phone']})")
            
            # Send SMS
            sms_success = await send_emergency_sms(contact["phone"], message)
            if sms_success:
                notified.append(contact["_id"])
                logger.info(f"SMS successfully sent to {contact['name']}")
            else:
                logger.error(f"Failed to send SMS to {contact['name']}")

            # Initiate Voice Call (Primary Contact Only)
            if contact.get("is_primary"):
                logger.info(f"Initiating primary emergency call to {contact['name']}...")
                call_success = await make_emergency_call(contact["phone"], user["name"])
                if call_success:
                    logger.info(f"Emergency call triggered for {contact['name']}")
                else:
                    logger.error(f"Failed to trigger emergency call for {contact['name']}")
                
        except Exception as e:
            logger.error(f"CRITICAL: Failed to notify {contact['name']}: {str(e)}")
            continue # Ensure other contacts still get notified if one fails

    # Update alert with notified contacts
    alerts_collection = get_collection("alerts")
    if alerts_collection is not None:
        await alerts_collection.update_one(
            {"_id": alert["_id"]},
            {"$set": {"contacts_notified": notified}}
        )

    # Send push notification to user
    if user.get("fcm_token"):
        await send_push_notification(
            user["fcm_token"],
            "SOS Alert Sent",
            f"Emergency contacts have been notified. Help is on the way!",
        )


async def get_active_alerts(skip: int = 0, limit: int = 50) -> List[dict]:
    collection = get_collection("alerts")
    if collection is None:
        return []
    cursor = collection.find({"status": "active"}).sort("created_at", -1).skip(skip).limit(limit)
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
        "created_at": alert["created_at"],
        "resolved_at": alert.get("resolved_at"),
    }
