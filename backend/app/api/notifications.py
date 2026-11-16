from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.serializers import page
from app.database import get_db
from app.models import Notification, User
from app.security.deps import current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _out(n: Notification) -> dict:
    return {"id": n.id, "type": n.type, "title": n.title, "body": n.body, "link": n.link, "read": n.read_at is not None, "created_at": n.created_at}


@router.get("")
def list_notifications(unread_only: bool = False, page_no: int = Query(1, alias="page", ge=1), page_size: int = Query(20, le=50),
                       user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Notification).where(Notification.user_id == user.id)
    if unread_only:
        stmt = stmt.where(Notification.read_at.is_(None))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Notification.id.desc()).limit(page_size).offset((page_no - 1) * page_size))
    return page([_out(n) for n in rows], total, page_no, page_size)


@router.get("/unread-count")
def unread_count(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"count": db.scalar(select(func.count()).where(Notification.user_id == user.id, Notification.read_at.is_(None))) or 0}


@router.post("/read-all")
def read_all(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(Notification.user_id == user.id, Notification.read_at.is_(None)).values(read_at=datetime.now(timezone.utc)))
    db.commit()
    return {"ok": True}


@router.post("/{nid}/read")
def read_one(nid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if not n or n.user_id != user.id:
        raise HTTPException(404, "Notification not found.")
    n.read_at = n.read_at or datetime.now(timezone.utc)
    db.commit()
    return _out(n)
