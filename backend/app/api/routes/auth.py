from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import uuid
from app.models.user import UserCreate, UserLogin, UserUpdate, UserResponse
from app.services.user_service import (
    authenticate_user, update_user, format_user_response
)
from app.services.twilio_service import send_otp, verify_otp
from app.core.security import create_access_token, get_current_user, get_password_hash
from app.core.database import get_collection
from loguru import logger

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


class VerifyOTPRequest(BaseModel):
    session_id: str
    code: str


class ResendOTPRequest(BaseModel):
    session_id: str


def mask_phone_number(phone: str) -> str:
    """Mask phone number to protect user privacy on the client side."""
    if not phone:
        return ""
    clean_phone = "".join(c for c in phone if c.isdigit() or c == "+")
    if len(clean_phone) >= 10:
        return clean_phone[:3] + "******" + clean_phone[-4:]
    return clean_phone


@router.post("/register")
async def register(user_data: UserCreate):
    """
    Step 1 of Signup: Validate user details and send an OTP code
    to the registered phone number.
    """
    users_collection = get_collection("users")
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Check if phone is already taken
    existing_user = await users_collection.find_one({"phone": user_data.phone})
    if existing_user:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    # Send OTP to user's phone number
    try:
        otp_res = await send_otp(user_data.phone)
    except Exception as e:
        logger.error(f"Failed to send OTP during signup: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code. Please try again.")

    # Create a secure pending session to hold registration data
    pending_collection = get_collection("pending_sessions")
    if pending_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    session_id = str(uuid.uuid4())
    now = datetime.utcnow()
    
    session_doc = {
        "_id": session_id,
        "action": "signup",
        "phone": user_data.phone,
        "user_data": {
            "name": user_data.name,
            "phone": user_data.phone,
            # Hash password immediately to maintain strict security
            "hashed_password": get_password_hash(user_data.password),
            "age": user_data.age,
            "gender": user_data.gender,
            "address": user_data.address,
        },
        "verification_method": otp_res["method"],
        "otp_code": otp_res.get("code"),
        "verification_sid": otp_res.get("verification_sid"),
        "attempts": 0,
        "resends_count": 0,
        "last_sent_at": now,
        "created_at": now,
        "expires_at": now + timedelta(minutes=5),
    }

    await pending_collection.insert_one(session_doc)
    
    logger.info(f"2FA signup session created for {user_data.phone} | Session: {session_id}")
    
    return {
        "status": "2fa_pending",
        "session_id": session_id,
        "phone": mask_phone_number(user_data.phone),
    }


