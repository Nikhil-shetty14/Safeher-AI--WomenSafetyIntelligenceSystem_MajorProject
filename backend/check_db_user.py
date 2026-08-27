import asyncio
from app.core.database import get_collection
from bson import json_util
import json

async def main():
    col = get_collection("users")
    user = await col.find_one({}, sort=[("created_at", -1)])
    print(json.dumps(user, default=json_util.default, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
