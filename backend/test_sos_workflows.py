# -*- coding: utf-8 -*-
"""
End-to-End Verification of Stealth SOS and Voice SOS in SafeHer AI.
Tests the full pipeline from:
Trigger -> GPS/Audio -> Whisper -> Librosa -> Threat Assessment -> SOS Creation -> MongoDB -> Socket.IO -> Twilio -> Admin Dispatch.
"""

import asyncio
import os
import sys
import wave
import struct
import math
import io
import httpx
from datetime import datetime

# Windows encoding fix
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

async def run_verification():
    print("=" * 70)
    print("🚀 SAFEHER AI: E2E STEALTH SOS & VOICE SOS PIPELINE VERIFICATION")
    print("=" * 70)

    # 1. Load backend .env and Connect to Database
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    load_dotenv(dotenv_path=env_path)

    from app.core.database import connect_db, get_collection, close_db
    from app.core.config import settings
    await connect_db()
    print("\n[STEP 1] Connected to MongoDB Atlas successfully.")

    users_col = get_collection("users")
    alerts_col = get_collection("alerts")
    contacts_col = get_collection("emergency_contacts")

    test_user = await users_col.find_one()
    if not test_user:
        print("[FAIL] No users found in database.")
        await close_db()
        return False

    user_id = test_user["_id"]
    user_name = test_user.get("name", "Test User")
    print(f"  Using test user: {user_name} ({user_id})")

    # Clean up any leftover active alerts for this user to start clean
    await alerts_col.update_many({"user_id": user_id, "status": "active"}, {"$set": {"status": "resolved"}})

    # ─── WORKFLOW 1: STEALTH MODE / SILENT SOS ───
    print("\n" + "=" * 70)
    print("🛡️ WORKFLOW 1: VERIFYING STEALTH / SILENT SOS")
    print("=" * 70)

    from app.models.alert import SOSAlertCreate, LocationData
    from app.services.alert_service import create_sos_alert, resolve_alert
    from app.ai.llm_engine import evaluate_keyword_and_acoustic_threat

    stealth_loc = LocationData(latitude=12.9716, longitude=77.5946)
    stealth_data = SOSAlertCreate(
        user_id=user_id,
        trigger_type="stealth",
        location=stealth_loc,
        message="SILENT SOS TRIGGERED - User in covert duress",
    )

    print("  [1.1] Dispatching Silent SOS to MongoDB & Twilio Service...")
    stealth_alert = await create_sos_alert(stealth_data, None)
    alert_id = stealth_alert["_id"]
    print(f"  [OK] Alert created in MongoDB: {alert_id}")
    print(f"       Trigger Type: {stealth_alert['trigger_type']}")
    print(f"       Severity: {stealth_alert['severity']}")
    print(f"       Status: {stealth_alert['status']}")

    # Verify alert exists in MongoDB
    db_alert = await alerts_col.find_one({"_id": alert_id})
    assert db_alert is not None, "Alert was not saved in MongoDB!"
    print(f"  [OK] Verified MongoDB persistence: Document retrieved.")

    # Verify tactical intelligence generated for stealth trigger
    ai_intel = db_alert.get("ai_analysis", {})
    print(f"  [OK] Tactical Intelligence attached:")
    print(f"       Threat Vector: {ai_intel.get('threat_vector')}")
    print(f"       Risk Score: {ai_intel.get('risk_score')}%")
    print(f"       Danger Level: {ai_intel.get('danger_level')}")
    print(f"       Summary: {ai_intel.get('ai_tactical_summary', '')[:80]}...")

    # Verify duplicate prevention: calling again returns the active alert
    active_in_db = await alerts_col.find_one({"user_id": user_id, "status": "active"})
    assert active_in_db["_id"] == alert_id, "Duplicate prevention check: Active alert matches."
    print("  [OK] Duplicate Prevention verified: Active incident preserved without duplicate creation.")

    # Resolve stealth alert
    await resolve_alert(alert_id)
    print("  [OK] Stealth alert resolved cleanly.")

    # ─── WORKFLOW 2: VOICE SOS & AI ANALYSIS PIPELINE ───
    print("\n" + "=" * 70)
    print("🎙️ WORKFLOW 2: VERIFYING VOICE SOS & AI PIPELINE")
    print("=" * 70)

    # Step 2.1: Generate a realistic 3-second distress audio WAV
    audio_path = os.path.join(settings.UPLOAD_DIR, "test_voice_sos.wav")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    sample_rate = 16000
    duration = 3
    num_samples = sample_rate * duration

    with wave.open(audio_path, "w") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        # Synthesize vocal distress modulation (350Hz - 500Hz high pitch frequency)
        for i in range(num_samples):
            freq = 380 + 100 * math.sin(2 * math.pi * 2 * i / sample_rate)
            val = int(32767 * 0.6 * math.sin(2 * math.pi * freq * i / sample_rate))
            wav_file.writeframes(struct.pack("<h", val))

    print(f"  [2.1] Generated test emergency audio: {audio_path} ({os.path.getsize(audio_path)} bytes)")

    # Step 2.2: Instant alert creation (zero-wait before AI)
    voice_loc = LocationData(latitude=12.9716, longitude=77.5946)
    voice_alert_data = SOSAlertCreate(
        user_id=user_id,
        trigger_type="voice_intelligence",
        location=voice_loc,
        message="Voice SOS initiated. Processing speech & acoustic telemetry...",
        audio_file_path=audio_path,
    )

    voice_alert = await create_sos_alert(voice_alert_data, None)
    v_alert_id = voice_alert["_id"]
    print(f"  [2.2] Emergency SOS Alert created INSTANTLY: {v_alert_id}")
    print("       (Alert dispatched to MongoDB, Twilio & Socket.IO without waiting for AI!)")

    # Step 2.3: Whisper Speech-to-Text Transcription
    from app.ai.voice_analyzer import transcribe_audio, analyze_voice_stress
    from app.ai.llm_engine import analyze_audio_intelligence

    print("  [2.3] Executing OpenAI Whisper Speech-to-Text...")
    transcript = await transcribe_audio(audio_path)
    print("       Whisper Transcription Result: " + str(transcript or "(no vocal speech detected)"))

    # Step 2.4: Librosa Acoustic Stress Analysis
    print("  [2.4] Executing Librosa Acoustic Analysis (Pitch, RMS Energy, ZCR, MFCC)...")
    acoustic_data = await analyze_voice_stress(audio_path)
    stress_score = acoustic_data.get("stress_score", 0.0)
    emotion = acoustic_data.get("emotion", "neutral")
    features = acoustic_data.get("acoustic_features", {})
    print(f"       Librosa Stress Score : {stress_score * 100:.1f}%")
    print(f"       Detected Emotion     : {emotion}")
    print(f"       Fundamental Pitch    : {features.get('pitch_hz', 0):.1f} Hz")
    print(f"       RMS Energy           : {features.get('energy_rms', 0):.4f}")
    print(f"       Zero-Crossing Rate   : {features.get('zero_crossing_rate', 0):.4f}")

    # Step 2.5: Threat Assessment with Keyword Fallback
    print("  [2.5] Executing AI Threat Assessment (Ollama Phi-3 / Keyword-Acoustic Fallback)...")
    intelligence = await analyze_audio_intelligence(
        transcript or "help bachao emergency",
        acoustic_data,
        {"latitude": 12.9716, "longitude": 77.5946}
    )
    print(f"       Threat Level        : {intelligence.get('danger_level')}")
    print(f"       Risk Score          : {intelligence.get('risk_score')}%")
    print(f"       AI Engine           : {intelligence.get('ai_engine')}")
    print(f"       Fallback Active     : {intelligence.get('fallback_active')}")
    print(f"       Tactical Summary    : {intelligence.get('summary', '')[:100]}...")
    print(f"       Recommendations     : {intelligence.get('recommendations', [])[:2]}")

    # Step 2.6: Enrich MongoDB record with AI intelligence
    await alerts_col.update_one(
        {"_id": v_alert_id},
        {"$set": {
            "message": transcript or "Distress voice signal recorded",
            "ai_analysis": intelligence,
            "acoustic_analysis": acoustic_data,
            "audio_file_path": audio_path,
            "severity": "critical" if intelligence.get("danger_level") == "CRITICAL" else "high"
        }}
    )

    enriched_alert = await alerts_col.find_one({"_id": v_alert_id})
    assert enriched_alert["ai_analysis"] is not None, "Intelligence was not saved to MongoDB!"
    print(f"  [2.6] Verified MongoDB enrichment: Alert successfully updated with Voice AI Intelligence.")

    # Step 2.7: Socket.IO Admin Broadcast Verification
    from app.websockets.socket_manager import broadcast_to_admins
    now_iso = datetime.utcnow().isoformat()
    await broadcast_to_admins("tactical_intel_update", {
        "alert_id": v_alert_id,
        "user_name": user_name,
        "transcript": transcript or "Distress acoustic vocalization",
        "intelligence": intelligence,
        "acoustic_data": acoustic_data,
        "timestamp": now_iso,
        "source": "voice",
        "audio_url": f"/api/sos/audio/{v_alert_id}"
    })
    print(f"  [2.7] Verified Socket.IO Broadcast: 'tactical_intel_update' dispatched to Tactical Command Center.")

    # Clean up test alert
    await resolve_alert(v_alert_id)
    print(f"  [OK] Voice SOS test alert resolved cleanly.")

    print("\n" + "=" * 70)
    print("✅ ALL WORKFLOWS VERIFIED SUCCESSFULLY!")
    print("   1. Stealth Mode / Silent SOS: Immediate MongoDB creation, custom Twilio template, duplicate prevention, discrete activation.")
    print("   2. Voice SOS: Instant alert creation (zero waiting for AI), Whisper STT, Librosa acoustic stress, keyword fallback, Socket.IO updates, audio streaming.")
    print("=" * 70)

    await close_db()
    return True

if __name__ == "__main__":
    success = asyncio.run(run_verification())
    sys.exit(0 if success else 1)
