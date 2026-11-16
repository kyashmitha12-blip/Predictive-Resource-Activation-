"""Coverage for the dedicated administrator login endpoint (POST /api/auth/admin-login), mapped
1:1 to the 10 scenarios in the brief. Every check goes through the real HTTP API, never the ORM
or the frontend, so a UI bypass can't fake a pass.
"""
from app.models import Role
from app.security.ratelimit import reset_rate_limits
from tests.conftest import PASSWORD, make_user


def test_1_valid_admin_credentials_access_the_admin_dashboard(db, anon):
    make_user(db, "root@test.dev", role=Role.admin)
    r = anon.post("/api/auth/admin-login", json={"email": "root@test.dev", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"
    assert anon.get("/api/admin/overview").status_code == 200


def test_2_invalid_admin_password_is_rejected(db, anon):
    make_user(db, "root2@test.dev", role=Role.admin)
    r = anon.post("/api/auth/admin-login", json={"email": "root2@test.dev", "password": "WrongPassword9!"})
    assert r.status_code == 401
    assert "incorrect" in r.json()["detail"].lower()


def test_3_student_credentials_through_admin_login_are_denied_and_start_no_session(db, anon):
    make_user(db, "stu@test.dev", role=Role.student)
    r = anon.post("/api/auth/admin-login", json={"email": "stu@test.dev", "password": PASSWORD})
    assert r.status_code == 403
    assert r.json()["detail"] == "Access denied. This login is only for authorized administrators."
    assert "pra_session" not in r.cookies  # a correct password for a non-admin must never start a session here
    assert anon.get("/api/auth/me").status_code == 401  # confirms no session leaked through


def test_4_unauthenticated_users_cannot_access_admin_routes(anon):
    for ep in ["/api/admin/overview", "/api/admin/audit-logs", "/api/admin/forecast/latest"]:
        assert anon.get(ep).status_code == 401, ep


def test_5_students_cannot_access_admin_apis_directly(owner):
    assert owner.get("/api/admin/overview").status_code == 403
    assert owner.get("/api/admin/users").status_code == 403


def test_6_url_change_to_admin_does_not_bypass_backend_authorization(owner):
    """The frontend route guard (RequireAuth role="admin") keeps a student off the admin UI, but
    the brief asks that changing the URL cannot bypass authorization - proven here at the one
    layer that actually matters: every /api/admin/* call is independently checked server-side,
    so even a student who forces the browser to the /admin URL gets no admin data back."""
    for ep in ["/api/admin/overview", "/api/admin/resources", "/api/admin/supply-gap", "/api/admin/activation"]:
        assert owner.get(ep).status_code == 403, ep


def test_7_forged_role_in_the_request_body_grants_nothing(db, anon):
    make_user(db, "stu2@test.dev", role=Role.student)
    # The login schemas accept only email+password (Strict models reject unknown fields), so a
    # client-supplied "role" can't reach the server's decision at all.
    r = anon.post("/api/auth/admin-login", json={"email": "stu2@test.dev", "password": PASSWORD, "role": "admin"})
    assert r.status_code == 422  # rejected before any auth logic runs
    r2 = anon.post("/api/auth/login", json={"email": "stu2@test.dev", "password": PASSWORD, "role": "admin"})
    assert r2.status_code == 422


def test_8_existing_student_login_still_works_exactly_as_before(db, anon):
    make_user(db, "stu3@test.dev", role=Role.student)
    r = anon.post("/api/auth/login", json={"email": "stu3@test.dev", "password": PASSWORD})
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "student"
    # the student-only admin-login door refuses them even though their password is correct
    assert anon.post("/api/auth/admin-login", json={"email": "stu3@test.dev", "password": PASSWORD}).status_code == 403


def test_9_existing_admin_dashboard_features_still_work_after_admin_login(db, anon):
    make_user(db, "root3@test.dev", role=Role.admin)
    anon.post("/api/auth/admin-login", json={"email": "root3@test.dev", "password": PASSWORD})
    for ep in ["/api/admin/overview", "/api/admin/users", "/api/admin/audit-logs"]:
        assert anon.get(ep).status_code == 200, ep


def test_10_admin_logout_works_correctly(db, anon):
    make_user(db, "root4@test.dev", role=Role.admin)
    anon.post("/api/auth/admin-login", json={"email": "root4@test.dev", "password": PASSWORD})
    assert anon.get("/api/auth/me").status_code == 200
    csrf = anon.post("/api/auth/admin-login", json={"email": "root4@test.dev", "password": PASSWORD}).json()["csrf_token"]
    assert anon.post("/api/auth/logout", headers={"X-CSRF-Token": csrf}).status_code == 200
    assert anon.get("/api/auth/me").status_code == 401
    assert anon.get("/api/admin/overview").status_code == 401


def test_suspended_admin_is_still_refused(db, anon):
    from app.models import AccountStatus
    u = make_user(db, "susp@test.dev", role=Role.admin)
    u.account_status = AccountStatus.suspended
    db.commit()
    r = anon.post("/api/auth/admin-login", json={"email": "susp@test.dev", "password": PASSWORD})
    assert r.status_code == 403
    assert "suspended" in r.json()["detail"].lower()


def test_admin_login_rate_limited_separately_from_student_login(db, anon, monkeypatch):
    reset_rate_limits()
    make_user(db, "root5@test.dev", role=Role.admin)
    # Sanity: enabling the limiter and hammering admin-login doesn't touch the student login bucket.
    import app.config as cfg
    monkeypatch.setattr(cfg.settings, "rate_limit_enabled", True)
    for _ in range(10):
        anon.post("/api/auth/admin-login", json={"email": "root5@test.dev", "password": "wrong"})
    blocked = anon.post("/api/auth/admin-login", json={"email": "root5@test.dev", "password": "wrong"})
    assert blocked.status_code == 429
    make_user(db, "other_student@test.dev", role=Role.student)
    assert anon.post("/api/auth/login", json={"email": "other_student@test.dev", "password": PASSWORD}).status_code == 200
