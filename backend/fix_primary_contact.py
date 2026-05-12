import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def set_primary():
    load_dotenv()
    mongodb_url = os.getenv('MONGODB_URL')
    client = AsyncIOMotorClient(mongodb_url)
    db = client['safeher']
    
    result = await db['emergency_contacts'].update_one(
        {'phone': '9380596236'}, 
        {'$set': {'is_primary': True}}
    )
    
    if result.modified_count > 0:
        print("Success: Contact 9380596236 is now PRIMARY.")
    else:
        print("No changes made. Contact might already be primary or was not found.")
        
    client.close()

if __name__ == "__main__":
    asyncio.run(set_primary())
