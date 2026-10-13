from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from app.models.alert import SOSAlertCreate, SOSAlertResponse, LocationData, SOSAlertTriggerResponse
from app.services.alert_service import (
    create_sos_alert, get_active_alerts, get_user_alerts,
    resolve_alert, format_alert_response, acknowledge_alert
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
    """Trigger an SOS alert manually with full exception safety and duplicate prevention."""
    ai_fallback_used = False
    sms_status = "success"
    alert_doc = None
    
    try:
        logger.info(f"SOS TRIGGERED | User: {current_user.get('name')} ({current_user.get('_id')}) | Type: {alert_data.trigger_type}")
        alert_data.user_id = current_user["_id"]

        # Duplicate Prevention: If an active SOS alert already exists for this user, return it
        alerts_col = get_collection("alerts")
        if alerts_col is not None:
            existing_active = await alerts_col.find_one(
                {"user_id": current_user["_id"], "status": "active"},
                sort=[("created_at", -1)]
            )
            if existing_active:
                logger.info(f"Active SOS already exists for user {current_user.get('name')}: {existing_active['_id']}. Reusing active incident.")
                alert_doc = await format_alert_response(existing_active)
                return {
                    "success": True,
                    "message": "Emergency SOS already active",
                    "ai_fallback_used": False,
                    "sms_status": "already_active",
                    "alert": alert_doc
                }

        # Quick AI analysis / deterministic synthesis
        ai_analysis = None
        message_to_analyze = alert_data.message or f"User triggered an emergency {alert_data.trigger_type} SOS alert."
        try:
            ai_analysis = await analyze_text_for_danger(message_to_analyze, alert_data.location.dict())
            if ai_analysis and ai_analysis.get("fallback_active"):
                ai_fallback_used = True
        except Exception as ai_err:
            logger.error(f"SOS AI ERROR: {str(ai_err)}")
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

        # Create the alert record immediately (dispatches SMS/calls in parallel background task)
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
                "district": loc.get("district"),
                "division": loc.get("division"),
                "timestamp": timestamp,
            }

            # Broadcast via WebSocket to admins
            await broadcast_to_admins("new_sos_alert", {
                "alert_id": alert["_id"],
                "user_id": alert["user_id"],
                "user_name": current_user.get("name"),
                "user_phone": current_user.get("phone"),
                "severity": alert["severity"],
                "location": location_payload,
                "trigger_type": alert.get("trigger_type", "button"),
                "message": alert.get("message"),
                "status": "active",
                "acknowledged": False,
                "created_at": timestamp,
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
        try:
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
    """
    Trigger Voice SOS with immediate alert creation (alerts never wait for AI).
    Runs Whisper transcription, Librosa acoustic stress analysis, and
    Ollama/keyword threat assessment to enrich the active emergency incident.
    """
    from datetime import datetime
    now_iso = datetime.utcnow().isoformat()

    try:
        logger.info(f"VOICE SOS INCOMING | User: {current_user.get('name')} | File: {audio.filename}")
        
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

        with open(audio_path, "wb") as buffer:
            shutil.copyfileobj(audio.file, buffer)
        
        logger.info(f"FILE SAVED | Path: {audio_path} | Size: {os.path.getsize(audio_path)} bytes")

        # ─── 1. DUPLICATE PREVENTION & INSTANT SOS CREATION ───
        # Emergency alerts MUST NEVER wait for AI processing!
        alerts_col = get_collection("alerts")
        alert = None
        
        if alerts_col is not None:
            existing_active = await alerts_col.find_one(
                {"user_id": current_user["_id"], "status": "active"},
                sort=[("created_at", -1)]
            )
            if existing_active:
                alert = existing_active
                logger.info(f"Attaching voice evidence to existing active alert: {alert['_id']}")
                await alerts_col.update_one(
                    {"_id": alert["_id"]},
                    {"$set": {"audio_file_path": audio_path}}
                )

        if not alert:
            # Create new emergency SOS immediately
            location = LocationData(latitude=lat, longitude=lng)
            alert_data = SOSAlertCreate(
                user_id=current_user["_id"],
                trigger_type="voice_intelligence",
                location=location,
                message="Voice SOS emergency beacon initiated. Audio evidence attached.",
                audio_file_path=audio_path,
            )
            # Create with zero-wait deterministic intelligence baseline
            alert = await create_sos_alert(alert_data, None)
            logger.info(f"INSTANT VOICE SOS ALERT CREATED: {alert['_id']}")

            # Broadcast new alert to admins immediately
            try:
                loc = alert.get("location", {})
                location_payload = {
                    "latitude": lat,
                    "longitude": lng,
                    "accuracy": loc.get("accuracy"),
                    "address": loc.get("address"),
                    "district": loc.get("district"),
                    "division": loc.get("division"),
                    "timestamp": now_iso,
                }
                await broadcast_to_admins("new_sos_alert", {
                    "alert_id": alert["_id"],
                    "user_id": alert["user_id"],
                    "user_name": current_user.get("name"),
                    "user_phone": current_user.get("phone"),
                    "severity": alert["severity"],
                    "location": location_payload,
                    "trigger_type": "voice_intelligence",
                    "message": "Voice SOS triggered",
                    "status": "active",
                    "acknowledged": False,
                    "created_at": now_iso,
                })
            except Exception as ws_e:
                logger.error(f"Voice SOS instant broadcast error: {ws_e}")

        # ─── 2. RUN AI PIPELINE: Whisper STT + Librosa + Ollama / Keyword Fallback ───
        transcript = ""
        acoustic_analysis = {}
        intelligence = {}

        try:
            transcript = await transcribe_audio(audio_path)
            logger.info(f"Whisper transcript: '{transcript}'")
        except Exception as stt_err:
            logger.error(f"Whisper STT failed: {stt_err}")
            transcript = ""

        try:
            acoustic_analysis = await analyze_voice_stress(audio_path)
            logger.info(f"Librosa stress score: {acoustic_analysis.get('stress_score')}")
        except Exception as lib_err:
            logger.error(f"Librosa acoustic analysis failed: {lib_err}")
            acoustic_analysis = {
                "stress_score": 0.85,
                "emotion": "panic/distress",
                "danger_level": "critical",
                "trigger_emergency": True
            }

        try:
            intelligence = await analyze_audio_intelligence(
                transcript or "",
                acoustic_analysis,
                {"latitude": lat, "longitude": lng}
            )
        except Exception as intel_err:
            logger.error(f"Intelligence analysis failed: {intel_err}")
            from app.ai.llm_engine import evaluate_keyword_and_acoustic_threat
            intelligence = evaluate_keyword_and_acoustic_threat(
                transcript or "",
                acoustic_analysis,
                {"latitude": lat, "longitude": lng}
            )

        # ─── 3. ENRICH ACTIVE ALERT IN MONGODB & BROADCAST TO ADMIN DASHBOARD ───
        danger_lvl = intelligence.get("danger_level", "HIGH").upper()
        severity_val = "critical" if danger_lvl == "CRITICAL" else "high"

        if alerts_col is not None:
            await alerts_col.update_one(
                {"_id": alert["_id"]},
                {"$set": {
                    "message": transcript or alert.get("message") or "Emergency Voice SOS Signal",
                    "transcript": transcript,
                    "ai_analysis": intelligence,
                    "acoustic_analysis": acoustic_analysis,
                    "audio_file_path": audio_path,
                    "severity": severity_val,
                    "priority_score": 5 if severity_val == "critical" else 4
                }}
            )

        # Refresh alert fields for response
        alert["message"] = transcript or alert.get("message")
        alert["ai_analysis"] = intelligence
        alert["severity"] = severity_val

        # Broadcast tactical intelligence update to admins in real-time
        try:
            await broadcast_to_admins("tactical_intel_update", {
                "alert_id": alert["_id"],
                "user_id": current_user.get("_id"),
                "user_name": current_user.get("name"),
                "transcript": transcript or "(Distress vocalization / background acoustic noise)",
                "intelligence": intelligence,
                "acoustic_data": acoustic_analysis,
                "timestamp": now_iso,
                "source": "voice",
                "audio_url": f"/api/sos/audio/{alert['_id']}"
            })
        except Exception as ws_err:
            logger.error(f"Tactical intel broadcast failed: {ws_err}")

        return {
            "success": True,
            "alert": await format_alert_response(alert),
            "intelligence": intelligence,
            "transcript": transcript or ""
        }

    except Exception as e:
        logger.error(f"CRITICAL VOICE SOS ERROR: {str(e)}")
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }



@router.post("/upload-evidence")
async def upload_photo_evidence(
    user_id: str = Form("unknown"),
    latitude: str = Form("0.0"),
    longitude: str = Form("0.0"),
    alert_id: str = Form(""),
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    try:
        try:
            lat = float(latitude)
            lng = float(longitude)
        except:
            lat, lng = 0.0, 0.0

        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        photo_id = str(uuid.uuid4())
        ext = os.path.splitext(photo.filename)[1] or ".jpg"
        photo_path = os.path.join(settings.UPLOAD_DIR, f"{photo_id}{ext}")

        with open(photo_path, "wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)

        evidence_col = get_collection("photo_evidence")

        # Use the alert_id from the client if provided (preferred — avoids race condition).
        # Fall back to DB lookup only if the frontend didn't send one.
        resolved_alert_id = alert_id.strip() if alert_id and alert_id.strip() else None
        if not resolved_alert_id:
            alerts_col = get_collection("alerts")
            if alerts_col is not None:
                active_alert = await alerts_col.find_one(
                    {"user_id": current_user["_id"], "status": "active"},
                    sort=[("created_at", -1)]
                )
                resolved_alert_id = str(active_alert["_id"]) if active_alert else "unknown"
            else:
                resolved_alert_id = "unknown"

        from datetime import datetime
        doc = {
            "user_id": current_user["_id"],
            "alert_id": resolved_alert_id,
            "photo_path": photo_path,
            "location": {"latitude": lat, "longitude": lng},
            "timestamp": datetime.utcnow()
        }

        if evidence_col is not None:
            result = await evidence_col.insert_one(doc)
            doc["_id"] = str(result.inserted_id)
        else:
            doc["_id"] = str(uuid.uuid4())

        doc["timestamp"] = doc["timestamp"].isoformat()
        doc["url"] = f"/uploads/{os.path.basename(photo_path)}"

        await broadcast_to_admins("new_photo_evidence", doc)

        return {"success": True, "evidence": doc}
    except Exception as e:
        logger.error(f"PHOTO EVIDENCE UPLOAD ERROR: {str(e)}")
        traceback.print_exc()
        return {"success": False, "error": str(e)}


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
    try:
        alerts = await get_user_alerts(current_user["_id"], skip, limit)
        return [await format_alert_response(a) for a in alerts]
    except Exception as e:
        return []


@router.patch("/{alert_id}/resolve")
async def resolve_sos_alert(
    alert_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resolve an active SOS alert."""
    alert = await resolve_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    try:
        await broadcast_to_admins("sos_alert_resolved", {
            "alert_id": alert_id,
            "resolved_by": current_user.get("_id")
        })
    except Exception as e:
        logger.error(f"Failed to broadcast alert resolution: {e}")
    return await format_alert_response(alert)


@router.patch("/{alert_id}/acknowledge")
async def acknowledge_sos_alert(
    alert_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    """Acknowledge an active SOS alert."""
    alert = await acknowledge_alert(alert_id, admin_id=current_admin.get("_id"))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    try:
        await broadcast_to_admins("sos_alert_acknowledged", {
            "alert_id": alert_id,
            "admin_id": current_admin.get("_id"),
            "admin_name": current_admin.get("name")
        })
    except Exception as e:
        logger.error(f"Failed to broadcast alert acknowledgement: {e}")
    return await format_alert_response(alert)


@router.get("/audio/{alert_id}")
async def get_emergency_audio(alert_id: str):
    """Serve emergency audio evidence."""
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
    ext = os.path.splitext(path)[1].lower()
    media_type = "audio/wav" if ext == ".wav" else "audio/m4a" if ext == ".m4a" else "audio/mpeg"
    return FileResponse(path, media_type=media_type)

@router.get("/evidence/photo/{evidence_id}")
async def get_photo_file(evidence_id: str):
    from bson import ObjectId
    evidence_col = get_collection("photo_evidence")
    doc = None
    if evidence_col is not None:
        try:
            doc = await evidence_col.find_one({"_id": ObjectId(evidence_id)})
        except Exception:
            pass
        if not doc:
            try:
                doc = await evidence_col.find_one({"_id": evidence_id})
            except Exception:
                pass
            
    if not doc or not doc.get("photo_path"):
        raise HTTPException(status_code=404, detail="Photo not found")
        
    path = doc["photo_path"]
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Photo file missing")
        
    from fastapi.responses import FileResponse
    return FileResponse(path, media_type="image/jpeg")

@router.get("/evidence/alert/{alert_id}")
async def get_alert_evidence(alert_id: str, current_admin: dict = Depends(get_current_admin)):
    evidence_col = get_collection("photo_evidence")
    if evidence_col is None:
        return []
    docs = await evidence_col.find({"alert_id": alert_id}).to_list(length=100)
    for d in docs:
        d["_id"] = str(d["_id"])
    return docs
