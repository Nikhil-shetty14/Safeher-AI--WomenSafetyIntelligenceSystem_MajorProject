import asyncio
import os
import uuid
import bcrypt
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Define the admins you want to create or update here:
NEW_ADMINS = [
    {
        "name": "Admin One",
        "email": "admin1@safeher.ai",
        "password": "SecurePassword1!",
        "phone": "9876543210"
    },
    {
        "name": "Admin Two",
        "email": "admin2@safeher.ai",
        "password": "SecurePassword2!",
        "phone": "9876543211"
    },
    {
        "name": "Admin Three",
        "email": "admin3@safeher.ai",
        "password": "SecurePassword3!",
        "phone": "9876543212"
    },
    {
        "name": "Admin Four",
        "email": "admin4@safeher.ai",
        "password": "SecurePassword4!",
        "phone": "9876543213"
    },
    {
        "name": "Admin Five",
        "email": "admin5@safeher.ai",
        "password": "SecurePassword5!",
        "phone": "9876543214"
    }
]

async def create_admins():
    load_dotenv()
    mongodb_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("DATABASE_NAME", "safeher")
    
    print(f"Connecting to MongoDB...")
    try:
        client = AsyncIOMotorClient(
            mongodb_url, 
            tlsAllowInvalidCertificates=True,
            serverSelectionTimeoutMS=5000
        )
        db = client[db_name]
        users_col = db["users"]
        
        for admin in NEW_ADMINS:
            name = admin["name"]
            email = admin["email"]
            password = admin["password"]
            phone = admin["phone"]
            
            # Generate bcrypt hash
            salt = bcrypt.gensalt()
            hashed = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
            
            print(f"Checking for existing user with email: {email}...")
            existing = await users_col.find_one({"email": email})
            
            if existing:
                print(f"User account already exists: {email}. Updating to admin and setting password...")
                await users_col.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "name": name,
                        "role": "admin",
                        "hashed_password": hashed,
                        "phone": phone,
                        "updated_at": datetime.utcnow()
                    }}
                )
                print(f"Successfully updated admin {email}!")
            else:
                user_id = str(uuid.uuid4())
                now = datetime.utcnow()
                user_doc = {
                    "_id": user_id,
                    "name": name,
                    "email": email,
                    "phone": phone,
                    "hashed_password": hashed,
                    "role": "admin",
                    "is_active": True,
                    "created_at": now,
                    "updated_at": now,
                }
                await users_col.insert_one(user_doc)
                print(f"Created new admin account for {name} ({email})!")
                
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(create_admins())
