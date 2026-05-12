from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DangerLevel(str, Enum):
    safe = "safe"
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AIPredictionCreate(BaseModel):
    user_id: str
    input_text: Optional[str] = None
    audio_file_path: Optional[str] = None
    location: Optional[dict] = None


class AIPredictionResponse(BaseModel):
    id: str
    user_id: str
    danger_level: DangerLevel
    confidence_score: float
    suggested_action: str
    trigger_emergency: bool
    analysis_details: Dict[str, Any]
    input_text: Optional[str] = None
    transcribed_text: Optional[str] = None
    stress_level: Optional[float] = None
    created_at: datetime


class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    danger_detected: bool
    danger_level: Optional[DangerLevel] = None
    suggested_action: Optional[str] = None


class VoiceAnalysisResult(BaseModel):
    transcribed_text: str
    stress_level: float
    emotion: str
    danger_level: DangerLevel
    confidence: float
    trigger_emergency: bool
