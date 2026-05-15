from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class UserRole(str, Enum):
    user = "user"
    admin = "admin"


class SafetyPreferences(BaseModel):
    sos_auto_activation: bool = False
    shake_detection: bool = False
    shake_sensitivity: float = 2.8
    voice_triggered_sos: bool = False
    hidden_sos_mode: bool = False
    live_tracking_enabled: bool = True


class NotificationSettings(BaseModel):
    sms_alerts: bool = True
    emergency_calls: bool = True
    push_notifications: bool = True
    notification_sounds: bool = True


class SecuritySettings(BaseModel):
    biometric_login: bool = False
    two_factor_auth: bool = False


class UserCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    phone: str = Field(..., min_length=10, max_length=15)
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    profile_image: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    fcm_token: Optional[str] = None
    safety_preferences: Optional[SafetyPreferences] = None
    notification_settings: Optional[NotificationSettings] = None
    security_settings: Optional[SecuritySettings] = None


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    role: UserRole
    is_active: bool
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    profile_image: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    safety_preferences: SafetyPreferences = SafetyPreferences()
    notification_settings: NotificationSettings = NotificationSettings()
    security_settings: SecuritySettings = SecuritySettings()
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserInDB(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    hashed_password: str
    role: UserRole = UserRole.user
    is_active: bool = True
    age: Optional[int] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    profile_image: Optional[str] = None
    blood_group: Optional[str] = None
    medical_conditions: Optional[str] = None
    allergies: Optional[str] = None
    fcm_token: Optional[str] = None
    safety_preferences: SafetyPreferences = SafetyPreferences()
    notification_settings: NotificationSettings = NotificationSettings()
    security_settings: SecuritySettings = SecuritySettings()
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
