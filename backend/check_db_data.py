import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_data():
    load_dotenv()
    url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "safeher")
    
    print(f"Connecting to MongoDB...")
    try:
        client = AsyncIOMotorClient(url, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        
        # Check users
        users_count = await db["users"].count_documents({})
        print(f"Total Users: {users_count}")
        
        # Check alerts
        alerts_count = await db["alerts"].count_documents({})
        print(f"Total SOS Alerts: {alerts_count}")
        
        # Check location history
        locations_count = await db["locations"].count_documents({})
        print(f"Total Location Updates: {locations_count}")
        
        if users_count > 0:
            print("\nRecent Users:")
            async for user in db["users"].find().limit(5):
                print(f"- {user['email']} ({user.get('role', 'user')})")
                
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(check_data())
