import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.services.walk_service import WalkService
from app.core.config import settings

router = APIRouter(prefix="/walk", tags=["Walk With Me"])

class WalkStartRequest(BaseModel):
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float

@router.post("/start")
async def start_walk(request: WalkStartRequest, user_id: str = Depends(lambda: "placeholder_user")):
    """Generate a walking route from origin to destination and return polyline."""
    try:
        route = WalkService.get_route(
            request.origin_lat,
            request.origin_lng,
            request.destination_lat,
            request.destination_lng,
        )
        return {"success": True, "route": route}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/recalc")
async def recalc_walk(request: WalkStartRequest, user_id: str = Depends(lambda: "placeholder_user")):
    """Recalculate route from current location to original destination (same logic as start)."""
    return await start_walk(request, user_id)
