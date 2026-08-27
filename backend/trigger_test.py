import asyncio
import json
from bson import json_util
from app.core.database import connect_db, close_db, get_collection
from app.services.alert_service import create_sos_alert
from app.models.alert import SOSAlertCreate, LocationData

async def main():
    await connect_db()
    try:
        users_col = get_collection("users")
        user = await users_col.find_one({"name": {"$regex": "saara", "$options": "i"}})
        if not user:
            user = await users_col.find_one({})
        
        print(f"Using user: {user.get('name')} | District: {user.get('district')} | Division: {user.get('division')}")
        
        alert_data = SOSAlertCreate(
            user_id=str(user["_id"]),
            trigger_type="button",
            location=LocationData(latitude=12.29, longitude=76.63)
        )
        
        res = await create_sos_alert(alert_data)
        print("Created alert successfully!")
        print(json.dumps(res, indent=2, default=json_util.default))
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        await close_db()

if __name__ == "__main__":
    asyncio.run(main())
