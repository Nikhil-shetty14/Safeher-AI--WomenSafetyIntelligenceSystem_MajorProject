import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

# Add the backend dir to path so we can import from app
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
# pyrefly: ignore [missing-import]
from app.core.config import settings

async def main():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users_col = db.get_collection("users")
    
    admins = await users_col.find({"role": "regional_admin"}).to_list(length=10)
    
    if not admins:
        print("No division admins (regional_admin) found in the database.")
        return
        
    print("Found Division Admins:")
    for a in admins:
        print(f"Name: {a.get('name')}")
        print(f"Email: {a.get('email')}")
        print(f"Admin ID: {a.get('admin_id')}")
        print(f"Role: {a.get('role')}")
        print("-" * 20)
        
    print("\nNote: Passwords are encrypted (hashed) in the database and cannot be retrieved.")

if __name__ == "__main__":
    asyncio.run(main())
