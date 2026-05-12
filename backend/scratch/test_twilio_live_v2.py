import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from app.services.twilio_service import send_emergency_sms, make_emergency_call
from app.core.config import settings

async def test_twilio():
    print(f"Testing Twilio with SID: {settings.TWILIO_ACCOUNT_SID}")
    
    test_phone = "+919632831828"
    
    print(f"\n1. Testing SMS to {test_phone}...")
    try:
        sms_success = await send_emergency_sms(test_phone, "SafeHer Twilio Test: If you receive this, SMS is working!")
        if sms_success:
            print("SUCCESS: SMS Request Successful")
        else:
            print("FAILURE: SMS Request Failed")
    except Exception as e:
        print(f"ERROR during SMS test: {e}")

    print(f"\n2. Testing Call to {test_phone}...")
    try:
        call_success = await make_emergency_call(test_phone, "Test User")
        if call_success:
            print("SUCCESS: Call Request Successful")
        else:
            print("FAILURE: Call Request Failed")
    except Exception as e:
        print(f"ERROR during Call test: {e}")

if __name__ == "__main__":
    asyncio.run(test_twilio())
