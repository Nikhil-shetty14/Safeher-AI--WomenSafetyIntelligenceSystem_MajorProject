import asyncio
from app.core.database import connect_db, close_db, get_collection

async def main():
    await connect_db()
    try:
        users_col = get_collection("users")
        
        # Find users with 'Mysuru' instead of 'Mysuru Division' (case-insensitive)
        cursor = users_col.find({})
        async for user in cursor:
            div = user.get("division")
            if div and isinstance(div, str) and not div.endswith(" Division"):
                # E.g. 'Mysuru' -> 'Mysuru Division', 'Bangalore' -> 'Bangalore Division'
                # but handle specific cases if they exist
                new_div = div.strip()
                if new_div.lower() == "bengaluru":
                    new_div = "Bangalore"
                new_div += " Division"
                
                await users_col.update_one({"_id": user["_id"]}, {"$set": {"division": new_div}})
                print(f"Updated user {user.get('name')}: {div} -> {new_div}")
                
        print("Data normalization complete.")
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        await close_db()

if __name__ == "__main__":
    asyncio.run(main())
