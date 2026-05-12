from twilio.rest import Client
from app.core.config import settings
from loguru import logger


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
    """Ensure phone number is in E.164 format for Twilio."""
    if not phone:
        return phone
    # Remove any non-digit characters except +
    clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")
    if not clean_phone.startswith("+"):
        # Assume Indian number if no country code (common for this app's users)
        # You might want to make the default country code configurable
        if len(clean_phone) == 10:
            return f"+91{clean_phone}"
        return f"+{clean_phone}"
    return clean_phone


async def send_emergency_sms(to_phone: str, message: str) -> bool:
    client = get_twilio_client()
    if not client:
        logger.warning(f"[MOCK SMS] To: {to_phone} | Message: {message[:80]}...")
        return True  # Mock success in dev

    try:
        formatted_to = format_phone_number(to_phone)
        msg = client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=formatted_to,
        )
        logger.info(f"SMS sent to {formatted_to}: SID={msg.sid}")
        return True
    except Exception as e:
        logger.error(f"SMS send failed to {to_phone}: {e}")
        return False


async def make_emergency_call(to_phone: str, user_name: str) -> bool:
    client = get_twilio_client()
    if not client:
        logger.warning(f"[MOCK CALL] To: {to_phone} for {user_name}")
        return True

    twiml = f"""
    <Response>
        <Say voice="alice" language="en-IN">
            Emergency Alert! {user_name} has triggered an SOS alert and needs immediate help.
            Please call them right away or contact local authorities.
            This is an automated message from SafeHer AI.
        </Say>
        <Pause length="1"/>
        <Say voice="alice">Repeating: {user_name} needs help. Please respond immediately.</Say>
    </Response>
    """

    try:
        formatted_to = format_phone_number(to_phone)
        call = client.calls.create(
            twiml=twiml,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=formatted_to,
        )
        logger.info(f"Call initiated to {formatted_to}: SID={call.sid}")
        return True
    except Exception as e:
        logger.error(f"Call failed to {to_phone}: {e}")
        return False
