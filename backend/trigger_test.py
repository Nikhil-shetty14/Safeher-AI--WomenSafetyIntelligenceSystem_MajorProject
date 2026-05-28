import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from datetime import datetime

async def insert_mock_alert():
    client = AsyncIOMotorClient("mongodb+srv://safeher:safeher@cluster0.pqv0x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
    db = client["safeher"]
    alerts = db["alerts"]
    
    alert_id = str(uuid.uuid4())
    alert = {
        "_id": alert_id,
        "user_id": "mock_user",
        "trigger_type": "manual",
        "severity": "critical",
        "status": "active",
        "location": {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "accuracy": 10,
            "timestamp": datetime.utcnow()
        },
        "message": "This is a mock SOS alert for testing",
        "priority_score": 5,
        "created_at": datetime.utcnow(),
    }
    
    await alerts.insert_one(alert)
    print(f"Inserted mock alert: {alert_id}")

if __name__ == "__main__":
    asyncio.run(insert_mock_alert())
