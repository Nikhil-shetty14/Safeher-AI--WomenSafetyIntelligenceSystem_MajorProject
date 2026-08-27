# pyrefly: ignore [missing-import]
import httpx
from app.core.config import settings
from app.models.ai_prediction import DangerLevel
# pyrefly: ignore [missing-import]
from loguru import logger
from typing import Optional
import json
import re

SYSTEM_PROMPT = """You are an AI Safety Analysis Engine for SafeHer AI.

Your job is to analyze emergency voice transcripts, SOS messages, and conversations to detect:
- danger level
- emotional distress
- panic situations
- unsafe environments
- threat severity
- urgency level

You must behave like a real-time women safety intelligence system.

-----------------------------------
INPUT TYPES
-----------------------------------
You may receive:
1. Voice transcript
2. SOS text
3. Live chat messages
4. Emergency conversation snippets

-----------------------------------
ANALYSIS TASKS
-----------------------------------
Analyze the text for:
1. Fear or panic
2. Threat keywords
3. Unsafe situations
4. Harassment indicators
5. Emotional distress
6. Suspicious behavior
7. Immediate danger
8. Severity level

-----------------------------------
DETECT THESE SIGNALS
-----------------------------------
Examples of dangerous situations:
- someone following the user
- stalking
- harassment
- kidnapping risk
- unsafe driver behavior
- physical threats
- panic crying
- forced movement
- verbal abuse
- requests for help
- fear-based language

-----------------------------------
EMOTION DETECTION
-----------------------------------
Detect emotions such as:
- fear
- panic
- stress
- anxiety
- crying
- aggression
- confusion

-----------------------------------
RISK CLASSIFICATION
-----------------------------------
Classify danger into:
LOW      → suspicious situation
MEDIUM   → unsafe condition
HIGH     → emergency likely
CRITICAL → immediate danger

-----------------------------------
OUTPUT FORMAT
-----------------------------------
Return ONLY valid JSON.
Example format:
{
  "danger_level": "HIGH",
  "risk_score": 92,
  "emotion": "fear",
  "detected_threats": [
    "possible stalking",
    "panic situation"
  ],
  "summary": "User appears scared and may be followed by someone.",
  "recommended_action": "Trigger SOS immediately and notify emergency contacts.",
  "trigger_emergency": true
}

-----------------------------------
IMPORTANT RULES
-----------------------------------
- Be highly sensitive to danger indicators.
- Understand context, not just keywords.
- If emotional distress is high, increase risk score.
- If user mentions being followed, touched, trapped, or threatened, classify as HIGH or CRITICAL.
- Never ignore indirect danger statements.
- Prioritize user safety.
- Keep summaries short and actionable.
- Output only JSON.
"""

CHAT_SYSTEM_PROMPT = """You are SafeHer, a compassionate and intelligent women's safety assistant.
You help women stay safe, provide safety tips, listen to their concerns, and guide them in emergencies.
Be empathetic, calm, and direct. If you detect danger, clearly state it and provide emergency guidance.
Keep responses concise but helpful. If someone seems to be in danger, always prioritize their safety first."""


async def _call_ollama(messages: list, format_json: bool = False, temperature: float = 0.2, max_tokens: int = 500) -> str:
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    payload = {
        "model": "phi3:mini",
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens
        }
    }
    if format_json:
        payload["format"] = "json"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["message"]["content"]


