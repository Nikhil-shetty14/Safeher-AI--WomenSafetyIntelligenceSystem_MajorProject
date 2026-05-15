# pyrefly: ignore [missing-import]
import openai
from app.core.config import settings
from app.models.ai_prediction import DangerLevel
# pyrefly: ignore [missing-import]
from loguru import logger
from typing import Optional
import json
import re

openai.api_key = settings.OPENAI_API_KEY

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


async def analyze_text_for_danger(text: str, location: Optional[dict] = None) -> dict:
    """Analyze text input for danger signals using GPT-4."""
    if not settings.OPENAI_API_KEY:
        return _mock_danger_analysis(text)

    try:
        location_context = ""
        if location:
            location_context = f"\nUser's current location: lat={location.get('latitude')}, lng={location.get('longitude')}"

        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this for danger:\n\nText: \"{text}\"{location_context}"},
            ],
            temperature=0.2,
            max_tokens=500,
            response_format={"type": "json_object"},
        )

        result = json.loads(response.choices[0].message.content)
        logger.info(f"AI Analysis: danger_level={result.get('danger_level')}, trigger={result.get('trigger_emergency')}")
        return result

    except openai.RateLimitError:
        logger.error("OpenAI Quota Exceeded (429). Using fallback analysis.")
        return _mock_danger_analysis(text, fallback_reason="OpenAI Quota Exceeded")
    except openai.AuthenticationError:
        logger.error("OpenAI Authentication Failed (401). Using fallback analysis.")
        return _mock_danger_analysis(text, fallback_reason="OpenAI Auth Failed")
    except Exception as e:
        logger.error(f"OpenAI analysis failed: {e}")
        return _mock_danger_analysis(text)


async def analyze_audio_intelligence(transcript: str, acoustic_data: dict, location: dict = None) -> dict:
    """
    Perform deep intelligence analysis on transcribed emergency audio and acoustic metadata.
    """
    if not settings.OPENAI_API_KEY:
        return _mock_danger_analysis(transcript)

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

        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a Tactical Emergency Intelligence Engine."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"Audio Intelligence analysis failed: {e}")
        return _mock_danger_analysis(transcript)


async def chat_with_safeher(message: str, history: list = None) -> dict:
    """AI safety chatbot conversation."""
    if not settings.OPENAI_API_KEY:
        return _mock_chat_response(message)

    try:
        messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

        if history:
            messages.extend(history[-10:])  # Keep last 5 exchanges

        messages.append({"role": "user", "content": message})

        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7,
            max_tokens=300,
        )

        reply = response.choices[0].message.content

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
        return _mock_chat_response(message)


async def predict_area_risk(latitude: float, longitude: float, time_of_day: str = None) -> dict:
    """Predict risk level of an area based on location and time."""
    if not settings.OPENAI_API_KEY:
        return {
            "risk_level": "medium",
            "confidence": 0.6,
            "factors": ["Limited lighting at night", "Low pedestrian activity"],
            "recommendation": "Stay in well-lit areas and keep emergency contacts updated.",
        }

    try:
        prompt = f"""
        Assess safety risk for a woman alone at:
        - Latitude: {latitude}, Longitude: {longitude}
        - Time: {time_of_day or 'Unknown'}
        
        Based on general urban safety patterns, provide a risk assessment.
        Return JSON: {{"risk_level": "low/medium/high", "confidence": 0.0-1.0, 
        "factors": ["list"], "recommendation": "advice"}}
        """

        response = openai.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a women's safety risk analyst."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=200,
            response_format={"type": "json_object"},
        )

        return json.loads(response.choices[0].message.content)

    except Exception as e:
        logger.error(f"Area risk prediction failed: {e}")
        return {"risk_level": "unknown", "confidence": 0.0, "factors": [], "recommendation": "Stay alert"}


def _mock_danger_analysis(text: str, fallback_reason: str = None) -> dict:
    """Mock analysis when OpenAI is not configured or fails."""
    text_lower = text.lower()
    
    # Base response
    res = {
        "danger_level": "LOW",
        "risk_score": 10,
        "trigger_emergency": False,
        "recommended_action": "Stay aware of your surroundings.",
        "detected_threats": [],
        "summary": "No significant danger signals detected.",
        "emotion": "neutral",
        "fallback_active": True if fallback_reason else False,
        "fallback_reason": fallback_reason
    }

    # Keyword-based danger detection
    critical_kw = ["help me", "attacking", "rape", "kidnap", "gun", "knife", "kill"]
    high_kw = ["following me", "scared", "someone is behind", "don't feel safe", "threatening"]
    medium_kw = ["uncomfortable", "feeling unsafe", "strange man", "being watched"]

    if any(kw in text_lower for kw in critical_kw):
        res.update({
            "danger_level": "CRITICAL",
            "risk_score": 95,
            "trigger_emergency": True,
            "recommended_action": "IMMEDIATELY call 100 (Police) or 1091 (Women Helpline). Move to a crowded place now!",
            "detected_threats": ["critical_keywords_detected"],
            "summary": "Critical danger keywords detected in the text.",
            "emotion": "panic",
        })
    elif any(kw in text_lower for kw in high_kw):
        res.update({
            "danger_level": "HIGH",
            "risk_score": 85,
            "trigger_emergency": True,
            "recommended_action": "Alert emergency contacts now. Move to a public, well-lit area. Call 100 if needed.",
            "detected_threats": ["high_risk_keywords"],
            "summary": "High-risk situation detected.",
            "emotion": "fear",
        })
    elif any(kw in text_lower for kw in medium_kw):
        res.update({
            "danger_level": "MEDIUM",
            "risk_score": 70,
            "trigger_emergency": False,
            "recommended_action": "Share your live location with a trusted contact. Stay in well-lit areas.",
            "detected_threats": ["medium_risk_keywords"],
            "summary": "Moderate concern detected.",
            "emotion": "anxiety",
        })
    
    return res


def _mock_chat_response(message: str) -> dict:
    """Mock chatbot response for development."""
    msg_lower = message.lower()

    if any(kw in msg_lower for kw in ["help", "scared", "danger", "follow", "unsafe"]):
        return {
            "reply": (
                "I can sense you might be in distress. Please stay calm. 💙\n\n"
                "**Immediate steps:**\n"
                "1. Move to a crowded, well-lit place\n"
                "2. Press the SOS button on your app\n"
                "3. Call Women Helpline: **1091**\n"
                "4. Share your live location with a trusted contact\n\n"
                "I'm here with you. Are you safe right now?"
            ),
            "danger_detected": True,
            "danger_level": "high",
        }

    safety_tips = [
        "Always share your live location with trusted contacts when traveling alone at night. 🗺️",
        "Trust your instincts — if something feels wrong, it probably is. Act immediately.",
        "The SafeHer SOS button will instantly alert your emergency contacts with your location.",
        "Keep Women's Helpline (1091) and Police (100) saved on speed dial.",
        "Walk confidently and stay aware of your surroundings. Avoid isolated areas.",
    ]

    import random
    return {
        "reply": f"Hi! I'm SafeHer AI, your personal safety assistant. 🌟\n\n{random.choice(safety_tips)}\n\nHow can I help you stay safe today?",
        "danger_detected": False,
        "danger_level": "safe",
    }
