import asyncio
from app.core.database import get_collection, connect_db

async def check():
    await connect_db()
    users_col = get_collection("users")
    user = await users_col.find_one()
    if user:
        print(f"DEBUG: Found User ID: {user['_id']} ({user.get('name')})")
        contacts_col = get_collection("emergency_contacts")
        contacts = await contacts_col.find({"user_id": user["_id"]}).to_list(length=10)
        print(f"DEBUG: Found {len(contacts)} contacts for this user.")
        for c in contacts:
            print(f"  - {c.get('name')}: {c.get('phone')}")
    else:
        print("DEBUG: No users found in database.")

if __name__ == "__main__":
    asyncio.run(check())