async def analyze_text_for_danger(text: str, location: Optional[dict] = None) -> dict:
    """Analyze text input for danger signals using local LLaMA 3."""
    try:
        location_context = ""
        if location:
            location_context = f"\nUser's current location: lat={location.get('latitude')}, lng={location.get('longitude')}"

        content = await _call_ollama(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this for danger:\n\nText: \"{text}\"{location_context}"},
            ],
            format_json=True,
            temperature=0.2,
            max_tokens=500
        )

        result = json.loads(content)
        logger.info(f"AI Analysis: danger_level={result.get('danger_level')}, trigger={result.get('trigger_emergency')}")
        return result

    except httpx.RequestError as e:
        logger.error(f"Ollama Connection Error: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI service unreachable")
    except json.JSONDecodeError as e:
        logger.error(f"Ollama returned invalid JSON: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="AI returned invalid response format")
    except Exception as e:
        logger.error(f"Ollama analysis failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="AI analysis failed")


async def analyze_audio_intelligence(transcript: str, acoustic_data: dict, location: dict = None) -> dict:
    """
    Perform deep intelligence analysis on transcribed emergency audio and acoustic metadata.
    """
    try:
        prompt = f"""
        TRANSCRIPT: "{transcript}"
        ACOUSTIC DATA: {json.dumps(acoustic_data)}
        LOCATION: {json.dumps(location) if location else "Unknown"}
        
        Analyze the above emergency data. Consider both the content of the speech and the emotional tone from acoustics.
        Generate a tactical risk assessment for the SafeHer AI Admin Dashboard.
        
        Return JSON format:
        {{
          "danger_level": "LOW/MEDIUM/HIGH/CRITICAL",
          "risk_score": 0-100,
          "detected_emotions": ["list"],
          "detected_threats": ["list"],
          "ai_tactical_summary": "detailed summary of what is happening",
          "recommendations": ["immediate actions for responders"],
          "confidence_score": 0.0-1.0,
          "trigger_emergency_protocol": true/false
        }}
        """

        content = await _call_ollama(
            messages=[
                {"role": "system", "content": "You are a Tactical Emergency Intelligence Engine."},
                {"role": "user", "content": prompt},
            ],
            format_json=True,
            temperature=0.2
        )

        return json.loads(content)
    except Exception as e:
        logger.error(f"Audio Intelligence analysis failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="AI Audio Intelligence failed")


async def chat_with_safeher(message: str, history: list = None) -> dict:
    """AI safety chatbot conversation."""
    try:
        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        if history:
            messages.extend(history[-10:])  # Keep last 5 exchanges

        messages.append({"role": "user", "content": message})

        reply = await _call_ollama(
            messages=messages,
            temperature=0.7,
            max_tokens=300
        )

        # Check reply for danger indicators
        danger_keywords = ["call police", "emergency", "danger", "unsafe", "threat", "attack", "help"]
        danger_detected = any(kw in reply.lower() for kw in danger_keywords)

        return {
            "reply": reply,
            "danger_detected": danger_detected,
            "danger_level": "medium" if danger_detected else "safe",
        }

    except Exception as e:
        logger.error(f"Chat AI failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI Chat service unavailable")


async def predict_area_risk(latitude: float, longitude: float, time_of_day: str = None) -> dict:
    """Predict risk level of an area based on location and time."""
    try:
        prompt = f"""
        Assess safety risk for a woman alone at:
        - Latitude: {latitude}, Longitude: {longitude}
        - Time: {time_of_day or 'Unknown'}
        
        Based on general urban safety patterns, provide a risk assessment.
        Return ONLY a JSON object exactly matching this schema:
        {{
            "risk_score": 0-100,
            "threat_level": "LOW", "MEDIUM", "HIGH", or "CRITICAL",
            "confidence": 0.0-1.0,
            "hotspot_reason": "brief explanation",
            "recommended_actions": ["action 1", "action 2"]
        }}
        """

        content = await _call_ollama(
            messages=[
                {"role": "system", "content": "You are a women's safety risk analyst."},
                {"role": "user", "content": prompt},
            ],
            format_json=True,
            temperature=0.3,
            max_tokens=250
        )

        return json.loads(content)

    except httpx.RequestError as e:
        logger.error(f"Ollama Connection Error in predict_area_risk: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI service unreachable")
    except Exception as e:
        logger.exception(f"Area risk prediction failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Area risk prediction failed")


async def generate_dashboard_intel(stats_summary: str) -> dict:
    """Generate tactical recommendations and insights for the admin dashboard based on live stats."""
    try:
        prompt = f"""
        You are a Tactical Command AI for a women's safety platform.
        Here is the current live system summary:
        {stats_summary}

        Based on these metrics, generate 3 tactical recommendations for dispatchers, and 3 recent insights.
        Return ONLY valid JSON matching this schema:
        {{
            "ai_recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
            "recent_insights": ["insight 1", "insight 2", "insight 3"]
        }}
        """

        content = await _call_ollama(
            messages=[
                {"role": "system", "content": "You are a Tactical Emergency Intelligence Engine."},
                {"role": "user", "content": prompt},
            ],
            format_json=True,
            temperature=0.3,
            max_tokens=300
        )

        return json.loads(content)

    except httpx.RequestError as e:
        logger.error(f"Ollama Connection Error in generate_dashboard_intel: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI service unreachable")
    except Exception as e:
        logger.exception(f"Dashboard intel generation failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Dashboard intel generation failed")
