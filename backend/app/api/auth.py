from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.serializers import page, public_user, user_out
from app.config import settings
from app.database import get_db
from app.models import (AccountStatus, AuthToken, EmailOutbox, Role, User, UserSession, VerificationStatus,
                        VerificationSubmission)
from app.schemas.inputs import (ChangePasswordIn, ForgotIn, LoginIn, ProfileUpdate, RegisterIn, ResetIn, TokenIn)
from app.security.deps import COOKIE_NAME, current_user, get_session
from app.security.passwords import DUMMY_HASH, hash_password, password_problems, verify_password
from app.security.ratelimit import rate_limit
from app.security.tokens import hash_token, new_token
from app.services.core import audit, notify_admins, send_email
from app.services.reliability import user_stats
from app.storage import DOC_TYPES, get_storage, make_key, read_validated

router = APIRouter(prefix="/api", tags=["auth & users"])
def dev_links_enabled() -> bool:
    """Verification and reset links are returned in API responses ONLY outside production AND when no SMTP is configured.
    Evaluated per request so the rule cannot be bypassed by import order, and so it is testable."""
    return not settings.is_production and not settings.email_configured


def email_status() -> str:
    """dev_outbox: shown in the UI, nothing sent | smtp: really sent | not_configured: production without SMTP, nothing sent."""
    return "dev_outbox" if dev_links_enabled() else ("smtp" if settings.email_configured else "not_configured")


def _start_session(db: Session, user: User, request: Request, response: Response) -> dict:
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.expires_at < datetime.now(timezone.utc)))
    raw, csrf = new_token(), new_token(16)
    db.add(UserSession(user_id=user.id, token_hash=hash_token(raw), csrf_token=csrf,
                       expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.session_ttl_hours),
                       user_agent=(request.headers.get("user-agent") or "")[:255]))
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    response.set_cookie(COOKIE_NAME, raw, max_age=settings.session_ttl_hours * 3600, httponly=True,
                        secure=settings.secure_cookies, samesite=settings.cookie_samesite, path="/")
    return {"user": user_out(user), "csrf_token": csrf}


def _issue_token(db: Session, user: User, purpose: str, hours: int) -> str:
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose, AuthToken.used_at.is_(None)))
    raw = new_token()
    db.add(AuthToken(user_id=user.id, purpose=purpose, token_hash=hash_token(raw),
                     expires_at=datetime.now(timezone.utc) + timedelta(hours=hours)))
    return raw


def _verification_mail(db: Session, user: User) -> str | None:
    raw = _issue_token(db, user, "verify_email", 48)
    link = f"{settings.frontend_origin}/verify-email?token={raw}"
    send_email(db, user.email, "Verify your email - LEND & LOOP",
               f"Hi {user.name},\n\nConfirm your email address:\n{link}\n\nThis link expires in 48 hours.")
    return link if dev_links_enabled() else None


@router.post("/auth/register", status_code=201, dependencies=[Depends(rate_limit("register", 10, 3600))])
def register(body: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    problems = password_problems(body.password)
    if problems:
        raise HTTPException(422, "Password needs " + ", ".join(problems) + ".")
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists. Try signing in.")
    if db.scalar(select(User.id).where(func.upper(User.student_id) == body.student_id.upper())):
        raise HTTPException(409, "This student ID is already registered.")
    user = User(email=email, name=body.name, student_id=body.student_id, department=body.department,
                college=body.college, password_hash=hash_password(body.password), role=Role.student)
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with these details already exists.")
    link = _verification_mail(db, user)
    data = _start_session(db, user, request, response)
    data["email_status"] = email_status()
    if link:
        data["dev_verification_link"] = link
    return data


@router.post("/auth/login", dependencies=[Depends(rate_limit("login", 10, 900))])
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Incorrect email or password.")
    if user.account_status != AccountStatus.active:
        raise HTTPException(403, "This account has been suspended. Contact an administrator.")
    return _start_session(db, user, request, response)


@router.post("/auth/admin-login", dependencies=[Depends(rate_limit("admin_login", 10, 900))])
def admin_login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    """Separate entry point for the administrator sign-in page. Reuses the same password check and
    session issuer as the student login, but the role is verified server-side before any session is
    created: a correct password for a non-admin account never starts a session here."""
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not ok:
        raise HTTPException(401, "Incorrect email or password.")
    if user.role != Role.admin:
        raise HTTPException(403, "Access denied. This login is only for authorized administrators.")
    if user.account_status != AccountStatus.active:
        raise HTTPException(403, "This account has been suspended. Contact an administrator.")
    return _start_session(db, user, request, response)


@router.post("/auth/logout")
def logout(response: Response, sess: UserSession = Depends(get_session), db: Session = Depends(get_db)):
    db.delete(sess)
    db.commit()
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/auth/me")
def me(sess: UserSession = Depends(get_session), user: User = Depends(current_user)):
    return {"user": user_out(user), "csrf_token": sess.csrf_token}


@router.post("/auth/verify-email", dependencies=[Depends(rate_limit("verify", 20, 3600))])
def verify_email(body: TokenIn, db: Session = Depends(get_db)):
    tok = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(body.token), AuthToken.purpose == "verify_email"))
    now = datetime.now(timezone.utc)
    if not tok or tok.used_at or tok.expires_at < now:
        raise HTTPException(400, "This verification link is invalid or has expired. Request a new one.")
    user = db.get(User, tok.user_id)
    user.email_verified_at, tok.used_at = now, now
    db.commit()
    return {"ok": True, "email": user.email}


