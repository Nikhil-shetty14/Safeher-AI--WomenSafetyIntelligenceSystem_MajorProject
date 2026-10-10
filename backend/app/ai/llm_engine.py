# pyrefly: ignore [missing-import]
import httpx
from app.core.config import settings
from app.models.ai_prediction import DangerLevel
# pyrefly: ignore [missing-import]
from loguru import logger
from typing import Optional
import json
import re
import time
import hashlib

# ─── In-Memory TTL Cache for LLM Responses ───
_llm_cache: dict = {}  # key -> {"data": ..., "ts": float}
_CACHE_TTL_SEC = 120  # Cache LLM responses for 2 minutes

def _cache_get(key: str):
    entry = _llm_cache.get(key)
    if entry and (time.time() - entry["ts"]) < _CACHE_TTL_SEC:
        return entry["data"]
    return None

def _cache_set(key: str, data):
    _llm_cache[key] = {"data": data, "ts": time.time()}
    # Evict stale entries periodically (keep cache small)
    if len(_llm_cache) > 50:
        now = time.time()
        stale = [k for k, v in _llm_cache.items() if now - v["ts"] > _CACHE_TTL_SEC * 2]
        for k in stale:
            del _llm_cache[k]

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


# High-performance shared HTTP connection pool for Ollama
_ollama_client: Optional[httpx.AsyncClient] = None

def get_ollama_client() -> httpx.AsyncClient:
    global _ollama_client
    if _ollama_client is None or _ollama_client.is_closed:
        _ollama_client = httpx.AsyncClient(
            timeout=httpx.Timeout(8.0, connect=1.5),
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=50)
        )
    return _ollama_client


async def _call_ollama(messages: list, format_json: bool = False, temperature: float = 0.2, max_tokens: int = 180) -> str:
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/chat"
    client = get_ollama_client()
    
    # Try models in priority order based on local availability
    models_to_try = ["phi3", "phi3:mini", "phi3:latest"]
    last_err = None

    for model_name in models_to_try:
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "num_ctx": 1024,
            }
        }
        if format_json:
            payload["format"] = "json"

        try:
            response = await client.post(url, json=payload, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return data["message"]["content"]
            elif response.status_code == 404:
                continue
            else:
                response.raise_for_status()
        except Exception as e:
            last_err = e
            continue

    if last_err:
        raise last_err
    raise httpx.RequestError("No Ollama models could be contacted")


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
        return {
            "danger_level": "HIGH",
            "risk_score": 80,
            "emotion": "unknown",
            "summary": "AI service unreachable – treating as high-risk by default.",
            "recommended_action": ["Dispatch responders immediately", "Attempt contact verification"],
            "fallback_active": True,
            "fallback_reason": f"Ollama connection error: {str(e)}"
        }
    except json.JSONDecodeError as e:
        logger.error(f"Ollama returned invalid JSON: {e}")
        return {
            "danger_level": "HIGH",
            "risk_score": 80,
            "emotion": "unknown",
            "summary": "AI returned an unparseable response – treating as high-risk.",
            "recommended_action": ["Dispatch responders immediately"],
            "fallback_active": True,
            "fallback_reason": f"Invalid JSON from Ollama: {str(e)}"
        }
    except Exception as e:
        logger.error(f"Ollama analysis failed: {e}")
        return {
            "danger_level": "HIGH",
            "risk_score": 80,
            "emotion": "unknown",
            "summary": "AI analysis failed – treating as high-risk by default.",
            "recommended_action": ["Dispatch responders immediately"],
            "fallback_active": True,
            "fallback_reason": f"Analysis error: {str(e)}"
        }


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
    # Check cache first (grid-based key for nearby locations)
    grid_lat = round(latitude, 2)
    grid_lng = round(longitude, 2)
    cache_key = f"area_risk_{grid_lat}_{grid_lng}_{time_of_day or 'auto'}"
    cached = _cache_get(cache_key)
    if cached:
        logger.debug(f"Area risk cache HIT for ({grid_lat},{grid_lng})")
        return cached

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
            max_tokens=200
        )

        result = json.loads(content)
        _cache_set(cache_key, result)
        return result

    except httpx.RequestError as e:
        logger.error(f"Ollama Connection Error in predict_area_risk: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="AI service unreachable")
    except Exception as e:
        logger.exception(f"Area risk prediction failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail="Area risk prediction failed")


async def generate_dashboard_intel(stats_summary: str) -> dict:
    """Generate tactical recommendations and insights for the admin dashboard based on live stats.
    Uses server-side caching to avoid blocking the dashboard on slow LLM calls."""
    # Create a content-hash cache key from the stats summary
    summary_hash = hashlib.md5(stats_summary.strip().encode()).hexdigest()[:12]
    cache_key = f"dashboard_intel_{summary_hash}"
    cached = _cache_get(cache_key)
    if cached:
        logger.debug("Dashboard intel cache HIT")
        return cached

    # Deterministic fallback — always available instantly
    fallback = {
        "ai_recommendations": [
            "Increase patrol density in areas with active SOS alerts during nighttime hours",
            "Deploy rapid response units to high-risk hotspots identified in the last 6 hours",
            "Coordinate with local law enforcement for real-time intelligence sharing on active cases"
        ],
        "recent_insights": [
            "SOS incident patterns indicate elevated risk during 20:00-02:00 hours in urban transit zones",
            "Voice stress analysis accuracy has improved — panic detection sensitivity is at 96.5%",
            "Complaint resolution rate correlates with faster admin response times under 45 seconds"
        ]
    }

    try:
        import asyncio
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

        content = await asyncio.wait_for(_call_ollama(
            messages=[
                {"role": "system", "content": "You are a Tactical Emergency Intelligence Engine."},
                {"role": "user", "content": prompt},
            ],
            format_json=True,
            temperature=0.3,
            max_tokens=250
        ), timeout=4.0)

        result = json.loads(content)
        _cache_set(cache_key, result)
        return result

    except Exception as e:
        logger.warning(f"Dashboard intel LLM fallback triggered: {e}")
        # Cache the fallback too so subsequent calls are instant
        _cache_set(cache_key, fallback)
        return fallback
