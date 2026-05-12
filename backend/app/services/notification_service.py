import httpx
from app.core.config import settings
from loguru import logger


async def send_push_notification(fcm_token: str, title: str, body: str, data: dict = None) -> bool:
    if not settings.FCM_SERVER_KEY:
        logger.warning(f"[MOCK PUSH] Title: {title} | Body: {body}")
        return True

    headers = {
        "Authorization": f"key={settings.FCM_SERVER_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "to": fcm_token,
        "notification": {
            "title": title,
            "body": body,
            "sound": "emergency_alert",
            "priority": "high",
        },
        "data": data or {},
        "priority": "high",
        "content_available": True,
    }

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://fcm.googleapis.com/fcm/send",
                json=payload,
                headers=headers,
                timeout=10.0,
            )
            if response.status_code == 200:
                logger.info(f"Push notification sent to token ending: ...{fcm_token[-6:]}")
                return True
            else:
                logger.error(f"FCM error: {response.status_code} - {response.text}")
                return False
    except Exception as e:
        logger.error(f"Push notification failed: {e}")
        return False


async def send_bulk_notifications(tokens: list, title: str, body: str, data: dict = None) -> dict:
    results = {"success": 0, "failure": 0}
    for token in tokens:
        success = await send_push_notification(token, title, body, data)
        if success:
            results["success"] += 1
        else:
            results["failure"] += 1
    return results
