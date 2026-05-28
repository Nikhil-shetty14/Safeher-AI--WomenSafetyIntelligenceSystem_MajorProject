import os
import pymongo
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "safeher")

print(f"Connecting to MongoDB database '{DATABASE_NAME}'...")
try:
    client = pymongo.MongoClient(MONGODB_URL, tlsAllowInvalidCertificates=True)
    db = client[DATABASE_NAME]
    # Ping database to verify connection
    client.admin.command('ping')
    print("MongoDB Atlas Connected successfully!")
except Exception as e:
    print(f"Error connecting to MongoDB: {e}")
    exit(1)

# Seed Admin Settings
print("Seeding admin_settings...")
admin_settings_col = db["admin_settings"]
admin_settings_col.delete_many({})
admin_settings_col.insert_one({
    "password_change": {
        "last_changed": datetime.utcnow().isoformat()
    },
    "two_factor_auth": {
        "enabled": True,
        "method": "authenticator_app"
    },
    "biometric_login": {
        "enabled": True,
        "type": "fingerprint"
    },
    "session_timeout": {
        "timeout_minutes": 30
    },
    "login_activity_history": [
        {
            "timestamp": datetime.utcnow().isoformat(),
            "ip": "192.168.1.100",
            "device": "Chrome / Windows 11",
            "status": "success"
        },
        {
            "timestamp": datetime.utcnow().isoformat(),
            "ip": "10.0.2.15",
            "device": "SafeHer Mobile Admin App / iOS 17",
            "status": "success"
        }
    ]
})

# Seed AI Settings
print("Seeding ai_settings...")
ai_settings_col = db["ai_settings"]
ai_settings_col.delete_many({})
ai_settings_col.insert_one({
    "gpt_model_selection": {
        "model": "gpt-4o",
        "temperature": 0.2
    },
    "ai_prediction_sensitivity": {
        "sensitivity": 80
    },
    "risk_score_threshold": {
        "threshold": 75
    },
    "fallback_ai_mode": {
        "enabled": True,
        "mode": "llama-3-local"
    },
    "ai_refresh_interval": {
        "interval_seconds": 15
    },
    "threat_prediction_frequency": {
        "frequency_seconds": 30
    },
    "whisper_configuration": {
        "model": "base",
        "language": "en"
    },
    "panic_keyword_detection": {
        "enabled": True
    },
    "voice_sensitivity": {
        "sensitivity": 85
    },
    "multilingual_voice_support": {
        "enabled": True,
        "languages": ["en", "hi", "es"]
    },
    "emergency_trigger_words": {
        "keywords": ["Help me", "Save me", "Emergency", "Bachao", "Help", "Stop"]
    },
    "live_tracking_interval": {
        "interval_seconds": 5
    },
    "geofencing_radius": {
        "radius_meters": 150
    },
    "background_gps_tracking": {
        "enabled": True
    },
    "tracking_duration": {
        "duration_minutes": 60
    },
    "safe_route_calculation_frequency": {
        "frequency_seconds": 10
    },
    "heatmap_refresh_interval": {
        "interval_seconds": 30
    },
    "danger_zone_radius": {
        "radius_meters": 100
    },
    "safe_route_ai": {
        "enabled": True
    },
    "map_themes": {
        "theme": "dark"
    },
    "live_tactical_overlays": {
        "enabled": True
    },
    "threat_prediction": {
        "ai_aggressiveness": 70,
        "kidnap_detection_sensitivity": 85,
        "suspicious_behavior_detection": True,
        "predictive_risk_scoring": True
    },
    "experimental_ai": {
        "silent_kidnap_detection": True,
        "wearable_monitoring": True,
        "drone_integration": False,
        "ai_crowd_risk_prediction": True,
        "advanced_predictive_intelligence": True
    },
    "offline_emergency": {
        "offline_sos_mode": True,
        "sms_fallback_mode": True,
        "local_emergency_cache": True,
        "delayed_synchronization": True
    },
    "performance_optimization": {
        "websocket_refresh_rate": 1000,
        "polling_interval": 5000,
        "cache_ttl": 600,
        "background_task_optimization": True
    },
    "data_privacy": {
        "encrypted_storage": True,
        "secure_audio_handling": True,
        "evidence_retention_days": 30,
        "privacy_level": "maximum",
        "secure_api_access": True
    }
})

# Seed Notification Settings
print("Seeding notification_settings...")
notification_settings_col = db["notification_settings"]
notification_settings_col.delete_many({})
notification_settings_col.insert_one({
    "push_notifications": {
        "enabled": True
    },
    "emergency_alerts": {
        "enabled": True
    },
    "ai_warnings": {
        "enabled": True
    },
    "email_notifications": {
        "enabled": True
    },
    "sound_vibration_alerts": {
        "enabled": True,
        "sound": "siren.mp3",
        "vibration": True
    }
})

