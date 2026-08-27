from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.models.alert import SOSAlertCreate, SOSAlertResponse, LocationData, SOSAlertTriggerResponse
from app.services.alert_service import (
    create_sos_alert, get_active_alerts, get_user_alerts,
    resolve_alert, format_alert_response
)
from app.ai.llm_engine import analyze_text_for_danger, analyze_audio_intelligence
from app.ai.voice_analyzer import transcribe_audio, analyze_voice_stress
from app.core.security import get_current_user, get_current_admin
from app.core.config import settings
from app.websockets.socket_manager import broadcast_to_admins
from app.core.database import get_collection
from app.api.routes.admin import get_alert_filter
from loguru import logger
import os, uuid, aiofiles, traceback, shutil
from fastapi import Body

router = APIRouter(prefix="/api/sos", tags=["SOS Alerts"])


@router.post("/trigger", response_model=SOSAlertTriggerResponse)
async def trigger_sos(
    alert_data: SOSAlertCreate,
    current_user: dict = Depends(get_current_user)
):
    """Trigger an SOS alert manually with full exception safety."""
    ai_fallback_used = False
    sms_status = "success"
    alert_doc = None
    
    try:
        logger.info(f"SOS TRIGGERED | User: {current_user.get('name')} ({current_user.get('_id')}) | Type: {alert_data.trigger_type}")
        alert_data.user_id = current_user["_id"]

        # Quick AI analysis to generate Tactical Intelligence for EVERY trigger
        ai_analysis = None
        message_to_analyze = alert_data.message or f"User triggered an emergency {alert_data.trigger_type} SOS alert."
        try:
            ai_analysis = await analyze_text_for_danger(message_to_analyze, alert_data.location.dict())
            if ai_analysis and ai_analysis.get("fallback_active"):
                ai_fallback_used = True
        except Exception as ai_err:
            logger.error(f"SOS AI ERROR: {str(ai_err)}")
            traceback.print_exc()
            ai_fallback_used = True
            ai_analysis = {
                "danger_level": "HIGH",
                "risk_score": 85,
                "emotion": "panic",
                "summary": f"User triggered a critical {alert_data.trigger_type} SOS alert.",
                "recommended_action": ["Attempt immediate contact verification", "Dispatch responders"],
                "fallback_active": True,
                "fallback_reason": str(ai_err)
            }

        # Check emergency contacts to determine SMS status baseline
        try:
            contacts_col = get_collection("emergency_contacts")
            if contacts_col is not None:
                contacts = await contacts_col.find({"user_id": current_user["_id"]}).to_list(length=10)
                if not contacts:
                    sms_status = "no_contacts_configured"
                    logger.warning(f"No emergency contacts configured for user {current_user.get('name')}")
            else:
                sms_status = "database_unavailable"
        except Exception as contacts_err:
            logger.error(f"SOS Contacts check failed: {str(contacts_err)}")
            sms_status = "error_checking_contacts"

        # Create the alert record
        alert = await create_sos_alert(alert_data, ai_analysis)
        alert_doc = await format_alert_response(alert)

        # Format location safely for JSON/Socket.IO serialization
        try:
            from datetime import datetime
            loc = alert["location"]
            timestamp = loc.get("timestamp")
            if isinstance(timestamp, datetime):
                timestamp = timestamp.isoformat()
            elif timestamp:
                timestamp = str(timestamp)
                
            location_payload = {
                "latitude": loc["latitude"],
                "longitude": loc["longitude"],
                "accuracy": loc.get("accuracy"),
                "address": loc.get("address"),
                "timestamp": timestamp,
            }

            # Broadcast via WebSocket to admins
            await broadcast_to_admins("new_sos_alert", {
                "alert_id": alert["_id"],
                "user_id": alert["user_id"],
                "user_name": current_user.get("name"),
                "severity": alert["severity"],
                "location": location_payload,
            })

            # Broadcast Tactical Intelligence Update
            if ai_analysis:
                recommendations = ai_analysis.get("recommendations") or ai_analysis.get("recommended_action")
                if isinstance(recommendations, str):
                    recommendations = [recommendations]
                elif not recommendations:
                    recommendations = ["Dispatch responders immediately."]
                    
                intelligence = {
                    "risk_score": ai_analysis.get("risk_score", 85),
                    "danger_level": ai_analysis.get("danger_level", "HIGH"),
                    "ai_tactical_summary": ai_analysis.get("ai_tactical_summary") or ai_analysis.get("summary") or f"Emergency {alert_data.trigger_type} SOS triggered.",
                    "recommendations": recommendations,
                }
                
                await broadcast_to_admins("tactical_intel_update", {
                    "alert_id": alert["_id"],
                    "user_name": current_user.get("name"),
                    "transcript": message_to_analyze,
                    "intelligence": intelligence,
                    "timestamp": timestamp
                })
        except Exception as ws_err:
            logger.error(f"SOS WebSocket Broadcast failed: {str(ws_err)}")
            traceback.print_exc()

        return {
            "success": True,
            "message": "SOS triggered successfully",
            "ai_fallback_used": ai_fallback_used,
            "sms_status": sms_status,
            "alert": alert_doc
        }
    except Exception as e:
        logger.error(f"SOS TRIGGER CRITICAL ERROR: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "message": f"SOS trigger failed internally: {str(e)}",
            "ai_fallback_used": True,
            "sms_status": "failed",
            "alert": None
        }


