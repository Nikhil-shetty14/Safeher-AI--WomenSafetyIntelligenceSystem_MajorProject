from twilio.rest import Client
from app.core.config import settings
from app.core.database import get_collection
from loguru import logger
from datetime import datetime
import uuid
import asyncio


def get_twilio_client():
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured")
        return None
    try:
        return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {e}")
        return None


def format_phone_number(phone: str) -> str:
    """
    Ensure phone number is in E.164 format for Twilio.
    Example: 9380596236 -> +919380596236
    """
    if not phone:
        return phone
    
    # Remove spaces and symbols
    clean_phone = "".join(c for c in phone if c.isdigit())
    
    if phone.startswith("+"):
        # Already has a country code, just clean digits and add back +
        return f"+{clean_phone}"
    
    # Default to +91 if 10 digits
    if len(clean_phone) == 10:
        return f"+91{clean_phone}"
    
    # Otherwise just add +
    return f"+{clean_phone}"


async def log_twilio_event(user_id: str, type: str, to: str, sid: str, status: str, error: str = None):
    """Log Twilio call/sms event to MongoDB."""
    collection = get_collection("call_logs" if type == "call" else "sms_logs")
    if collection is None:
        return
    
    log_doc = {
        "_id": str(uuid.uuid4()),
        "user_id": user_id,
        "to_number": to,
        "sid": sid,
        "status": status,
        "error": error,
        "timestamp": datetime.utcnow()
    }
    await collection.insert_one(log_doc)


async def send_emergency_sms(user_id: str, to_phone: str, message: str, retries: int = 3) -> bool:
    client = get_twilio_client()
    formatted_to = format_phone_number(to_phone)
    
    if not client:
        logger.warning(f"[MOCK SMS] To: {formatted_to} | Message: {message[:50]}...")
        return True

    for attempt in range(retries):
        try:
            msg = client.messages.create(
                body=message,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=formatted_to,
            )
            logger.info(f"SMS sent to {formatted_to} on attempt {attempt+1}: SID={msg.sid}")
            await log_twilio_event(user_id, "sms", formatted_to, msg.sid, "sent")
            return True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"SMS attempt {attempt+1} failed to {formatted_to}: {error_msg}")
            
            # Handle unverified numbers in trial accounts
            if "not verified" in error_msg.lower():
                logger.warning(f"Twilio Trial Limit: Number {formatted_to} is not verified. Skipping retries.")
                await log_twilio_event(user_id, "sms", formatted_to, "N/A", "failed_unverified", error_msg)
                return False
                
            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt) # Exponential backoff
            else:
                await log_twilio_event(user_id, "sms", formatted_to, "N/A", "failed", error_msg)
    
    return False


async def make_emergency_call(user_id: str, to_phone: str, user_name: str, retries: int = 3) -> bool:
    client = get_twilio_client()
    formatted_to = format_phone_number(to_phone)
    
    if not client:
        logger.warning(f"[MOCK CALL] To: {formatted_to} for {user_name}")
        return True

    twiml = f"""
    <Response>
        <Say voice="alice" language="en-IN">
            This is an emergency alert from SafeHer AI. {user_name} may be in danger and has triggered an SOS.
            Please check on them immediately. Track their location using the SMS link sent to you.
        </Say>
        <Pause length="1"/>
        <Say voice="alice">Repeating: {user_name} needs help. Please respond immediately.</Say>
    </Response>
    """

    for attempt in range(retries):
        try:
            call = client.calls.create(
                twiml=twiml,
                from_=settings.TWILIO_PHONE_NUMBER,
                to=formatted_to,
            )
            logger.info(f"Call initiated to {formatted_to} on attempt {attempt+1}: SID={call.sid}")
            await log_twilio_event(user_id, "call", formatted_to, call.sid, "initiated")
            return True
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Call attempt {attempt+1} failed to {formatted_to}: {error_msg}")
            
            if "not verified" in error_msg.lower():
                logger.warning(f"Twilio Trial Limit: Number {formatted_to} is not verified.")
                await log_twilio_event(user_id, "call", formatted_to, "N/A", "failed_unverified", error_msg)
                return False

            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                await log_twilio_event(user_id, "call", formatted_to, "N/A", "failed", error_msg)

    return False
