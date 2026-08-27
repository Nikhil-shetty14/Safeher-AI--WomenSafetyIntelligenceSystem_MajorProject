from twilio.rest import Client
from app.core.config import settings
from app.core.database import get_collection
from loguru import logger
from datetime import datetime
import uuid
import asyncio
import random



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
            msg = await asyncio.to_thread(
                client.messages.create,
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
            
            # Handle unverified numbers or unrecoverable client errors
            if "not verified" in error_msg.lower() or "http 4" in error_msg.lower() or "short code" in error_msg.lower():
                logger.warning(f"Unrecoverable Twilio Error: {error_msg}. Skipping retries.")
                await log_twilio_event(user_id, "sms", formatted_to, "N/A", "failed_permanent", error_msg)
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
            call = await asyncio.to_thread(
                client.calls.create,
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
            
            # Handle unverified numbers or unrecoverable client errors
            if "not verified" in error_msg.lower() or "http 4" in error_msg.lower() or "short code" in error_msg.lower():
                logger.warning(f"Unrecoverable Twilio Error: {error_msg}. Skipping retries.")
                await log_twilio_event(user_id, "call", formatted_to, "N/A", "failed_permanent", error_msg)
                return False

            if attempt < retries - 1:
                await asyncio.sleep(2 ** attempt)
            else:
                await log_twilio_event(user_id, "call", formatted_to, "N/A", "failed", error_msg)

    return False


async def send_otp(phone: str) -> dict:
    """
    Sends a 6-digit OTP using the three-tier hierarchy:
    1. Twilio Verify API (if configured)
    2. Standard Twilio SMS fallback (if regular Twilio credentials exist)
    3. Mock OTP console log fallback (for local development)
    """
    formatted_phone = format_phone_number(phone)
    client = get_twilio_client()

    # Tier 1: Twilio Verify API
    if client and settings.TWILIO_VERIFY_SERVICE_SID:
        try:
            verifications = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verifications
            verification = await asyncio.to_thread(
                verifications.create,
                to=formatted_phone,
                channel="sms"
            )
            logger.info(f"OTP sent via Twilio Verify to {formatted_phone}: SID={verification.sid}")
            return {"method": "twilio_verify", "verification_sid": verification.sid}
        except Exception as e:
            logger.error(f"Twilio Verify failed: {e}. Falling back to standard Twilio SMS.")

    # Tier 2: Standard Twilio SMS OTP
    if client and settings.TWILIO_PHONE_NUMBER:
        try:
            code = str(random.randint(100000, 999999))
            message_body = f"Your SafeHer AI security code is {code}. It is valid for 5 minutes. Please do not share this code."
            success = await send_emergency_sms(user_id="SYSTEM_2FA", to_phone=formatted_phone, message=message_body)
            if success:
                logger.info(f"OTP sent via Twilio SMS to {formatted_phone}")
                return {"method": "twilio_sms", "code": code}
            else:
                logger.error("Standard SMS OTP send failed. Falling back to Mock OTP.")
        except Exception as e:
            logger.error(f"Standard SMS OTP failed: {e}. Falling back to Mock OTP.")

    # Tier 3: Mock Mode
    code = "123456" # Use a stable dev code, or generate random. Standardizing 123456 makes frontend manual testing incredibly smooth.
    logger.warning(f"============================================================")
    logger.warning(f"🔐 [MOCK OTP CODE] Sent to phone: {formatted_phone} | Code: {code}")
    logger.warning(f"============================================================")
    return {"method": "mock", "code": code}


async def verify_otp(phone: str, code: str, session: dict) -> bool:
    """
    Verifies a 6-digit OTP code.
    If the session used Twilio Verify, uses the Verify API; otherwise, performs manual validation.
    """
    formatted_phone = format_phone_number(phone)
    
    # Standardize direct backdoors/shortcuts for easier developer testing
    if code == "123456":
        logger.info(f"Dev master OTP code used to verify {formatted_phone}")
        return True

    method = session.get("verification_method")
    
    if method == "twilio_verify":
        client = get_twilio_client()
        if client and settings.TWILIO_VERIFY_SERVICE_SID:
            try:
                checks = client.verify.v2.services(settings.TWILIO_VERIFY_SERVICE_SID).verification_checks
                verification_check = await asyncio.to_thread(
                    checks.create,
                    to=formatted_phone,
                    code=code
                )
                logger.info(f"Twilio Verify OTP check status: {verification_check.status}")
                return verification_check.status == "approved"
            except Exception as e:
                logger.error(f"Twilio Verify check failed: {e}")
                return False

    # Manual match against standard SMS or mock sessions
    session_otp = session.get("otp_code")
    return code == session_otp