@router.post("/trigger-test")
async def trigger_sos_test(
    user_id: str = Body(...),
    latitude: float = Body(None),
    longitude: float = Body(None),
    message: str = Body(None),
):
    """DEV-ONLY: Trigger an SOS for a user without 2FA. Enabled only when DEV_TEST=1."""
    if os.environ.get("DEV_TEST") != "1":
        raise HTTPException(status_code=403, detail="Dev test endpoint disabled")

    try:
        loc = None
        if latitude is not None and longitude is not None:
            loc = LocationData(latitude=latitude, longitude=longitude)
        else:
            loc = LocationData(latitude=0.0, longitude=0.0)

        alert_data = SOSAlertCreate(
            user_id=user_id,
            trigger_type="dev_test",
            location=loc,
            message=message,
        )

        alert = await create_sos_alert(alert_data, None)
        # Broadcast so admins receive it (uses broadcast_to_admins which now filters by area)
        try:
            from datetime import datetime
            location_payload = {
                "latitude": alert["location"].get("latitude"),
                "longitude": alert["location"].get("longitude"),
                "accuracy": alert["location"].get("accuracy"),
                "address": alert["location"].get("address"),
                "timestamp": alert["location"].get("timestamp"),
            }
            await broadcast_to_admins("new_sos_alert", {
                "alert_id": alert["_id"],
                "user_id": alert["user_id"],
                "user_name": "(dev-test)",
                "severity": alert["severity"],
                "location": location_payload,
            })
        except Exception:
            logger.exception("Failed broadcasting dev test alert")

        return {"success": True, "alert": alert}
    except Exception as e:
        logger.error(f"DEV TEST SOS failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
            "timestamp": datetime.utcnow().isoformat(),
            "source": "voice",
            "audio_url": f"/api/sos/audio/{alert['_id']}"
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
    current_admin: dict = Depends(get_current_admin)
):
    """Get all active SOS alerts (admin only)."""
    alerts_col = get_collection("alerts")
    if alerts_col is None:
        return []
    query = {"status": "active", **get_alert_filter(current_admin)}
    cursor = alerts_col.find(query).sort([("priority_score", -1), ("created_at", -1)]).skip(skip).limit(limit)
    alerts = await cursor.to_list(length=limit)
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
    # Find the log in voice_logs or alerts safely
    voice_logs = get_collection("voice_logs")
    log = None
    if voice_logs is not None:
        log = await voice_logs.find_one({"alert_id": alert_id})

    if not log or not log.get("audio_path"):
        # Try finding in alerts safely
        alerts_col = get_collection("alerts")
        alert = None
        if alerts_col is not None:
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
