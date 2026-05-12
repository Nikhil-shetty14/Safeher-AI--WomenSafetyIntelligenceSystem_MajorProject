import asyncio
import os
import uuid
import bcrypt
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def create_admin():
    load_dotenv()
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "safeher")
    
    admin_email = "admin@safeher.ai"
    admin_pass = "admin123"
    
    # Generate hash using bcrypt directly to avoid passlib version issues
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(admin_pass.encode('utf-8'), salt).decode('utf-8')
    
    print(f"Connecting to MongoDB...")
    try:
        client = AsyncIOMotorClient(mongodb_url, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=5000)
        db = client[db_name]
        users_col = db["users"]
        
        print("Checking for existing admin...")
        existing = await users_col.find_one({"email": admin_email})
        
        if existing:
            print(f"Admin account already exists: {admin_email}")
            await users_col.update_one({"_id": existing["_id"]}, {"$set": {"role": "admin", "hashed_password": hashed}})
            print("Updated admin role and password.")
        else:
            user_id = str(uuid.uuid4())
            now = datetime.utcnow()
            user_doc = {
                "_id": user_id,
                "name": "System Admin",
                "email": admin_email,
                "phone": "0000000000",
                "hashed_password": hashed,
                "role": "admin",
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
            await users_col.insert_one(user_doc)
            print(f"Created new admin account!")
            print(f"Email: {admin_email}")
            print(f"Password: {admin_pass}")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_admin())
