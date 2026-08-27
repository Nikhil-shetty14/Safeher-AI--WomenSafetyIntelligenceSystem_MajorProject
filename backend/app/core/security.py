from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings
from app.core.database import get_collection
from loguru import logger

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
import bcrypt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    collection = get_collection("users")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user = await collection.find_one({"_id": user_id})
    if user is None:
        # Try by email
        email = payload.get("email")
        user = await collection.find_one({"email": email})

    if user is None:
        raise credentials_exception

    return user


async def get_current_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "super_admin", "regional_admin", "district_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

async def log_admin_action(admin_id: str, admin_email: str, action: str, target_id: Optional[str] = None, details: Optional[str] = None):
    try:
        collection = get_collection("admin_logs")
        if collection is not None:
            import uuid
            log_doc = {
                "_id": str(uuid.uuid4()),
                "admin_id": admin_id,
                "admin_email": admin_email,
                "action": action,
                "target_id": target_id,
                "details": details,
                "created_at": datetime.utcnow()
            }
            await collection.insert_one(log_doc)
    except Exception as e:
        logger.error(f"Failed to log admin action: {e}")
