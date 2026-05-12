from fastapi import APIRouter, HTTPException, Depends
from app.models.contact import EmergencyContactCreate, EmergencyContactUpdate, EmergencyContactResponse
from app.core.security import get_current_user
from app.core.database import get_collection
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/contacts", tags=["Emergency Contacts"])


@router.post("/", response_model=EmergencyContactResponse, status_code=201)
async def add_contact(
    contact_data: EmergencyContactCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add emergency contact for current user."""
    collection = get_collection("emergency_contacts")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Max 5 contacts per user
    count = await collection.count_documents({"user_id": current_user["_id"]})
    if count >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 emergency contacts allowed")

    # If setting as primary, unset existing primary
    if contact_data.is_primary:
        await collection.update_many(
            {"user_id": current_user["_id"]},
            {"$set": {"is_primary": False}}
        )

    contact_id = str(uuid.uuid4())
    now = datetime.utcnow()
    contact_doc = {
        "_id": contact_id,
        "user_id": current_user["_id"],
        "name": contact_data.name,
        "phone": contact_data.phone,
        "relationship": contact_data.relationship,
        "email": contact_data.email,
        "is_primary": contact_data.is_primary,
        "created_at": now,
    }
    await collection.insert_one(contact_doc)
    return _format_contact(contact_doc)


@router.get("/")
async def get_contacts(current_user: dict = Depends(get_current_user)):
    """Get all emergency contacts for current user."""
    collection = get_collection("emergency_contacts")
    if collection is None:
        return []
    cursor = collection.find({"user_id": current_user["_id"]}).sort("is_primary", -1)
    contacts = await cursor.to_list(length=10)
    return [_format_contact(c) for c in contacts]


@router.put("/{contact_id}", response_model=EmergencyContactResponse)
async def update_contact(
    contact_id: str,
    update_data: EmergencyContactUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an emergency contact."""
    collection = get_collection("emergency_contacts")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    contact = await collection.find_one({"_id": contact_id, "user_id": current_user["_id"]})
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    update_dict = {k: v for k, v in update_data.dict().items() if v is not None}
    await collection.update_one({"_id": contact_id}, {"$set": update_dict})
    updated = await collection.find_one({"_id": contact_id})
    return _format_contact(updated)


@router.delete("/{contact_id}")
async def delete_contact(
    contact_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an emergency contact."""
    collection = get_collection("emergency_contacts")
    if collection is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = await collection.delete_one({"_id": contact_id, "user_id": current_user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Contact not found")
    return {"message": "Contact deleted successfully"}


def _format_contact(c: dict) -> dict:
    return {
        "id": c["_id"],
        "user_id": c["user_id"],
        "name": c["name"],
        "phone": c["phone"],
        "relationship": c["relationship"],
        "email": c.get("email"),
        "is_primary": c.get("is_primary", False),
        "created_at": c["created_at"],
    }
