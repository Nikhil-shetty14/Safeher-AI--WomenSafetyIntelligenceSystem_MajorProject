import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

async def test_conn():
    load_dotenv()
    url = os.getenv("MONGODB_URL")
    print(f"Testing connection to: {url}")
    try:
        client = AsyncIOMotorClient(url, tlsAllowInvalidCertificates=True, serverSelectionTimeoutMS=3000)
        await client.admin.command("ping")
        print("SUCCESS: Database is connected!")
    except Exception as e:
        print(f"FAILURE: Could not connect to database. Error: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_conn())
