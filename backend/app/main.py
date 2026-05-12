from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import os

from app.core.config import settings
from app.core.database import connect_db, close_db
from app.websockets.socket_manager import sio
from app.api.routes import auth, sos, contacts, ai, location, admin
from loguru import logger

# Configure loguru
logger.add("logs/safeher_{time}.log", rotation="1 day", retention="7 days", level="INFO")

# FastAPI app
app = FastAPI(
    title="SafeHer AI API",
    description="AI-powered women's safety backend with real-time SOS, GPS tracking, and intelligent threat detection.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS - Allow all in development to fix persistent connection issues
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(sos.router)
app.include_router(contacts.router)
app.include_router(ai.router)
app.include_router(location.router)
app.include_router(admin.router)

# Static files (audio uploads)
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs("logs", exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


@app.on_event("startup")
async def startup():
    await connect_db()
    
    # Validate Twilio Configuration
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN or not settings.TWILIO_PHONE_NUMBER:
        logger.error("Twilio credentials missing in .env! Emergency calls/SMS will be mocked.")
    else:
        logger.info("Twilio configuration loaded successfully")
        
    # Validate OpenAI Configuration
    if not settings.OPENAI_API_KEY:
        logger.error("OPENAI_API_KEY missing in .env! AI features will use local mock fallback.")
    else:
        logger.info("OpenAI configuration loaded successfully")

    logger.info(f"SafeHer AI Backend started | Version {settings.APP_VERSION}")


@app.on_event("shutdown")
async def shutdown():
    await close_db()
    logger.info("SafeHer AI Backend shutdown complete")


@app.get("/")
async def root():
    return {
        "app": "SafeHer AI",
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "app": "SafeHer AI"}


# Mount Socket.IO app
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")