# Seed Twilio Settings
print("Seeding twilio_settings...")
twilio_settings_col = db["twilio_settings"]
twilio_settings_col.delete_many({})
twilio_settings_col.insert_one({
    "twilio_api": {
        "account_sid": os.getenv("TWILIO_ACCOUNT_SID", "your_sid"),
        "auth_token": os.getenv("TWILIO_AUTH_TOKEN", "your_token"),
        "phone_number": os.getenv("TWILIO_PHONE_NUMBER", "+19015901934")
    },
    "sms_templates": {
        "sos_message": "EMERGENCY: SOS alert triggered by {name} at {location}. Live tracking: {tracking_link}"
    },
    "emergency_voice_call": {
        "message": "This is an automated emergency call from SafeHer AI. A critical safety alert has been triggered for {name}. Please check the command console immediately."
    }
})

# Seed System Integrations
print("Seeding system_integrations...")
system_integrations_col = db["system_integrations"]
system_integrations_col.delete_many({})
system_integrations_col.insert_one({
    "integrations": [
        {
            "name": "Ollama Local LLM",
            "service": "ollama",
            "status": "connected",
            "uptime": "99.98%",
            "last_checked": datetime.utcnow().isoformat()
        },
        {
            "name": "Google Maps API",
            "service": "google_maps",
            "status": "connected",
            "uptime": "100.00%",
            "last_checked": datetime.utcnow().isoformat()
        },
        {
            "name": "Twilio API",
            "service": "twilio",
            "status": "connected",
            "uptime": "99.95%",
            "last_checked": datetime.utcnow().isoformat()
        },
        {
            "name": "MongoDB Atlas",
            "service": "mongodb",
            "status": "connected",
            "uptime": "100.00%",
            "last_checked": datetime.utcnow().isoformat()
        },
        {
            "name": "Socket.IO Server",
            "service": "socketio",
            "status": "connected",
            "uptime": "99.99%",
            "last_checked": datetime.utcnow().isoformat()
        }
    ]
})

# Seed Emergency Rules
print("Seeding emergency_rules...")
emergency_rules_col = db["emergency_rules"]
emergency_rules_col.delete_many({})
emergency_rules_col.insert_many([
    {
        "id": "rule_1",
        "name": "Critical Threat Automation",
        "risk_threshold": 90,
        "actions": ["Trigger Twilio Call", "Notify Admin", "Start Live Tracking", "Escalate Emergency"],
        "enabled": True
    },
    {
        "id": "rule_2",
        "name": "Medium Threat Warning",
        "risk_threshold": 60,
        "actions": ["Notify Admin", "Send Push Notification"],
        "enabled": True
    }
])

# Seed Audit Logs
print("Seeding audit_logs...")
audit_logs_col = db["audit_logs"]
audit_logs_col.delete_many({})
audit_logs_col.insert_many([
    {
        "timestamp": datetime.utcnow().isoformat(),
        "admin": "system",
        "action": "Console Initialized",
        "details": "SafeHer AI System Settings loaded into database.",
        "severity": "info"
    },
    {
        "timestamp": datetime.utcnow().isoformat(),
        "admin": "admin@safeher.com",
        "action": "API Verified",
        "details": "Google Maps API key and Twilio API status validated.",
        "severity": "info"
    }
])

# Seed Role permission matrices
print("Seeding role_permissions...")
roles_col = db["roles"]
roles_col.delete_many({})
roles_col.insert_many([
    {
        "role": "Super Admin",
        "permissions": {
            "permission_assignment": True,
            "dashboard_access_control": True,
            "emergency_management_privileges": True,
            "settings_edit": True,
            "view_logs": True
        }
    },
    {
        "role": "Security Officer",
        "permissions": {
            "permission_assignment": False,
            "dashboard_access_control": True,
            "emergency_management_privileges": True,
            "settings_edit": True,
            "view_logs": True
        }
    },
    {
        "role": "Emergency Operator",
        "permissions": {
            "permission_assignment": False,
            "dashboard_access_control": True,
            "emergency_management_privileges": True,
            "settings_edit": False,
            "view_logs": False
        }
    },
    {
        "role": "College Admin",
        "permissions": {
            "permission_assignment": False,
            "dashboard_access_control": True,
            "emergency_management_privileges": False,
            "settings_edit": False,
            "view_logs": False
        }
    }
])

print("Database Seeding Completed Successfully!")
client.close()
