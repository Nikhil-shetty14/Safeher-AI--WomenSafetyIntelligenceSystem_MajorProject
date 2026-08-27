import sys

with open("c:/Users/nikhi/OneDrive/Desktop/SafeherApp/backend/app/api/routes/auth.py", "r") as f:
    content = f.read()

endpoints = """
@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    \"\"\"
    Initiate password reset flow by sending OTP to the registered phone number.
    \"\"\"
    users_collection = get_collection("users")
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    user = await users_collection.find_one({"phone": payload.phone})
    if not user:
        # Don't reveal whether user exists for security, just pretend it sent
        raise HTTPException(status_code=404, detail="If this number is registered, an OTP will be sent.")

    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")

    try:
        otp_res = await send_otp(payload.phone)
    except Exception as e:
        logger.error(f"Failed to send OTP during forgot password: {e}")
        raise HTTPException(status_code=500, detail="Failed to send verification code. Please try again.")

    pending_collection = get_collection("pending_sessions")
    session_id = str(uuid.uuid4())
    now = datetime.utcnow()

    session_doc = {
        "_id": session_id,
        "action": "forgot_password",
        "phone": payload.phone,
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
    logger.info(f"Forgot password session created for {payload.phone} | Session: {session_id}")

    return {
        "status": "2fa_pending",
        "session_id": session_id,
        "phone": mask_phone_number(payload.phone),
    }


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    \"\"\"
    Verify OTP and reset the password.
    \"\"\"
    pending_collection = get_collection("pending_sessions")
    if pending_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    session = await pending_collection.find_one({"_id": payload.session_id})
    if not session or session["action"] != "forgot_password":
        raise HTTPException(status_code=404, detail="Verification session not found or has expired.")

    if datetime.utcnow() > session["expires_at"]:
        await pending_collection.delete_one({"_id": payload.session_id})
        raise HTTPException(status_code=400, detail="Verification code has expired. Please try again.")

    if session["attempts"] >= 3:
        await pending_collection.delete_one({"_id": payload.session_id})
        raise HTTPException(status_code=400, detail="Too many incorrect attempts. This session has been blocked.")

    is_valid = await verify_otp(session["phone"], payload.otp_code, session)

    if not is_valid:
        await pending_collection.update_one(
            {"_id": payload.session_id},
            {"$inc": {"attempts": 1}}
        )
        attempts_left = 2 - session["attempts"]
        if attempts_left <= 0:
            await pending_collection.delete_one({"_id": payload.session_id})
            raise HTTPException(status_code=400, detail="Invalid verification code. Maximum attempts reached.")
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {attempts_left} attempts remaining.")

    users_collection = get_collection("users")
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Update password
    hashed_password = get_password_hash(payload.new_password)
    await users_collection.update_one(
        {"_id": session["user_id"]},
        {"$set": {"hashed_password": hashed_password, "updated_at": datetime.utcnow()}}
    )

    # Clean up
    await pending_collection.delete_one({"_id": payload.session_id})
    logger.info(f"Password reset successful for {session['phone']}")

    return {"message": "Password reset successfully"}


"""

content = content.replace('@router.get("/me", response_model=UserResponse)', endpoints + '@router.get("/me", response_model=UserResponse)')

with open("c:/Users/nikhi/OneDrive/Desktop/SafeherApp/backend/app/api/routes/auth.py", "w") as f:
    f.write(content)
