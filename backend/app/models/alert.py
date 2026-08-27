from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class AlertSeverity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class AlertStatus(str, Enum):
    active = "active"
    resolved = "resolved"
    false_alarm = "false_alarm"


class LocationData(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None
    district: Optional[str] = None
    division: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SOSAlertCreate(BaseModel):
    user_id: str
    trigger_type: str  # "shake", "button", "voice", "hidden"
    location: LocationData
    message: Optional[str] = None
    audio_file_path: Optional[str] = None


class SOSAlertResponse(BaseModel):
    id: str
    user_id: str
    trigger_type: str
    severity: AlertSeverity
    status: AlertStatus
    location: LocationData
    message: Optional[str] = None
    ai_analysis: Optional[dict] = None
    audio_file_path: Optional[str] = None
    contacts_notified: List[str] = []
    priority_score: Optional[int] = 0
    created_at: datetime
    resolved_at: Optional[datetime] = None


class SOSAlertTriggerResponse(BaseModel):
    success: bool
    message: str
    ai_fallback_used: bool
    sms_status: str
    alert: Optional[SOSAlertResponse] = None


class SOSAlertUpdate(BaseModel):
    status: Optional[AlertStatus] = None
    severity: Optional[AlertSeverity] = None
    resolved_at: Optional[datetime] = None
