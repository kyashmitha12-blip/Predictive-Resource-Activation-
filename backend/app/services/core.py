"""Small shared helpers: audit log, notifications, email, platform settings."""
import logging
import smtplib
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, EmailOutbox, Notification, PlatformSetting, Role, User

log = logging.getLogger("pra")

DEFAULT_SETTINGS = {
    "idle_days_threshold": 14,          # not used for this many days => idle signal
    "utilization_window_days": 30,
    "utilization_threshold": 0.25,      # below this share of days booked => idle signal
    "max_requests_per_owner_per_week": 2,
    "overask_factor": 1.5,              # ask more owners than the gap, because some will decline
    "units_per_resource": 1,            # bookings one resource can serve in a forecast week (simplification)
    "forecast_horizon_days": 7,
    "request_valid_days": 7,
}


def audit(db: Session, actor: User | None, action: str, entity_type: str, entity_id: int | None, **details) -> None:
    db.add(AuditLog(actor_id=actor.id if actor else None, action=action, entity_type=entity_type,
                    entity_id=entity_id, details=details))


def notify(db: Session, user_id: int, type_: str, title: str, body: str = "", link: str | None = None,
           dedupe_key: str | None = None) -> bool:
    """Create an in-app notification. A repeated dedupe_key for the same user is silently skipped."""
    stmt = pg_insert(Notification).values(user_id=user_id, type=type_, title=title, body=body, link=link,
                                          dedupe_key=dedupe_key)
    if dedupe_key:
        stmt = stmt.on_conflict_do_nothing(constraint="uq_notification_dedupe")
    result = db.execute(stmt)
    return bool(result.rowcount)


def notify_admins(db: Session, type_: str, title: str, body: str = "", link: str | None = None) -> None:
    for admin_id in db.scalars(select(User.id).where(User.role == Role.admin)):
        notify(db, admin_id, type_, title, body, link)


def send_email(db: Session, to_email: str, subject: str, body: str) -> str:
    """Send through SMTP when configured. Otherwise record it as 'dev_logged' - it is NOT delivered."""
    if not settings.email_configured and settings.is_production:
        # Production without SMTP: nothing can be delivered and the token link must not be stored anywhere readable.
        db.add(EmailOutbox(to_email=to_email, subject=subject, body="[not sent: SMTP not configured]", status="not_sent"))
        log.error("email NOT sent in production: SMTP is not configured (to=%s subject=%s)", to_email, subject)
        return "not_sent"
    if not settings.email_configured:
        db.add(EmailOutbox(to_email=to_email, subject=subject, body=body, status="dev_logged"))
        log.info("email not sent (no SMTP configured): to=%s subject=%s", to_email, subject)
        return "dev_logged"
    try:
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = settings.smtp_from, to_email, subject
        msg.set_content(body)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as s:
            s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
        # The body holds a live token link; once really sent there is no reason to keep it in the database.
        db.add(EmailOutbox(to_email=to_email, subject=subject, body="[body not retained after sending]", status="sent"))
        return "sent"
    except Exception as exc:  # never fail the request because email failed
        log.warning("email send failed: %s", type(exc).__name__)
        db.add(EmailOutbox(to_email=to_email, subject=subject, body="[body not retained]", status="failed", error=str(exc)[:500]))
        return "failed"


def get_settings_map(db: Session) -> dict:
    rows = {r.key: r.value for r in db.scalars(select(PlatformSetting))}
    return {**DEFAULT_SETTINGS, **rows}
