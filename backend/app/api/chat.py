from fastapi import APIRouter, Depends
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.models import Resource, ResourceStatus, User
from app.schemas.inputs import ChatIn
from app.security.deps import optional_user

router = APIRouter(prefix="/api/chat", tags=["assistant"])


def _reply(message: str, user: User | None, db: Session) -> dict:
    text = message.lower().strip()

    if any(word in text for word in ("hello", "hi ", "hey", "help")):
        answer = (
            "Hi! I can help you browse resources, explain bookings and verification, "
            "or guide you through listing and activating gear."
        )
        return {"reply": answer, "suggestions": ["Browse resources", "How do bookings work?", "How do I list an item?"]}

    if "verify" in text or "verification" in text:
        return {
            "reply": "Open Profile & verification from the student menu. Submit your student ID and verification details, then wait for an administrator to approve your account.",
            "suggestions": ["What can I do after approval?", "How do I list an item?"],
        }

    if "list" in text or "share" in text or "lend" in text:
        return {
            "reply": "Choose My resources, then add a resource with a name, category, condition, pickup area, and availability. You must have approved student verification before listing.",
            "suggestions": ["How do bookings work?", "How do activation requests work?"],
        }

    if "activation" in text or "idle" in text:
        return {
            "reply": "Predictive activation asks owners of idle gear whether they want to share it for a demand window. Accept it to add availability, decline it, or withdraw it before it expires.",
            "suggestions": ["How do I list an item?", "Where can I see activation requests?"],
        }

    if "booking" in text or "borrow" in text or "rent" in text or "reserve" in text:
        return {
            "reply": "Open Browse resources, select an item and choose a valid time window. The owner confirms the request. After use, the borrower returns it and the owner confirms the return.",
            "suggestions": ["Find an available resource", "How do I verify my account?"],
        }

    resource_terms = ("find", "browse", "search", "need", "looking", "available", "resource")
    if any(term in text for term in resource_terms):
        search_terms = [
            word for word in text.replace("?", "").replace(",", " ").replace("/", " ").split()
            if len(word) >= 3 and word not in {
                "find", "browse", "search", "need", "looking", "available", "resource",
                "resources", "for", "with", "the", "and", "from", "show", "me", "can", "you",
            }
        ]
        stmt = select(Resource).where(Resource.status == ResourceStatus.active).options(
            joinedload(Resource.owner),
            selectinload(Resource.images),
        )
        if search_terms:
            clause = or_(*(Resource.name.ilike(f"%{term}%") for term in search_terms[:4]))
            stmt = stmt.where(clause)
        try:
            resources = list(db.scalars(stmt.order_by(Resource.created_at.desc()).limit(5)).unique())
        except SQLAlchemyError:
            db.rollback()
            return {
                "reply": "I couldn't access the resource directory just now. Confirm the database is running and migrated, then ask me again.",
                "suggestions": ["How do bookings work?", "How do I list an item?"],
            }
        if resources:
            items = [
                {
                    "id": r.id,
                    "name": r.name,
                    "category": r.category,
                    "path": f"/app/browse/{r.id}" if user and user.role.value == "student" else f"/explore/{r.id}",
                }
                for r in resources
            ]
            query = " ".join(search_terms[:4])
            return {
                "reply": f"I found {len(items)} active resource{'s' if len(items) != 1 else ''}" + (f" matching '{query}'." if query else "."),
                "resources": items,
                "suggestions": ["How do bookings work?", "How do I verify my account?"],
            }
        return {
            "reply": "I could not find a matching active resource. Try a broader category such as electronics, sports, or academic tools.",
            "suggestions": ["Browse resources", "How do bookings work?"],
        }

    return {
        "reply": "I can help with campus resource search, bookings, student verification, listing gear, and activation requests. What would you like to do?",
        "suggestions": ["Find a resource", "How do bookings work?", "How do I list an item?"],
    }


@router.post("")
def chat(body: ChatIn, user: User | None = Depends(optional_user), db: Session = Depends(get_db)):
    return _reply(body.message, user, db)
