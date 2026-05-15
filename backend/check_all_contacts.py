import asyncio
from app.core.database import get_collection, connect_db

async def check():
    await connect_db()
    users_col = get_collection("users")
    contacts_col = get_collection("emergency_contacts")
    
    users = await users_col.find().to_list(length=100)
    print(f"DEBUG: Found {len(users)} users in database.")
    
    for user in users:
        print(f"\nUser: {user.get('name')} (ID: {user['_id']})")
        contacts = await contacts_col.find({"user_id": user["_id"]}).to_list(length=10)
        print(f"  Contacts ({len(contacts)}):")
        for c in contacts:
            print(f"    - {c.get('name')}: {c.get('phone')} (Primary: {c.get('is_primary')})")

if __name__ == "__main__":
    asyncio.run(check())