@router.post("/login")
async def login(credentials: UserLogin):
    """
    Step 1 of Login: Verify credentials and send an OTP code
    to the registered phone number.
    """
    # 1. Authenticate user credentials first
    user = await authenticate_user(credentials.phone, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    # 2. Trigger OTP dispatch to their registered phone number
    try:
        otp_res = await send_otp(user["phone"])
    except Exception as e:
        logger.error(f"Failed to send OTP during login: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code. Please try again.")

    # 3. Create a pending login session in MongoDB
    pending_collection = get_collection("pending_sessions")
    if pending_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    session_id = str(uuid.uuid4())
    now = datetime.utcnow()

    session_doc = {
        "_id": session_id,
        "action": "login",
        "phone": user["phone"],
        "user_id": user["_id"],
        "verification_method": otp_res["method"],
        "otp_code": otp_res.get("code"),
        "verification_sid": otp_res.get("verification_sid"),
        "attempts": 0,
        "resends_count": 0,
        "last_sent_at": now,
        "created_at": now,
        "expires_at": now + timedelta(minutes=5),
    }

    await pending_collection.insert_one(session_doc)

    logger.info(f"2FA login session created for {credentials.phone} | Session: {session_id}")

    return {
        "status": "2fa_pending",
        "session_id": session_id,
        "phone": mask_phone_number(user["phone"]),
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(payload: VerifyOTPRequest):
    """
    Step 2: Validate the OTP code and generate a JWT access token on success.
    Supports a standard 3-attempt validation failure limit.
    """
    pending_collection = get_collection("pending_sessions")
    if pending_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # 1. Fetch pending session
    session = await pending_collection.find_one({"_id": payload.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or has expired.")

    # 2. Verify expiration
    if datetime.utcnow() > session["expires_at"]:
        await pending_collection.delete_one({"_id": payload.session_id})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please try again.")

    # 3. Rate limiting: verify validation attempts
    if session["attempts"] >= 3:
        await pending_collection.delete_one({"_id": payload.session_id})
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. This session has been blocked.")

    # 4. Check OTP code
    is_valid = await verify_otp(session["phone"], payload.code, session)

    if not is_valid:
        # Increment attempt counter
        await pending_collection.update_one(
            {"_id": payload.session_id},
            {"$inc": {"attempts": 1}}
        )
        attempts_left = 2 - session["attempts"]
        if attempts_left <= 0:
            await pending_collection.delete_one({"_id": payload.session_id})
            raise HTTPException(status_code=400, detail="Invalid verification code. Maximum attempts reached. Session blocked.")
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {attempts_left} attempts remaining.")

    # OTP is verified! Proceed with finalizing the flow
    user = None
    if session["action"] == "signup":
        users_collection = get_collection("users")
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        # Double check phone uniqueness again to avoid race conditions
        existing_user = await users_collection.find_one({"phone": session["phone"]})
        if existing_user:
            await pending_collection.delete_one({"_id": payload.session_id})
            raise HTTPException(status_code=400, detail="Phone number already registered")

        user_data = session["user_data"]
        user_id = str(uuid.uuid4())
        now = datetime.utcnow()

        user_doc = {
            "_id": user_id,
            "name": user_data["name"],
            "phone": user_data["phone"],
            "hashed_password": user_data["hashed_password"],
            "role": "user",
            "is_active": True,
            "age": user_data.get("age"),
            "gender": user_data.get("gender"),
            "address": user_data.get("address"),
            "profile_image": None,
            "blood_group": None,
            "medical_conditions": None,
            "allergies": None,
            "fcm_token": None,
            "safety_preferences": {
                "sos_auto_activation": False,
                "shake_detection": False,
                "voice_triggered_sos": False,
                "hidden_sos_mode": False,
                "live_tracking_enabled": True
            },
            "notification_settings": {
                "sms_alerts": True,
                "emergency_calls": True,
                "push_notifications": True,
                "notification_sounds": True
            },
            "security_settings": {
                "biometric_login": False,
                "two_factor_auth": True
            },
            "created_at": now,
            "updated_at": now,
        }

        await users_collection.insert_one(user_doc)
        user = user_doc
        logger.info(f"User registered successfully after 2FA: {user['phone']}")
    else:
        # login flow
        users_collection = get_collection("users")
        if users_collection is None:
            raise HTTPException(status_code=503, detail="Database unavailable")

        user = await users_collection.find_one({"_id": session["user_id"]})
        if not user:
            raise HTTPException(status_code=404, detail="User profile not found")
        logger.info(f"User logged in successfully after 2FA: {user['phone']}")

    # Clean up the completed session
    await pending_collection.delete_one({"_id": payload.session_id})

    # 5. Generate secure JWT token
    token = create_access_token({"sub": user["_id"], "phone": user["phone"], "role": user.get("role", "user")})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": format_user_response(user)
    }


@router.post("/resend-otp")
async def resend_otp_endpoint(payload: ResendOTPRequest):
    """
    Resend OTP to the registered phone number.
    Enforces a 60-second cooldown and a maximum of 3 resends.
    """
    pending_collection = get_collection("pending_sessions")
    if pending_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # 1. Fetch pending session
    session = await pending_collection.find_one({"_id": payload.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Verification session not found or has expired.")

    # 2. Expiry check
    if datetime.utcnow() > session["expires_at"]:
        await pending_collection.delete_one({"_id": payload.session_id})
        raise HTTPException(status_code=400, detail="Verification session expired. Please start over.")

    # 3. Cooling period check (60 seconds)
    now = datetime.utcnow()
    last_sent = session["last_sent_at"]
    elapsed = (now - last_sent).total_seconds()
    if elapsed < 60:
        time_left = int(60 - elapsed)
        raise HTTPException(
            status_code=429,
            detail=f"Please wait {time_left} seconds before requesting a new code."
        )

    # 4. Maximum resends constraint
    resends = session.get("resends_count", 0)
    if resends >= 3:
        raise HTTPException(
            status_code=400,
            detail="Maximum resend attempts exceeded. Please restart the signup or login flow."
        )

    # 5. Resend code
    try:
        otp_res = await send_otp(session["phone"])
    except Exception as e:
        logger.error(f"Failed to resend OTP code: {e}")
        raise HTTPException(status_code=500, detail="Failed to resend verification code. Please try again.")

    # Update session details
    update_data = {
        "verification_method": otp_res["method"],
        "otp_code": otp_res.get("code"),
        "verification_sid": otp_res.get("verification_sid"),
        "last_sent_at": now,
        "expires_at": now + timedelta(minutes=5),
        "attempts": 0,  # Reset validation attempts for the new code
    }

    await pending_collection.update_one(
        {"_id": payload.session_id},
        {
            "$set": update_data,
            "$inc": {"resends_count": 1}
        }
    )

    logger.info(f"Resent OTP code successfully for session: {payload.session_id}")
    return {"message": "Verification code resent successfully"}


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
