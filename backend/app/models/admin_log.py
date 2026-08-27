from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class AdminLog(BaseModel):
    id: str = Field(..., alias="_id")
    admin_id: str
    admin_email: str
    action: str
    target_id: Optional[str] = None
    details: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class AdminLogCreate(BaseModel):
    admin_id: str
    admin_email: str
    action: str
    target_id: Optional[str] = None
    details: Optional[str] = None
