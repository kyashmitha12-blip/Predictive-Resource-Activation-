from sqlalchemy import select

from app.models import AuthToken, EmailOutbox, Role, User, VerificationStatus
from tests.conftest import PASSWORD, Api, make_user

REG = {"name": "Test Student", "email": "new@test.dev", "student_id": "RIT22CS999", "department": "CSE", "password": PASSWORD}


def test_register_login_logout_and_me(anon, db):
    r = anon.post("/api/auth/register", json=REG)
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["role"] == "student" and body["user"]["verification_status"] == "not_submitted"
    assert "password_hash" not in body["user"]
    assert "dev_verification_link" in body  # dev mode only, email not actually sent
    assert db.scalar(select(EmailOutbox.status)) == "dev_logged"
    assert anon.get("/api/auth/me").status_code == 200
    csrf = body["csrf_token"]
    assert anon.post("/api/auth/logout").status_code == 403  # CSRF header required
    assert anon.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert anon.get("/api/auth/me").status_code == 401


def test_cannot_register_as_admin_and_duplicates_rejected(anon):
    r = anon.post("/api/auth/register", json={**REG, "role": "admin"})
    assert r.status_code == 422  # unknown field refused
    assert anon.post("/api/auth/register", json=REG).status_code == 201
    anon.cookies.clear()
    dup = anon.post("/api/auth/register", json=REG)
    assert dup.status_code == 409 and "already exists" in dup.json()["detail"]


def test_password_policy_and_invalid_login(anon, db):
    assert anon.post("/api/auth/register", json={**REG, "password": "short1"}).status_code == 422
    assert anon.post("/api/auth/register", json={**REG, "password": "onlyletters"}).status_code == 422
    make_user(db, "u@test.dev")
    bad = anon.post("/api/auth/login", json={"email": "u@test.dev", "password": "wrong-pass-1"})
    assert bad.status_code == 401
    assert anon.post("/api/auth/login", json={"email": "nobody@test.dev", "password": "wrong-pass-1"}).json()["detail"] == bad.json()["detail"]


def test_password_is_hashed_with_argon2(db):
    u = make_user(db, "h@test.dev")
    assert u.password_hash.startswith("$argon2id$") and PASSWORD not in u.password_hash


def test_suspended_user_cannot_login(anon, db, admin):
    u = make_user(db, "s@test.dev")
    assert admin.patch(f"/api/admin/users/{u.id}", json={"account_status": "suspended"}).status_code == 200
    assert anon.post("/api/auth/login", json={"email": "s@test.dev", "password": PASSWORD}).status_code == 403


def test_email_verification_and_password_reset(anon, db):
    r = anon.post("/api/auth/register", json=REG).json()
    token = r["dev_verification_link"].split("token=")[1]
    assert anon.post("/api/auth/verify-email", json={"token": "x" * 20}).status_code == 400
    assert anon.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    assert anon.post("/api/auth/verify-email", json={"token": token}).status_code == 400  # single use
    anon.cookies.clear()
    f = anon.post("/api/auth/forgot-password", json={"email": REG["email"]}).json()
    rtoken = f["dev_reset_link"].split("token=")[1]
    assert anon.post("/api/auth/reset-password", json={"token": rtoken, "new_password": "Brandnew123"}).status_code == 200
    assert anon.post("/api/auth/reset-password", json={"token": rtoken, "new_password": "Another1234"}).status_code == 400
    assert anon.post("/api/auth/login", json={"email": REG["email"], "password": "Brandnew123"}).status_code == 200
    unknown = anon.post("/api/auth/forgot-password", json={"email": "ghost@test.dev"}).json()
    assert "dev_reset_link" not in unknown  # no account => nothing prepared, same message


def test_tokens_are_stored_hashed(anon, db):
    r = anon.post("/api/auth/register", json=REG).json()
    raw = r["dev_verification_link"].split("token=")[1]
    assert db.scalar(select(AuthToken.token_hash)) != raw


def test_role_protection(anon, owner, admin):
    assert anon.get("/api/admin/overview").status_code == 401
    assert owner.get("/api/admin/overview").status_code == 403
    assert owner.get("/api/admin/audit-logs").status_code == 403
    assert admin.get("/api/admin/overview").status_code == 200


def test_verification_workflow(anon, db, admin):
    anon.post("/api/auth/register", json=REG)
    csrf = anon.get("/api/auth/me").json()["csrf_token"]
    h = {"X-CSRF-Token": csrf}
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082")
    data = {"college": "RIT", "student_id_number": "RIT22CS999"}
    files = {"document": ("id.png", png, "image/png")}
    assert anon.post("/api/verification", data=data, files=files, headers=h).status_code == 403  # email not verified yet
    u = db.scalar(select(User).where(User.email == REG["email"]))
    from datetime import datetime, timezone
    u.email_verified_at = datetime.now(timezone.utc)
    db.commit()
    bad = anon.post("/api/verification", data=data, files={"document": ("x.png", b"not an image", "image/png")}, headers=h)
    assert bad.status_code == 415  # real type is sniffed, header ignored
    ok = anon.post("/api/verification", data=data, files=files, headers=h)
    assert ok.status_code == 201
    assert anon.get("/api/auth/me").json()["user"]["verification_status"] == "pending"
    # unverified students cannot list or book
    assert anon.post("/api/resources", json={"name": "Thing", "category": "tool"}, headers=h).status_code == 403
    sid = ok.json()["id"]
    assert admin.post(f"/api/admin/verifications/{sid}/decision", json={"approve": False}).status_code == 422  # reason required
    assert admin.post(f"/api/admin/verifications/{sid}/decision", json={"approve": True}).status_code == 200
    me = anon.get("/api/auth/me").json()["user"]
    assert me["verification_status"] == "approved"
    assert anon.post("/api/resources", json={"name": "Thing", "category": "tool"}, headers=h).status_code == 201
    assert admin.post(f"/api/admin/verifications/{sid}/decision", json={"approve": True}).status_code == 409  # already decided
    # document is private
    assert anon.get(f"/api/verification/{sid}/document").status_code == 200
    other = make_user(db, "other@test.dev")
    assert Api("other@test.dev").get(f"/api/verification/{sid}/document").status_code == 404
    notes = anon.get("/api/notifications").json()["items"]
    assert any(n["type"] == "verification_result" for n in notes)
