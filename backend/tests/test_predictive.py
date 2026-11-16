from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.ml.forecasting import monday_of
from app.ml.synthetic import generate
from app.models import ActivationRequest, Booking, DemandHistory, Notification, Resource, User
from app.services.supply import demand_level, effective_supply, supply_gap
from tests.conftest import Api, book, iso, make_user, new_resource, now


def seed_history(db):
    rows, _ = generate(monday_of(now().date()) - timedelta(weeks=1))
    for r in rows:
        db.add(DemandHistory(source="synthetic", **r))
    db.commit()


def make_owners(db, n):
    out = []
    for i in range(n):
        make_user(db, f"o{i}@test.dev")
        out.append(Api(f"o{i}@test.dev"))
    return out


def backdate(db, rid, days):
    r = db.get(Resource, rid)
    r.last_booked_at = now() - timedelta(days=days)
    db.commit()


def week_start(req):
    return datetime.combine(date.fromisoformat(req["period_start"]), datetime.min.time(), tzinfo=timezone.utc) + timedelta(hours=9)


# ---- pure rules -----------------------------------------------------------------------------------------
def test_supply_gap_formula_and_levels():
    assert supply_gap(12, 5) == 7
    assert supply_gap(3.4, 5) == 0
    assert supply_gap(0, 0) == 0
    assert demand_level(12, 5) == "critical" and demand_level(4, 10) == "low" and demand_level(3, 0) == "critical"


# ---- effective supply -----------------------------------------------------------------------------------
def test_effective_supply_counts_each_eligible_resource_once(db, admin):
    a, b, c = make_owners(db, 3)
    ok = new_resource(a)["id"]
    new_resource(a, offered=False)  # listed but never offered -> not supply
    both = new_resource(b)["id"]  # a second window must not double count
    b.post(f"/api/resources/{both}/availability", json={"start_at": iso(now() + timedelta(days=1)), "end_at": iso(now() + timedelta(days=3))})
    paused = new_resource(c)["id"]
    c.patch(f"/api/resources/{paused}", json={"status": "inactive"})
    start = now().date() + timedelta(days=2)
    sup = effective_supply(db, start, start + timedelta(days=6))
    assert sup["projector"]["effective"] == 2
    assert set(sup["projector"]["resource_ids"]) == {ok, both}


def test_unverified_owner_is_not_supply(db, borrower):
    (a,) = make_owners(db, 1)
    new_resource(a)
    u = db.scalar(select(User).where(User.email == "o0@test.dev"))
    u.verification_status = type(u.verification_status).rejected
    db.commit()
    sup = effective_supply(db, now().date() + timedelta(days=2), now().date() + timedelta(days=8))
    assert sup.get("projector", {}).get("effective", 0) == 0


# ---- forecast -------------------------------------------------------------------------------------------
def test_forecast_requires_admin_and_history(owner, admin, db):
    assert owner.post("/api/admin/forecast/run").status_code == 403
    assert admin.post("/api/admin/forecast/run").status_code == 409  # honest error, no invented numbers
    assert owner.get("/api/forecast/latest").json() == {"available": False}


def test_forecast_run_output_and_labels(admin, owner, db):
    seed_history(db)
    r = admin.post("/api/admin/forecast/run")
    assert r.status_code == 200, r.text
    f = r.json()
    assert len(f["categories"]) == 8 and f["data_basis"] == "synthetic_only" and "SYNTHETIC" in f["data_note"]
    assert f["model_version"] and f["created_at"] and f["period_start"] < f["period_end"]
    assert {e["model_name"] for e in f["evaluations"]} == {"baseline_naive", "baseline_mean4", "ridge", "gradient_boosting"}
    assert sum(e["is_selected"] for e in f["evaluations"]) == 1
    for c in f["categories"]:
        assert c["lower"] <= c["predicted_demand"] <= c["upper"]
        assert c["supply_gap"] == max(0, round(c["predicted_demand"]) - c["effective_supply"])
    assert owner.get("/api/forecast/latest").json()["available"] is True
    assert any(a["action"] == "forecast.run" for a in admin.get("/api/admin/audit-logs").json()["items"])