@router.post("/auth/resend-verification", dependencies=[Depends(rate_limit("resend", 5, 3600))])
def resend_verification(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified_at:
        return {"ok": True, "already_verified": True}
    link = _verification_mail(db, user)
    db.commit()
    return {"ok": True, "email_status": email_status(), **({"dev_verification_link": link} if link else {})}


@router.post("/auth/forgot-password", dependencies=[Depends(rate_limit("forgot", 5, 3600))])
def forgot_password(body: ForgotIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    out: dict = {"ok": True, "message": "If that email has an account, a reset link has been prepared."}
    if user and user.account_status == AccountStatus.active:
        raw = _issue_token(db, user, "reset_password", 1)
        link = f"{settings.frontend_origin}/reset-password?token={raw}"
        send_email(db, user.email, "Reset your password", f"Reset your password (valid for 1 hour):\n{link}")
        db.commit()
        if dev_links_enabled():
            out["dev_reset_link"] = link
    return out


@router.post("/auth/reset-password", dependencies=[Depends(rate_limit("reset", 10, 3600))])
def reset_password(body: ResetIn, db: Session = Depends(get_db)):
    problems = password_problems(body.new_password)
    if problems:
        raise HTTPException(422, "Password needs " + ", ".join(problems) + ".")
    tok = db.scalar(select(AuthToken).where(AuthToken.token_hash == hash_token(body.token), AuthToken.purpose == "reset_password"))
    now = datetime.now(timezone.utc)
    if not tok or tok.used_at or tok.expires_at < now:
        raise HTTPException(400, "This reset link is invalid or has expired. Request a new one.")
    user = db.get(User, tok.user_id)
    user.password_hash = hash_password(body.new_password)
    tok.used_at = now
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))  # sign out everywhere
    db.commit()
    return {"ok": True}


@router.post("/auth/change-password", dependencies=[Depends(rate_limit("chpw", 10, 3600))])
def change_password(body: ChangePasswordIn, sess: UserSession = Depends(get_session), user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(403, "Your current password is incorrect.")
    problems = password_problems(body.new_password)
    if problems:
        raise HTTPException(422, "Password needs " + ", ".join(problems) + ".")
    user.password_hash = hash_password(body.new_password)
    db.execute(delete(UserSession).where(UserSession.user_id == user.id, UserSession.id != sess.id))
    db.commit()
    return {"ok": True}


@router.patch("/users/me")
def update_profile(body: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(user, k, v)
    db.commit()
    return user_out(user)


@router.get("/users/{user_id}")
def public_profile(user_id: int, _: User = Depends(current_user), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u or u.account_status != AccountStatus.active:
        raise HTTPException(404, "User not found.")
    return public_user(u, user_stats(db, u.id))


# ---- college verification -------------------------------------------------------------------------------
@router.post("/verification", status_code=201, dependencies=[Depends(rate_limit("verif", 10, 3600))])
async def submit_verification(college: str = Form(min_length=2, max_length=160), student_id_number: str = Form(min_length=3, max_length=40),
                              note: str = Form("", max_length=500), document: UploadFile = File(...),
                              user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role != Role.student:
        raise HTTPException(403, "Only student accounts need verification.")
    if not user.email_verified_at:
        raise HTTPException(403, "Verify your email address first.")
    if user.verification_status in (VerificationStatus.pending, VerificationStatus.approved):
        raise HTTPException(409, f"Your verification is already {user.verification_status.value}.")
    data, ctype = await read_validated(document, DOC_TYPES)
    key = make_key(f"verification/{user.id}", ctype)
    get_storage().put(key, data, ctype)
    sub = VerificationSubmission(user_id=user.id, college=college.strip(), student_id_number=student_id_number.strip(),
                                 note=note.strip(), document_key=key, status=VerificationStatus.pending)
    db.add(sub)
    user.verification_status, user.verification_reason, user.college = VerificationStatus.pending, None, college.strip()
    notify_admins(db, "verification_submitted", "New verification request", f"{user.name} ({user.student_id})", "/admin/verifications")
    db.commit()
    return {"id": sub.id, "status": sub.status.value}


@router.get("/verification/me")
def my_verification(user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.scalar(select(VerificationSubmission).where(VerificationSubmission.user_id == user.id).order_by(VerificationSubmission.id.desc()))
    return {"status": user.verification_status.value, "reason": user.verification_reason,
            "submission": None if not sub else {"id": sub.id, "college": sub.college, "student_id_number": sub.student_id_number,
                                                "submitted_at": sub.created_at, "has_document": bool(sub.document_key)}}


@router.get("/verification/{sub_id}/document")
def verification_document(sub_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    sub = db.get(VerificationSubmission, sub_id)
    if not sub or (sub.user_id != user.id and user.role != Role.admin):
        raise HTTPException(404, "Document not found.")
    data = get_storage().get(sub.document_key) if sub.document_key else None
    if data is None:
        raise HTTPException(404, "Document not found.")
    from app.storage import sniff_type
    return Response(data, media_type=sniff_type(data) or "application/octet-stream",
                    headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


# ---- development helper (disabled in production) ---------------------------------------------------------
@router.get("/dev/outbox", tags=["dev"])
def dev_outbox(limit: int = 20, db: Session = Depends(get_db)):
    if settings.is_production:
        raise HTTPException(404, "Not found.")
    rows = db.scalars(select(EmailOutbox).order_by(EmailOutbox.id.desc()).limit(min(limit, 50))).all()
    return {"note": "Emails are NOT delivered in dev mode; they are listed here instead.",
            "items": [{"id": r.id, "to": r.to_email, "subject": r.subject, "body": r.body, "status": r.status,
                       "created_at": r.created_at} for r in rows]}
