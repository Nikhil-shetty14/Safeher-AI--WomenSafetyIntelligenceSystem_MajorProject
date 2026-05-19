import asyncio
import os
import sys

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import connect_db
from app.api.routes.sos import trigger_sos
from app.models.alert import SOSAlertCreate, LocationData, SOSAlertTriggerResponse

async def main():
    print("Connecting to DB...")
    await connect_db()
    
    alert_data = SOSAlertCreate(
        user_id="3686bee8-4622-480d-9f1e-e8d905ae3c3b",
        trigger_type="button",
        location=LocationData(latitude=12.9716, longitude=77.5946),
        message="Test emergency message"
    )
    current_user = {
        "_id": "3686bee8-4622-480d-9f1e-e8d905ae3c3b",
        "name": "Ammu",
        "email": "ammu@gmail.com",
        "phone": "9380596236"
    }
    
    print("Calling trigger_sos...")
    try:
        res = await trigger_sos(alert_data, current_user)
        print("SUCCESS! Result dict built.")
        print("Now performing Pydantic response validation against SOSAlertTriggerResponse...")
        validated = SOSAlertTriggerResponse(**res)
        print("VALIDATION SUCCESS! Validated object:", validated)
    except Exception as e:
        import traceback
        print("ERROR ENCOUNTERED:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
