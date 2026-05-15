from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks, Form
from app.models.alert import SOSAlertCreate, SOSAlertResponse, LocationData
from app.services.alert_service import (
    create_sos_alert, get_active_alerts, get_user_alerts,
    resolve_alert, format_alert_response
)
from app.ai.llm_engine import analyze_text_for_danger, analyze_audio_intelligence
from app.ai.voice_analyzer import transcribe_audio, analyze_voice_stress
from app.core.security import get_current_user, get_current_admin
from app.core.config import settings
from app.websockets.socket_manager import broadcast_to_admins
from loguru import logger
import os, uuid, aiofiles, traceback, shutil

router = APIRouter(prefix="/api/sos", tags=["SOS Alerts"])


@router.post("/trigger", response_model=SOSAlertResponse)
async def trigger_sos(
    alert_data: SOSAlertCreate,
    current_user: dict = Depends(get_current_user)
):
    """Trigger an SOS alert manually."""
    alert_data.user_id = current_user["_id"]

    # Quick AI analysis if message provided
    ai_analysis = None
    if alert_data.message:
        ai_analysis = await analyze_text_for_danger(alert_data.message, alert_data.location.dict())

    alert = await create_sos_alert(alert_data, ai_analysis)

    # Broadcast via WebSocket to admins
    await broadcast_to_admins("new_sos_alert", {
        "alert_id": alert["_id"],
        "user_id": alert["user_id"],
        "user_name": current_user.get("name"),
        "severity": alert["severity"],
        "location": alert["location"],
    })

    return await format_alert_response(alert)


@router.post("/trigger-voice")
@router.post("/upload-audio")
async def trigger_sos_with_voice(
    user_id: str = Form("unknown"),
    latitude: str = Form("0.0"),
    longitude: str = Form("0.0"),
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Trigger SOS with voice recording for AI analysis."""
    try:
        logger.info(f"UPLOAD ATTEMPT | User: {current_user.get('name')} | File: {audio.filename}")
        
        # Parse coordinates safely
        try:
            lat = float(latitude)
            lng = float(longitude)
        except:
            lat, lng = 0.0, 0.0

        # Save audio using robust shutil method
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        audio_id = str(uuid.uuid4())
        ext = os.path.splitext(audio.filename)[1] or ".m4a"
        audio_path = os.path.join(settings.UPLOAD_DIR, f"{audio_id}{ext}")

        logger.info(f"SAVING TO: {audio_path}")
        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        logger.success(f"FILE SAVED | Size: {os.path.getsize(audio_path)} bytes")

        # AI analysis pipeline: Transcription + Acoustic Analysis
        transcript = await transcribe_audio(audio_path)
        acoustic_analysis = await analyze_voice_stress(audio_path)
        
        # Advanced Intelligence Analysis via GPT-4
        intelligence = await analyze_audio_intelligence(
            transcript or "", 
            acoustic_analysis, 
            {"latitude": lat, "longitude": lng}
        )

        location = LocationData(latitude=lat, longitude=lng)
        alert_data = SOSAlertCreate(
            user_id=current_user["_id"],
            trigger_type="voice_intelligence",
            location=location,
            message=transcript,
            audio_file_path=audio_path,
        )

        alert = await create_sos_alert(alert_data, intelligence)

        # Broadcast TACTICAL INTEL to admins in real-time
        from datetime import datetime
        await broadcast_to_admins("tactical_intel_update", {
            "alert_id": alert["_id"],
            "user_name": current_user.get("name"),
            "transcript": transcript,
            "intelligence": intelligence,
            "timestamp": datetime.utcnow().isoformat()
        })

        return {
            "success": True,
            "alert": await format_alert_response(alert),
            "intelligence": intelligence,
            "transcript": transcript
        }

    except Exception as e:
        logger.error(f"CRITICAL UPLOAD ERROR: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }


@router.get("/active")
async def get_active_sos(
    skip: int = 0,
    limit: int = 50,
    _: dict = Depends(get_current_admin)
):
    """Get all active SOS alerts (admin only)."""
    alerts = await get_active_alerts(skip, limit)
    return [await format_alert_response(a) for a in alerts]


@router.get("/my-alerts")
async def get_my_alerts(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's alert history."""
    alerts = await get_user_alerts(current_user["_id"], skip, limit)
    return [await format_alert_response(a) for a in alerts]


@router.patch("/{alert_id}/resolve")
async def resolve_sos_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resolve an active SOS alert."""
    alert = await resolve_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return await format_alert_response(alert)


@router.get("/audio/{alert_id}")
async def get_emergency_audio(alert_id: str, current_admin: dict = Depends(get_current_admin)):
    """Serve emergency audio evidence (admin only)."""
    # Find the log in voice_logs or alerts
    voice_logs = get_collection("voice_logs")
    log = await voice_logs.find_one({"alert_id": alert_id})
    if not log or not log.get("audio_path"):
        # Try finding in alerts
        alerts_col = get_collection("alerts")
        alert = await alerts_col.find_one({"_id": alert_id})
        if not alert or not alert.get("audio_file_path"):
            raise HTTPException(status_code=404, detail="Audio evidence not found")
        path = alert["audio_file_path"]
    else:
        path = log["audio_path"]

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file missing on server")
    
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type="audio/wav")