def test_real_bookings_enter_training_history(admin, owner, borrower, db):
    seed_history(db)
    rid = new_resource(owner)["id"]
    assert book(borrower, rid).status_code == 201
    b = db.scalar(select(Booking))
    b.start_at = now() - timedelta(days=14)  # a completed past week
    b.end_at = b.start_at + timedelta(hours=4)
    db.commit()
    assert admin.post("/api/admin/forecast/run").json()["data_basis"] == "mixed"
    assert admin.get("/api/admin/forecast/latest").json()["data"]["real_bookings"] == 1


# ---- idle detection + activation ------------------------------------------------------------------------
def setup_shortage(db, admin, n_offered=1, n_idle=4):
    seed_history(db)
    owners = make_owners(db, n_offered + n_idle)
    offered = [new_resource(o, name=f"Offered {i}")["id"] for i, o in enumerate(owners[:n_offered])]
    idle = []
    for i, o in enumerate(owners[n_offered:]):
        rid = new_resource(o, name=f"Idle {i}", offered=False)["id"]
        backdate(db, rid, 30 + i)
        idle.append(rid)
    admin.post("/api/admin/forecast/run")
    return owners, offered, idle


def test_idle_resources_listed_with_transparent_metrics(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    items = admin.get("/api/admin/idle-resources").json()["items"]
    proj = [i for i in items if i["category"] == "projector"]
    assert {i["resource_id"] for i in proj} == set(idle)
    assert all(i["days_since_last_use"] >= 30 and i["opportunity"] in ("High", "Medium", "Low") for i in proj)
    assert not any(i["resource_id"] in offered for i in items)  # already offered -> not idle supply


def test_worn_and_opted_out_resources_are_not_candidates(db, admin):
    seed_history(db)
    a, b, c = make_owners(db, 3)
    worn = new_resource(a, offered=False, condition="worn")["id"]
    optout = new_resource(b, offered=False)["id"]
    fine = new_resource(c, offered=False)["id"]
    b.patch("/api/users/me", json={"open_to_activation": False})
    for rid in (worn, optout, fine):
        backdate(db, rid, 40)
    admin.post("/api/admin/forecast/run")
    assert {i["resource_id"] for i in admin.get("/api/admin/idle-resources").json()["items"]} == {fine}


def test_activation_requires_owner_consent_and_updates_supply(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    before = admin.get("/api/admin/supply-gap").json()
    proj = next(c for c in before["categories"] if c["category"] == "projector")
    assert proj["supply_gap"] > 0 and proj["eligible_idle"] == len(idle)
    gen = admin.post("/api/admin/activation/generate", json={"categories": ["projector"]}).json()
    assert gen["created"] == len(idle)
    assert all(db.get(Resource, rid).availability == [] for rid in idle)  # nothing activated without consent
    assert db.scalar(select(Notification).where(Notification.type == "activation_request")) is not None
    assert admin.post("/api/admin/activation/generate", json={"categories": ["projector"]}).json()["created"] == 0  # no duplicate asks
    owner_api = owners[1]
    req = owner_api.get("/api/activation/mine").json()[0]
    assert req["status"] == "pending" and "gap of" in req["reason"]
    start = week_start(req)
    body = {"available_from": iso(start), "available_until": iso(start + timedelta(days=3))}
    assert owners[2].post(f"/api/activation/{req['id']}/accept", json=body).status_code == 404  # not their request
    outside = owner_api.post(f"/api/activation/{req['id']}/accept", json={"available_from": iso(start - timedelta(days=30)), "available_until": iso(start)})
    assert outside.status_code == 422
    ok = owner_api.post(f"/api/activation/{req['id']}/accept", json=body)
    assert ok.status_code == 200 and ok.json()["status"] == "accepted"
    assert owner_api.post(f"/api/activation/{req['id']}/accept", json=body).status_code == 409
    proj2 = next(c for c in admin.get("/api/admin/supply-gap").json()["categories"] if c["category"] == "projector")
    assert proj2["effective_supply"] == proj["effective_supply"] + 1
    assert proj2["supply_gap"] == proj["supply_gap"] - 1
    rid = req["resource"]["id"]  # bookable inside the owner's window, and only there
    make_user(db, "student@test.dev")
    s = Api("student@test.dev")
    r = s.post("/api/bookings", json={"resource_id": rid, "start_at": iso(start + timedelta(hours=2)), "end_at": iso(start + timedelta(hours=8))})
    assert r.status_code == 201, r.text
    assert s.post("/api/bookings", json={"resource_id": rid, "start_at": iso(start + timedelta(days=5)), "end_at": iso(start + timedelta(days=5, hours=3))}).status_code == 409
    assert any(a["action"] == "activation.accept" for a in admin.get("/api/admin/audit-logs").json()["items"])
    stats = admin.get("/api/admin/activation").json()["stats"]
    assert stats["accepted"] == 1 and stats["pending"] == len(idle) - 1


def test_decline_and_withdraw(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1, o2 = owners[1], owners[2]
    r1 = o1.get("/api/activation/mine").json()[0]
    assert o1.post(f"/api/activation/{r1['id']}/decline", json={"reason": "Using it myself"}).json()["status"] == "declined"
    assert o1.post(f"/api/activation/{r1['id']}/withdraw").status_code == 409  # only accepted ones
    r2 = o2.get("/api/activation/mine").json()[0]
    start = week_start(r2)
    o2.post(f"/api/activation/{r2['id']}/accept", json={"available_from": iso(start), "available_until": iso(start + timedelta(days=2))})
    make_user(db, "stu@test.dev")
    stu = Api("stu@test.dev")
    b = stu.post("/api/bookings", json={"resource_id": r2["resource"]["id"], "start_at": iso(start + timedelta(hours=1)), "end_at": iso(start + timedelta(hours=6))}).json()
    o2.post(f"/api/bookings/{b['id']}/approve")
    assert o2.post(f"/api/activation/{r2['id']}/withdraw").status_code == 409  # a confirmed booking blocks withdrawal
    stu.post(f"/api/bookings/{b['id']}/cancel", json={})
    assert o2.post(f"/api/activation/{r2['id']}/withdraw").json()["status"] == "withdrawn"
    assert db.get(Resource, r2["resource"]["id"]).availability == []


def test_owner_weekly_request_cap(db, admin):
    seed_history(db)
    (o,) = make_owners(db, 1)
    for i in range(4):
        rid = new_resource(o, name=f"Projector {i}", offered=False)["id"]
        backdate(db, rid, 40)
    admin.post("/api/admin/forecast/run")
    admin.post("/api/admin/activation/generate", json={})
    assert len(db.scalars(select(ActivationRequest).where(ActivationRequest.owner_id == o.user["id"])).all()) == 2  # cap = 2 per week


# ---- matching -------------------------------------------------------------------------------------------
def test_matching_scores_are_explained_and_exclude_unavailable(db, borrower):
    a, b = make_owners(db, 2)
    good = new_resource(a, name="Epson Projector HD", price_per_day=80, pickup_area="Library", condition="new")["id"]
    new_resource(b, name="Old Projector", price_per_day=400, condition="worn")
    new_resource(a, name="Not Offered", offered=False)
    q = {"start": iso(now() + timedelta(days=2)), "end": iso(now() + timedelta(days=2, hours=5)), "category": "projector", "keywords": "epson hd", "area": "Library"}
    res = borrower.get("/api/matching", params=q).json()
    names = [m["resource"]["name"] for m in res["matches"]]
    assert names[0] == "Epson Projector HD" and "Not Offered" not in names
    top = res["matches"][0]
    assert 0 < top["score"] <= 100 and any("Matches" in r for r in top["reasons"]) and "Pickup in your preferred area" in top["reasons"]
    assert top["score"] > res["matches"][-1]["score"]
    budget = borrower.get("/api/matching", params={**q, "max_price_per_day": 100}).json()
    assert [m["resource"]["id"] for m in budget["matches"]] == [good] and budget["excluded_over_budget"] == 1
    far = borrower.get("/api/matching", params={**q, "start": iso(now() + timedelta(days=90)), "end": iso(now() + timedelta(days=90, hours=3))}).json()
    assert far["matches"] == []  # an unavailable period returns nothing instead of ranking unbookable items
    assert borrower.get("/api/matching", params={**q, "end": q["start"]}).status_code == 422


def test_admin_overview_reflects_data(db, admin, owner, borrower):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    owner.post(f"/api/bookings/{bid}/approve")
    o = admin.get("/api/admin/overview").json()
    assert o["users"]["verified"] == 2 and o["resources"]["active"] == 1 and o["bookings"]["by_status"]["confirmed"] == 1
    assert o["bookings"]["demo"] == 0
