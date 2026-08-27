import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def get_admin():
    load_dotenv()
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "safeher")
    
    client = AsyncIOMotorClient(mongodb_url, serverSelectionTimeoutMS=5000)
    db = client[db_name]
    users_col = db["users"]
    
    admin = await users_col.find_one({"email": "admin@safeher.ai"})
    with open("admin_debug.txt", "w") as f:
        f.write(str(admin))
    client.close()

if __name__ == "__main__":
    asyncio.run(get_admin())
