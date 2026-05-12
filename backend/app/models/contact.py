from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EmergencyContactCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=10, max_length=15)
    relationship: str
    email: Optional[str] = None
    is_primary: bool = False


class EmergencyContactResponse(BaseModel):
    id: str
    user_id: str
    name: str
    phone: str
    relationship: str
    email: Optional[str] = None
    is_primary: bool
    created_at: datetime


class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    relationship: Optional[str] = None
    email: Optional[str] = None
    is_primary: Optional[bool] = None
