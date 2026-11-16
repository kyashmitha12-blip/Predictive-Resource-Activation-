import hmac
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AccountStatus, Role, User, UserSession, VerificationStatus
from app.security.tokens import hash_token

COOKIE_NAME = "pra_session"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_session(request: Request, db: Session = Depends(get_db)) -> UserSession:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(401, "Please sign in to continue.")
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if not sess or sess.expires_at <= datetime.now(timezone.utc):
        if sess:
            db.delete(sess)
            db.commit()
        raise HTTPException(401, "Your session has expired. Please sign in again.")
    if request.method not in SAFE_METHODS:
        sent = request.headers.get("x-csrf-token", "")
        if not hmac.compare_digest(sent, sess.csrf_token):
            raise HTTPException(403, "Security check failed (CSRF). Reload the page and try again.")
    return sess


def current_user(sess: UserSession = Depends(get_session), db: Session = Depends(get_db)) -> User:
    user = db.get(User, sess.user_id)
    if not user or user.account_status != AccountStatus.active:
        raise HTTPException(403, "This account is not active.")
    return user


def require_admin(user: User = Depends(current_user)) -> User:
    if user.role != Role.admin:
        raise HTTPException(403, "Administrator access required.")
    return user


def require_verified_student(user: User = Depends(current_user)) -> User:
    """Restricted actions (listing, booking, activation) need an admin-approved college verification."""
    if user.role == Role.admin:
        raise HTTPException(403, "Administrator accounts cannot take part in sharing. Use a student account.")
    if user.verification_status != VerificationStatus.approved:
        raise HTTPException(403, "Your student verification must be approved before you can do this.")
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    """For public GET endpoints: the signed-in user if there is a valid session, otherwise None."""
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if not sess or sess.expires_at <= datetime.now(timezone.utc):
        return None
    user = db.get(User, sess.user_id)
    return user if user and user.account_status == AccountStatus.active else None
