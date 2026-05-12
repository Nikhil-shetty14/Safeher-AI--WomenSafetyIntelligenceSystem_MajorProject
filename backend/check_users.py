import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_users():
    load_dotenv()
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "safeher")
    
    print(f"Connecting to {mongodb_url}...")
    client = AsyncIOMotorClient(mongodb_url)
    db = client[db_name]
    users_col = db["users"]
    
    users = await users_col.find().to_list(length=10)
    if not users:
        print("No users found in database.")
    else:
        for u in users:
            print(f"ID: {u['_id']}, Email: {u['email']}, Role: {u.get('role', 'user')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
