import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
from app.core.config import settings

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users_col = db.get_collection("users")
    
    admins = await users_col.find({"role": {"$in": ["state_admin", "admin", "super_admin", "regional_admin"]}}).to_list(length=100)
    
    print("Found Admins:")
    for a in admins:
        print(f"Name: {a.get('name')}")
        print(f"Email: {a.get('email')}")
        print(f"Admin ID: {a.get('admin_id')}")
        print(f"Role: {a.get('role')}")
        print(f"ID: {a.get('id') or a.get('_id')}")
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(main())
