from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from app.models.alert import SOSAlertCreate, SOSAlertResponse, LocationData
from app.services.alert_service import (
    create_sos_alert, get_active_alerts, get_user_alerts,
    resolve_alert, format_alert_response
)
from app.ai.llm_engine import analyze_text_for_danger
from app.ai.voice_analyzer import transcribe_audio, analyze_voice_stress
from app.core.security import get_current_user, get_current_admin
from app.core.config import settings
from app.websockets.socket_manager import broadcast_to_admins
from loguru import logger
import os, uuid, aiofiles

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
async def trigger_sos_with_voice(
    user_id: str,
    latitude: float,
    longitude: float,
    audio: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Trigger SOS with voice recording for AI analysis."""
    # Save audio
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    audio_id = str(uuid.uuid4())
    audio_path = os.path.join(settings.UPLOAD_DIR, f"{audio_id}.wav")

    async with aiofiles.open(audio_path, "wb") as f:
        content = await audio.read()
        await f.write(content)

    # AI analysis pipeline
    transcript = await transcribe_audio(audio_path)
    voice_analysis = await analyze_voice_stress(audio_path)
    text_analysis = await analyze_text_for_danger(transcript or "", {"latitude": latitude, "longitude": longitude})

    # Merge analyses
    combined_danger = max(
        voice_analysis.get("danger_level", "low"),
        text_analysis.get("danger_level", "low"),
        key=lambda x: ["safe", "low", "medium", "high", "critical"].index(x)
    )

    location = LocationData(latitude=latitude, longitude=longitude)
    alert_data = SOSAlertCreate(
        user_id=current_user["_id"],
        trigger_type="voice",
        location=location,
        message=transcript,
        audio_file_path=audio_path,
    )

    merged_analysis = {**text_analysis, "voice": voice_analysis, "transcript": transcript, "danger_level": combined_danger}
    alert = await create_sos_alert(alert_data, merged_analysis)

    return {
        "alert": await format_alert_response(alert),
        "transcript": transcript,
        "voice_analysis": voice_analysis,
        "text_analysis": text_analysis,
        "combined_danger_level": combined_danger,
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
