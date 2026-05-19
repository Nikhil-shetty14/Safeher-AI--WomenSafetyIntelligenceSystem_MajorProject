import socketio
from loguru import logger
from typing import Dict, Set
from datetime import datetime

# Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)

# Track connected users: {user_id: sid}
connected_users: Dict[str, str] = {}
# Track admin sockets
admin_sockets: Set[str] = set()
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

    admin_sockets.discard(sid)
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

    if role == "admin":
        admin_sockets.add(sid)
        logger.info(f"Admin registered on socket: {sid}")
        await sio.emit("registered", {"status": "ok", "role": "admin"}, to=sid)
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
    for admin_sid in admin_sockets:
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
        # Broadcast to all admins
        for admin_sid in admin_sockets:
            await sio.emit("new_sos_alert", alert_broadcast, to=admin_sid)
        logger.info(f"SOS broadcast to {len(admin_sockets)} admin(s) for user {user_id}")
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
    """Broadcast event to all connected admins."""
    for admin_sid in admin_sockets:
        await sio.emit(event, data, to=admin_sid)


def get_connected_count() -> dict:
    return {
        "total_users": len(connected_users),
        "admins": len(admin_sockets),
        "live_tracking": len(live_locations),
    }
