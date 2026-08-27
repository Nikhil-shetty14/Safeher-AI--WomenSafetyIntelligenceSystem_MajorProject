import socketio
from loguru import logger
from typing import Dict, Set
from datetime import datetime

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    max_http_buffer_size=1_000_000,
)

# Track connected users: {user_id: sid}
connected_users: Dict[str, str] = {}
# Track admin sockets: {sid: {"role": role, "division": div, "district": dist}}
admin_sockets: Dict[str, dict] = {}
# Track live locations: {user_id: location_data}
live_locations: Dict[str, dict] = {}


@sio.event
async def connect(sid, environ, auth):
    logger.info(f"Socket connected: {sid}")
    await sio.emit("connection_ack", {"message": "Connected to SafeHer AI", "sid": sid}, to=sid)


@sio.event
async def disconnect(sid):
    # Remove from connected users
    user_id = None
    for uid, socket_id in list(connected_users.items()):
        if socket_id == sid:
            user_id = uid
            del connected_users[uid]
            break

    admin_sockets.pop(sid, None)
    if user_id:
        live_locations.pop(user_id, None)
        logger.info(f"User {user_id} disconnected")
    else:
        logger.info(f"Socket {sid} disconnected")


@sio.event
async def register_user(sid, data):
    """Register a user socket for targeted messaging."""
    user_id = data.get("user_id")
    role = data.get("role", "user")

    if role in ["admin", "super_admin", "regional_admin", "district_admin"]:
        admin_sockets[sid] = {
            "role": role,
            "division": data.get("division"),
            "district": data.get("district")
        }
        logger.info(f"Admin registered on socket: {sid} | Role: {role}")
        await sio.emit("registered", {"status": "ok", "role": role}, to=sid)
        return

    if user_id:
        connected_users[user_id] = sid
        await sio.emit("registered", {"status": "ok", "user_id": user_id}, to=sid)
        logger.info(f"User {user_id} registered (role={role})")


@sio.event
async def register(sid, data):
    """Alias for register_user supporting different client frameworks."""
    await register_user(sid, data)


@sio.event
async def location_update(sid, data):
    """Receive real-time location update from user."""
    user_id = data.get("user_id")
    if not user_id:
        return

    location = {
        "user_id": user_id,
        "latitude": data.get("latitude"),
        "longitude": data.get("longitude"),
        "accuracy": data.get("accuracy"),
        "timestamp": datetime.utcnow().isoformat(),
    }
    live_locations[user_id] = location

    # Broadcast to all admins
    for admin_sid in admin_sockets.keys():
        await sio.emit("user_location_update", location, to=admin_sid)


@sio.event
async def sos_triggered(sid, data):
    """Handle SOS trigger from mobile app."""
    user_id = data.get("user_id")
    location = data.get("location", {})

    alert_broadcast = {
        "type": "sos_alert",
        "user_id": user_id,
        "location": location,
        "timestamp": datetime.utcnow().isoformat(),
        "severity": data.get("severity", "high"),
    }

    if admin_sockets:
        # Broadcast to admins based on region
        alert_district = location.get("district")
        alert_division = location.get("division")
        
        for admin_sid, admin_data in admin_sockets.items():
            role = admin_data.get("role")
            if role in ["super_admin", "admin"] or not alert_district:
                await sio.emit("new_sos_alert", alert_broadcast, to=admin_sid)
            elif role == "regional_admin" and admin_data.get("division") == alert_division:
                await sio.emit("new_sos_alert", alert_broadcast, to=admin_sid)
            elif role == "district_admin" and admin_data.get("district") == alert_district:
                await sio.emit("new_sos_alert", alert_broadcast, to=admin_sid)
                
        logger.info(f"SOS broadcast processed for user {user_id}")
    else:
        logger.info(f"SOS triggered by user {user_id}, but no admin(s) are currently connected to receive the broadcast.")


@sio.event
async def voice_stream(sid, data):
    """Handle voice stream data for real-time analysis."""
    user_id = data.get("user_id")
    # Echo analysis trigger back to user
    await sio.emit("voice_received", {"status": "analyzing", "user_id": user_id}, to=sid)


async def emit_to_user(user_id: str, event: str, data: dict):
    """Emit event to a specific user."""
    sid = connected_users.get(user_id)
    if sid:
        await sio.emit(event, data, to=sid)
        return True
    return False


async def broadcast_to_admins(event: str, data: dict):
    """Broadcast event to admins, filtering by region if applicable."""
    alert_district = None
    alert_division = None
    
    # Try to extract location info from data
    if "location" in data and isinstance(data["location"], dict):
        alert_district = data["location"].get("district")
        alert_division = data["location"].get("division")
        
    for admin_sid, admin_data in admin_sockets.items():
        role = admin_data.get("role")
        if role in ["super_admin", "admin"] or not alert_district:
            await sio.emit(event, data, to=admin_sid)
        elif role == "regional_admin" and admin_data.get("division") == alert_division:
            await sio.emit(event, data, to=admin_sid)
        elif role == "district_admin" and admin_data.get("district") == alert_district:
            await sio.emit(event, data, to=admin_sid)


async def broadcast_to_users(event: str, data: dict, user_ids: list = None):
    """Broadcast event to all users or specific user_ids."""
    if user_ids is not None:
        for user_id in user_ids:
            sid = connected_users.get(user_id)
            if sid:
                await sio.emit(event, data, to=sid)
    else:
        for sid in connected_users.values():
            await sio.emit(event, data, to=sid)


def get_connected_count() -> dict:
    return {
        "total_users": len(connected_users),
        "admins": len(admin_sockets),
        "live_tracking": len(live_locations),
    }
