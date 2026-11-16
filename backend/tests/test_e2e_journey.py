"""The full demonstration scenario from the project brief, driven through the real HTTP API."""
from datetime import date, datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.models import DemandHistory, Resource
from app.ml.forecasting import monday_of
from app.ml.synthetic import generate
from tests.conftest import PASSWORD, Api, iso, make_user, now

PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082")


def register_and_verify(db, admin, email, sid, name):
    c = TestClient(app)
    r = c.post("/api/auth/register", json={"name": name, "email": email, "student_id": sid, "department": "CSE", "password": PASSWORD})
    assert r.status_code == 201, r.text
    csrf = r.json()["csrf_token"]
    token = r.json()["dev_verification_link"].split("token=")[1]
    assert c.post("/api/auth/verify-email", json={"token": token}).status_code == 200
    h = {"X-CSRF-Token": csrf}
    v = c.post("/api/verification", data={"college": "RIT", "student_id_number": sid}, files={"document": ("id.png", PNG, "image/png")}, headers=h)
    assert v.status_code == 201, v.text
    assert admin.post(f"/api/admin/verifications/{v.json()['id']}/decision", json={"approve": True}).status_code == 200
    return Api(email)


def test_full_demo_scenario(db, admin):
    # 1-4: register, sign in, submit verification, admin approves
    owner = register_and_verify(db, admin, "owner@college.dev", "RIT22CS001", "Olivia Owner")
    borrower = register_and_verify(db, admin, "borrower@college.dev", "RIT22CS002", "Bilal Borrower")
    assert owner.get("/api/auth/me").json()["user"]["verification_status"] == "approved"

    # 5: verified student lists a projector with an availability schedule
    start = now() + timedelta(days=2)
    res = owner.post("/api/resources", json={"name": "Epson Projector", "category": "projector", "price_per_day": 150, "deposit": 1000, "pickup_area": "Library",
                                              "availability": [{"start_at": iso(now() - timedelta(hours=1)), "end_at": iso(now() + timedelta(days=30))}]})
    assert res.status_code == 201
    rid = res.json()["id"]

    # 6-8: another student finds it, requests it, owner approves
    assert any(i["id"] == rid for i in borrower.get("/api/resources?q=epson").json()["items"])
    b = borrower.post("/api/bookings", json={"resource_id": rid, "start_at": iso(start), "end_at": iso(start + timedelta(hours=5)), "note": "Project demo"})
    assert b.status_code == 201
    bid = b.json()["id"]
    assert owner.post(f"/api/bookings/{bid}/approve").json()["status"] == "confirmed"

    # 9-10: appears in both dashboards; resource unavailable for the confirmed period
    assert any(x["id"] == bid for x in owner.get("/api/dashboard/student").json()["upcoming_bookings"])
    assert any(x["id"] == bid for x in borrower.get("/api/dashboard/student").json()["upcoming_bookings"])
    chk = borrower.get(f"/api/resources/{rid}/check", params={"start": iso(start + timedelta(hours=1)), "end": iso(start + timedelta(hours=3))}).json()
    assert chk["bookable"] is False

    # 9b/11: handover, return, condition recorded, completed
    assert owner.post(f"/api/bookings/{bid}/handover", json={}).json()["status"] == "active"
    assert borrower.post(f"/api/bookings/{bid}/return", data={"condition": "as_expected", "notes": "Clean"}).json()["status"] == "returned"
    done = owner.post(f"/api/bookings/{bid}/confirm-return", data={"condition": "as_expected"}).json()
    assert done["status"] == "completed" and {c["kind"] for c in done["condition_reports"]} == {"handover", "return"}
    assert db.scalar(select(Resource.last_booked_at).where(Resource.id == rid)) is not None  # usage history updated

    # 12: reviews both ways
    assert borrower.post(f"/api/bookings/{bid}/reviews", json={"rating": 5, "comment": "Great"}).status_code == 201
    assert owner.post(f"/api/bookings/{bid}/reviews", json={"rating": 5}).status_code == 201

    # 13-14: new data feeds the forecast; a shortage is detected (synthetic history, labelled)
    rows, _ = generate(monday_of(now().date()) - timedelta(weeks=1))
    for r in rows:
        db.add(DemandHistory(source="synthetic", **r))
    db.commit()
    fc = admin.post("/api/admin/forecast/run").json()
    assert fc["data_basis"] in ("mixed", "synthetic_only") and "SYNTHETIC" in fc["data_note"].upper()
    proj = next(c for c in fc["categories"] if c["category"] == "projector")
    assert proj["supply_gap"] > 0

    # 15-16: idle resources owned by other verified students are identified and their owners asked
    idle_owners = []
    for i in range(3):
        o = register_and_verify(db, admin, f"idle{i}@college.dev", f"RIT22CS1{i}", f"Idle Owner {i}")
        r = o.post("/api/resources", json={"name": f"Spare projector {i}", "category": "projector", "price_per_day": 90}).json()
        db.get(Resource, r["id"]).last_booked_at = now() - timedelta(days=40)
        db.commit()
        idle_owners.append((o, r["id"]))
    assert admin.get("/api/admin/supply-gap").json()["categories"][0]["eligible_idle"] >= 0
    gen = admin.post("/api/admin/activation/generate", json={"categories": ["projector"]}).json()
    assert gen["created"] == 3
    before = next(c for c in admin.get("/api/admin/supply-gap").json()["categories"] if c["category"] == "projector")

    # nothing is bookable without consent
    stranger_book = borrower.post("/api/bookings", json={"resource_id": idle_owners[0][1], "start_at": iso(start + timedelta(days=3)), "end_at": iso(start + timedelta(days=3, hours=4))})
    assert stranger_book.status_code == 409

    # 17: an owner accepts
    o, spare_id = idle_owners[0]
    req = o.get("/api/activation/mine").json()[0]
    ws = datetime.combine(date.fromisoformat(req["period_start"]), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9)
    assert o.post(f"/api/activation/{req['id']}/accept", json={"available_from": iso(ws), "available_until": iso(ws + timedelta(days=3))}).status_code == 200

    # 18-19: supply and dashboard update; the newly shared resource is matched and bookable
    after = next(c for c in admin.get("/api/admin/supply-gap").json()["categories"] if c["category"] == "projector")
    assert after["effective_supply"] == before["effective_supply"] + 1 and after["supply_gap"] == before["supply_gap"] - 1
    m = borrower.get("/api/matching", params={"start": iso(ws + timedelta(hours=2)), "end": iso(ws + timedelta(hours=8)), "category": "projector"}).json()
    top = [x for x in m["matches"] if x["resource"]["id"] == spare_id]
    assert top and top[0]["newly_activated"] and top[0]["reasons"] and 0 < top[0]["score"] <= 100
    assert borrower.post("/api/bookings", json={"resource_id": spare_id, "start_at": iso(ws + timedelta(hours=2)), "end_at": iso(ws + timedelta(hours=8))}).status_code == 201

    # 20: admin analytics and audit trail reflect everything
    ov = admin.get("/api/admin/overview").json()
    assert ov["activation"]["by_status"]["accepted"] == 1 and ov["bookings"]["by_status"]["completed"] == 1
    actions = {a["action"] for a in admin.get("/api/admin/audit-logs?page_size=100").json()["items"]}
    assert {"verification.approve", "forecast.run", "activation.generate", "activation.accept"} <= actions
