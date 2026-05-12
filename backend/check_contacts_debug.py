import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def check_contacts():
    load_dotenv()
    mongodb_url = os.getenv('MONGODB_URL')
    if not mongodb_url:
        print("ERROR: MONGODB_URL not found in .env")
        return
        
    client = AsyncIOMotorClient(mongodb_url)
    db = client['safeher']
    
    # Check all users first to find the right one
    users = await db['users'].find().to_list(10)
    print("--- USERS ---")
    for u in users:
        print(f"ID: {u['_id']}, Email: {u['email']}")
        
    print("\n--- EMERGENCY CONTACTS ---")
    contacts = await db['emergency_contacts'].find().to_list(100)
    for c in contacts:
        print(f"UserID: {c['user_id']}, Name: {c['name']}, Phone: {c['phone']}, Primary: {c.get('is_primary')}")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(check_contacts())
