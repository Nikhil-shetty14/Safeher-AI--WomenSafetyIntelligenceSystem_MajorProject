import asyncio
from app.core.database import get_collection, connect_db
from datetime import datetime, timedelta

async def check_predictions():
    await connect_db()
    col = get_collection("ai_predictions")
    if col is None:
        print("Could not get ai_predictions collection")
        return

    count = await col.count_documents({})
    print(f"Total predictions: {count}")

    since = datetime.utcnow() - timedelta(days=7)
    recent = await col.count_documents({"created_at": {"$gte": since}})
    print(f"Predictions in last 7 days: {recent}")

    if recent > 0:
        sample = await col.find({"created_at": {"$gte": since}}).limit(5).to_list(length=5)
        for s in sample:
            print(f"Date: {s.get('created_at')}, Level: {s.get('danger_level')}")

if __name__ == "__main__":
    asyncio.run(check_predictions())
