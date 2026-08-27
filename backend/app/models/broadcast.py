from pydantic import BaseModel, Field
from typing import Optional, Dict
from datetime import datetime
from enum import Enum


class BroadcastType(str, Enum):
    alert = "alert"
    advisory = "advisory"
    weather = "weather"
    missing = "missing"
    instruction = "instruction"


class BroadcastPriority(str, Enum):
    normal = "normal"
    high = "high"
    critical = "critical"


class BroadcastTargetType(str, Enum):
    all = "all"
    location = "location"


class BroadcastStatus(str, Enum):
    scheduled = "scheduled"
    active = "active"
    completed = "completed"


class BroadcastCreate(BaseModel):
    title: str
    body: str
    type: BroadcastType
    priority: BroadcastPriority
    target_type: BroadcastTargetType
    target_location: Optional[str] = None
    scheduled_for: Optional[datetime] = None
    image_url: Optional[str] = None


class DeliveryStats(BaseModel):
    sent: int = 0
    read: int = 0
    failed: int = 0


class BroadcastResponse(BaseModel):
    id: str
    title: str
    body: str
    type: BroadcastType
    priority: BroadcastPriority
    target_type: BroadcastTargetType
    target_location: Optional[str] = None
    status: BroadcastStatus
    scheduled_for: Optional[datetime] = None
    image_url: Optional[str] = None
    created_at: datetime
    delivery_stats: DeliveryStats
