from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum

class ComplaintStatus(str, Enum):
    pending = "Pending"
    under_review = "Under Review"
    resolved = "Resolved"

class LocationData(BaseModel):
    latitude: float
    longitude: float

class ComplaintCreate(BaseModel):
    state: str = Field(..., min_length=2)
    district: str = Field(..., min_length=2)
    taluk: str = Field(..., min_length=2)
    address: str = Field(..., min_length=5)
    title: str = Field(..., min_length=5, max_length=100)
    description: str = Field(..., min_length=10, max_length=2000)
    location: Optional[LocationData] = None

class ComplaintUpdate(BaseModel):
    status: Optional[ComplaintStatus] = None
    admin_remarks: Optional[str] = None

class UserDetails(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None

class ComplaintResponse(BaseModel):
    id: str
    user_id: str
    state: str
    division: Optional[str] = None
    district: str
    taluk: str
    address: str
    title: str
    description: str
    media_urls: List[str]
    location: Optional[LocationData]
    status: ComplaintStatus
    admin_remarks: Optional[str]
    user_details: Optional[UserDetails] = None
    created_at: datetime
    updated_at: datetime
