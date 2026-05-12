import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def test_conn():
    load_dotenv()
    url = os.getenv("MONGODB_URL")
    result = ""
    try:
        client = AsyncIOMotorClient(url, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        result = "CONNECTED"
    except Exception as e:
        result = f"FAILED: {e}"
    finally:
        client.close()
    
    with open("db_status.log", "w") as f:
        f.write(result)

if __name__ == "__main__":
    asyncio.run(test_conn())
