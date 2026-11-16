import os
import tempfile

# Must be set before the app is imported: tests run against an isolated database, never dev/production data.
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg2://pra:pra_dev_password@localhost:5432/pra_test")
os.environ["ENV"] = "test"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["LOCAL_STORAGE_DIR"] = tempfile.mkdtemp(prefix="pra_test_files_")
os.environ.pop("SMTP_HOST", None)

from datetime import datetime, timedelta, timezone  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Resource, ResourceAvailability, Role, User, VerificationStatus  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.security.passwords import hash_password  # noqa: E402

assert "pra_test" in str(engine.url), "refusing to run tests against a non-test database"
PASSWORD = "Test1234pass"


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as c:
        c.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config("alembic.ini")
    command.upgrade(cfg, "head")  # tests exercise the real migrations
    yield


@pytest.fixture(autouse=True)
def clean():
    with engine.begin() as c:
        names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
        c.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    with SessionLocal() as s:
        yield s


def now():
    return datetime.now(timezone.utc).replace(microsecond=0)


def make_user(db, email, role=Role.student, verified=True, name=None, sid=None):
    u = User(email=email, name=name or email.split("@")[0].title(), student_id=sid or email.split("@")[0].upper() + "1",
             department="CSE", password_hash=hash_password(PASSWORD), role=role,
             email_verified_at=now() if verified else None,
             verification_status=VerificationStatus.approved if verified else VerificationStatus.not_submitted)
    db.add(u)
    db.commit()
    return u


class Api:
    """A logged-in test client that sends the CSRF header automatically."""
    def __init__(self, email):
        self.c = TestClient(app)
        r = self.c.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        assert r.status_code == 200, r.text
        self.csrf = r.json()["csrf_token"]
        self.user = r.json()["user"]

    def _h(self):
        return {"X-CSRF-Token": self.csrf}

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, **kw):
        return self.c.post(url, headers=self._h(), **kw)

    def patch(self, url, **kw):
        return self.c.patch(url, headers=self._h(), **kw)

    def delete(self, url, **kw):
        return self.c.delete(url, headers=self._h(), **kw)


@pytest.fixture
def anon():
    return TestClient(app)


@pytest.fixture
def admin(db):
    make_user(db, "admin@test.dev", role=Role.admin)
    return Api("admin@test.dev")


@pytest.fixture
def owner(db):
    make_user(db, "owner@test.dev")
    return Api("owner@test.dev")


@pytest.fixture
def borrower(db):
    make_user(db, "borrower@test.dev")
    return Api("borrower@test.dev")


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def new_resource(api, db=None, category="projector", offered=True, **kw):
    body = {"name": "Epson Projector", "category": category, "price_per_day": 100, "deposit": 500, "pickup_area": "Library", **kw}
    if offered:
        body["availability"] = [{"start_at": iso(now() - timedelta(hours=1)), "end_at": iso(now() + timedelta(days=30))}]
    r = api.post("/api/resources", json=body)
    assert r.status_code == 201, r.text
    return r.json()


def book(api, rid, start_h=48, hours=4, note=""):
    s = now() + timedelta(hours=start_h)
    return api.post("/api/bookings", json={"resource_id": rid, "start_at": iso(s), "end_at": iso(s + timedelta(hours=hours)), "note": note})
