"""Verification and reset links must never leave the server in production, and are only shown in dev when no SMTP exists."""
from sqlalchemy import select

from app.config import settings
from app.models import EmailOutbox
from tests.conftest import PASSWORD, make_user

REG = {"name": "Link Test", "email": "links@test.dev", "student_id": "RIT22CS321", "department": "CSE", "password": PASSWORD}


def test_dev_mode_without_smtp_shows_links_and_says_no_email_was_sent(anon, db):
    r = anon.post("/api/auth/register", json=REG).json()
    assert r["email_status"] == "dev_outbox" and "dev_verification_link" in r
    assert db.scalar(select(EmailOutbox.status)) == "dev_logged"


def test_production_never_returns_links(anon, db, monkeypatch):
    monkeypatch.setattr(settings, "env", "production")
    r = anon.post("/api/auth/register", json=REG)
    body = r.json()
    assert r.status_code == 201 and "dev_verification_link" not in body and body["email_status"] == "not_configured"
    row = db.scalar(select(EmailOutbox))
    assert row.status == "not_sent" and "token=" not in row.body  # the link is not stored anywhere readable either
    make_user(db, "reset@test.dev")
    f = anon.post("/api/auth/forgot-password", json={"email": "reset@test.dev"}).json()
    assert "dev_reset_link" not in f and "token=" not in str(f)
    assert anon.get("/api/dev/outbox").status_code == 404
    assert "token=" not in str(anon.post("/api/auth/resend-verification", headers={"X-CSRF-Token": body["csrf_token"]}).json())


def test_with_smtp_configured_links_are_not_returned_and_body_not_retained(anon, db, monkeypatch):
    sent = []
    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self): pass
        def login(self, *a): pass
        def send_message(self, m): sent.append(m)
    monkeypatch.setattr(settings, "smtp_host", "smtp.example.test")
    monkeypatch.setattr("app.services.core.smtplib.SMTP", FakeSMTP)
    body = anon.post("/api/auth/register", json=REG).json()
    assert "dev_verification_link" not in body and body["email_status"] == "smtp"
    assert len(sent) == 1 and "verify-email?token=" in sent[0].get_content()
    row = db.scalar(select(EmailOutbox))
    assert row.status == "sent" and "token=" not in row.body
