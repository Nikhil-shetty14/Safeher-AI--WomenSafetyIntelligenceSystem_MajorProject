from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class LocationUpdate(BaseModel):
    user_id: Optional[str] = None
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    altitude: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LocationHistoryResponse(BaseModel):
    id: str
    user_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None
    altitude: Optional[float] = None
    timestamp: datetime
