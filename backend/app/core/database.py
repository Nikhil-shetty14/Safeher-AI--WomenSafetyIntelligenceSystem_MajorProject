from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from loguru import logger

client: AsyncIOMotorClient = None


async def connect_db():
    global client
    try:
        client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            tlsAllowInvalidCertificates=True,
        )
        await client.admin.command("ping")
        logger.info("Connected to MongoDB Atlas successfully")
    except Exception as e:
        logger.warning(f"MongoDB connection failed: {e}. Running with limited functionality.")
        client = None


async def close_db():
    global client
    if client:
        client.close()
        logger.info("MongoDB connection closed")


def get_database():
    if client is None:
        return None
    return client[settings.DATABASE_NAME]


def get_collection(collection_name: str):
    db = get_database()
    if db is None:
        return None
    return db[collection_name]
