import asyncio
from app.services.twilio_service import send_emergency_sms, make_emergency_call
from app.core.config import settings

async def test_twilio():
    print(f"Testing Twilio with SID: {settings.TWILIO_ACCOUNT_SID}")
    print(f"From Phone: {settings.TWILIO_PHONE_NUMBER}")
    
    # Replace with a real phone number if you want to test actual delivery
    test_phone = "+919632831828" # Using a placeholder or common test number
    
    print(f"\n1. Testing SMS to {test_phone}...")
    sms_success = await send_emergency_sms(test_phone, "SafeHer Twilio Test: If you receive this, SMS is working!")
    if sms_success:
        print("✅ SMS Request Successful (Check logs for SID)")
    else:
        print("❌ SMS Request Failed")

    print(f"\n2. Testing Call to {test_phone}...")
    call_success = await make_emergency_call(test_phone, "Test User")
    if call_success:
        print("✅ Call Request Successful (Check logs for SID)")
    else:
        print("❌ Call Request Failed")

if __name__ == "__main__":
    asyncio.run(test_twilio())
