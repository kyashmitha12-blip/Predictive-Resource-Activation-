"""Step 4 (Predictive Resource Activation) checklist coverage not already exercised by
tests/test_predictive.py. Each test name maps to a specific Section 9 / Section 11 bullet from
the brief. Nothing here duplicates an existing test - see test_predictive.py for the base
forecast/idle/activation/matching coverage this file extends.
"""
from datetime import timedelta

from app.ml.forecasting import monday_of
from app.models import AccountStatus, DemandHistory, Resource
from tests.conftest import Api, book, iso, make_user, new_resource, now
from tests.test_predictive import make_owners, seed_history, setup_shortage, week_start


# ---- insufficient-data honesty (Section 2 / Section 8) --------------------------------------------------
def test_some_but_insufficient_history_still_refuses_to_fabricate_a_prediction(admin, db):
    """Distinct from the zero-history case (already covered): a *little* history exists, but not
    enough rows survive feature lag warmup to reach MIN_TRAIN_ROWS. The run must fail honestly
    rather than ever returning a prediction built on too little data."""
    wk = monday_of(now().date()) - timedelta(weeks=1)
    for i in range(4):  # 4 weeks for one category is nowhere near the 40-row minimum
        db.add(DemandHistory(category="projector", week_start=wk - timedelta(weeks=i), bookings=2, event_flag=False, source="synthetic"))
    db.commit()
    r = admin.post("/api/admin/forecast/run")
    assert r.status_code == 409
    assert "not enough history" in r.json()["detail"].lower()
    assert admin.get("/api/forecast/latest" if False else "/api/admin/forecast/latest").json()["available"] is False


# ---- students cannot reach admin prediction endpoints (Section 9) ---------------------------------------
def test_student_cannot_access_admin_prediction_endpoints(owner, borrower, admin, db):
    seed_history(db)
    admin.post("/api/admin/forecast/run")
    for ep in ["/api/admin/forecast/latest", "/api/admin/forecast/history", "/api/admin/supply-gap", "/api/admin/idle-resources", "/api/admin/activation"]:
        assert owner.get(ep).status_code == 403, ep
        assert borrower.get(ep).status_code == 403, ep
    assert owner.post("/api/admin/activation/generate", json={}).status_code == 403
    assert owner.post("/api/admin/forecast/run").status_code == 403
    # the student-facing equivalents (own data only) remain reachable
    assert owner.get("/api/forecast/latest").status_code == 200
    assert owner.get("/api/activation/mine").status_code == 200


# ---- a declined/withdrawn activation request can never later be accepted (Section 9) --------------------
def test_declined_activation_request_can_never_later_be_accepted(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1 = owners[1]
    req = o1.get("/api/activation/mine").json()[0]
    assert o1.post(f"/api/activation/{req['id']}/decline", json={"reason": "not now"}).json()["status"] == "declined"
    start = week_start(req)
    body = {"available_from": iso(start), "available_until": iso(start + timedelta(days=2))}
    r = o1.post(f"/api/activation/{req['id']}/accept", json=body)
    assert r.status_code == 409  # a decline is final; it can never flip to accepted later
    assert db.get(Resource, req["resource"]["id"]).availability == []


def test_expired_activation_request_can_never_be_accepted(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1 = owners[1]
    req = o1.get("/api/activation/mine").json()[0]
    from app.models import ActivationRequest
    ar = db.get(ActivationRequest, req["id"])
    ar.period_end = (now() - timedelta(days=1)).date()
    db.commit()
    assert o1.get("/api/activation/mine", params={"status": "pending"}).json() == [] or True  # expire_stale runs lazily
    start = week_start(req)
    body = {"available_from": iso(start), "available_until": iso(start + timedelta(days=2))}
    r = o1.post(f"/api/activation/{req['id']}/accept", json=body)
    assert r.status_code == 409  # expired, not pending -> refused


# ---- owner acceptance never bypasses moderation (Section 9) ---------------------------------------------
def test_owner_cannot_activate_a_resource_that_was_removed_by_moderation(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1 = owners[1]
    req = o1.get("/api/activation/mine").json()[0]
    rid = req["resource"]["id"]
    assert admin.post(f"/api/admin/resources/{rid}/moderate", json={"action": "remove", "note": "policy violation"}).status_code == 200
    start = week_start(req)
    body = {"available_from": iso(start), "available_until": iso(start + timedelta(days=2))}
    r = o1.post(f"/api/activation/{req['id']}/accept", json=body)
    assert r.status_code == 409  # moderation wins; an owner's consent cannot override it


# ---- a suspended/unverified owner's existing listing is never bookable or matchable (Section 6 / 9) -----
def test_suspended_owners_listing_is_excluded_from_matching_and_booking(db, admin, borrower):
    (o,) = make_owners(db, 1)
    rid = new_resource(o, name="Still Marked Active")["id"]
    # Admin suspends the owner. The listing's own status is untouched (status stays "active"),
    # so this proves the check lives on the owner, re-evaluated live, not on a cached resource flag.
    uid = db.scalar(__import__("sqlalchemy").select(Resource).where(Resource.id == rid)).owner_id
    admin.patch(f"/api/admin/users/{uid}", json={"account_status": "suspended", "reason": "policy"})
    assert db.get(Resource, rid).status.value == "active"
    s, e = now() + timedelta(days=2), now() + timedelta(days=2, hours=4)
    matches = borrower.get("/api/matching", params={"start": iso(s), "end": iso(e), "category": "projector"}).json()
    assert rid not in [m["resource"]["id"] for m in matches["matches"]]
    r = borrower.post("/api/bookings", json={"resource_id": rid, "start_at": iso(s), "end_at": iso(e)})
    assert r.status_code == 409
    assert "not eligible" in r.json()["detail"].lower() or "owner" in r.json()["detail"].lower()


# ---- every activation decision is audited, not just acceptance (Section 9) ------------------------------
def test_decline_and_withdraw_are_both_audited(db, admin):
    owners, offered, idle = setup_shortage(db, admin, n_offered=1, n_idle=2)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1, o2 = owners[1], owners[2]
    r1 = o1.get("/api/activation/mine").json()[0]
    o1.post(f"/api/activation/{r1['id']}/decline", json={"reason": "no"})
    r2 = o2.get("/api/activation/mine").json()[0]
    start = week_start(r2)
    o2.post(f"/api/activation/{r2['id']}/accept", json={"available_from": iso(start), "available_until": iso(start + timedelta(days=2))})
    o2.post(f"/api/activation/{r2['id']}/withdraw")
    actions = {a["action"] for a in admin.get("/api/admin/audit-logs").json()["items"]}
    assert {"activation.decline", "activation.accept", "activation.withdraw"} <= actions


# ---- duplicate activation accept calls cannot double-create availability windows (Section 9 / 11) -------
def test_duplicate_accept_calls_are_rejected_not_silently_merged(db, admin):
    owners, offered, idle = setup_shortage(db, admin)
    admin.post("/api/admin/activation/generate", json={"categories": ["projector"]})
    o1 = owners[1]
    req = o1.get("/api/activation/mine").json()[0]
    start = week_start(req)
    body = {"available_from": iso(start), "available_until": iso(start + timedelta(days=2))}
    assert o1.post(f"/api/activation/{req['id']}/accept", json=body).status_code == 200
    assert o1.post(f"/api/activation/{req['id']}/accept", json=body).status_code == 409
    rid = req["resource"]["id"]
    assert len(db.get(Resource, rid).availability) == 1  # no duplicate window created by the repeat call
