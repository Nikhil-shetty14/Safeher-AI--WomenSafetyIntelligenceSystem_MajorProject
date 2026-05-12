from fastapi import APIRouter, HTTPException, Depends, status
from app.models.user import UserCreate, UserLogin, UserUpdate, UserResponse, TokenResponse
from app.services.user_service import (
    create_user, authenticate_user, get_user_by_id, update_user, format_user_response
)
from app.core.security import create_access_token, get_current_user
from loguru import logger

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """Register a new user."""
    user = await create_user(user_data)
    token = create_access_token({"sub": user["_id"], "email": user["email"], "role": user["role"]})
    return {"access_token": token, "token_type": "bearer", "user": format_user_response(user)}


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password."""
    user = await authenticate_user(credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active"):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token({"sub": user["_id"], "email": user["email"], "role": user["role"]})
    logger.info(f"User logged in: {credentials.email}")
    return {"access_token": token, "token_type": "bearer", "user": format_user_response(user)}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current authenticated user profile."""
    return format_user_response(current_user)


@router.put("/me", response_model=UserResponse)
async def update_profile(update_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update current user profile."""
    updated = await update_user(current_user["_id"], update_data)
    return format_user_response(updated)


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout (client should discard token)."""
    return {"message": "Logged out successfully"}
