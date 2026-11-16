import threading
from datetime import timedelta

from sqlalchemy import select

from app.models import Booking, BookingStatus, Notification, Resource
from tests.conftest import Api, book, iso, make_user, new_resource, now


def test_resource_crud_and_ownership(owner, borrower, admin, db):
    r = new_resource(owner)
    rid = r["id"]
    assert borrower.patch(f"/api/resources/{rid}", json={"name": "Hacked name"}).status_code == 404
    assert borrower.delete(f"/api/resources/{rid}").status_code == 404
    assert owner.patch(f"/api/resources/{rid}", json={"price_per_day": 120}).json()["price_per_day"] == 120
    assert owner.post("/api/resources", json={"name": "x", "category": "bogus"}).status_code == 422
    assert owner.post("/api/resources", json={"name": "Drill", "category": "tool", "price_per_day": -5}).status_code == 422
    assert admin.post("/api/resources", json={"name": "Drill", "category": "tool"}).status_code == 403  # admins do not list
    assert owner.delete(f"/api/resources/{rid}").status_code == 200
    assert borrower.get(f"/api/resources/{rid}").status_code == 404


def test_search_filter_sort_and_pagination(owner, borrower):
    new_resource(owner, name="Canon DSLR Camera", category="camera", price_per_day=200)
    new_resource(owner, name="Arduino Kit", category="electronics_kit", price_per_day=0)
    new_resource(owner, name="Epson Projector", category="projector", price_per_day=100)
    assert borrower.get("/api/resources?q=canon").json()["total"] == 1
    assert borrower.get("/api/resources?category=projector").json()["total"] == 1
    assert borrower.get("/api/resources?free_only=true").json()["items"][0]["name"] == "Arduino Kit"
    assert [i["price_per_day"] for i in borrower.get("/api/resources?sort=price_desc").json()["items"]] == [200, 100, 0]
    p = borrower.get("/api/resources?page_size=2&page=2").json()
    assert p["total"] == 3 and len(p["items"]) == 1 and p["pages"] == 2


def test_image_upload_validation(owner):
    rid = new_resource(owner)["id"]
    png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082")
    assert owner.post(f"/api/resources/{rid}/images", files={"file": ("a.png", png, "image/png")}).status_code == 201
    assert owner.post(f"/api/resources/{rid}/images", files={"file": ("a.png", b"GIF89a....", "image/png")}).status_code == 415
    assert owner.post(f"/api/resources/{rid}/images", files={"file": ("a.png", b"", "image/png")}).status_code == 422
    assert owner.get(f"/api/resources/{rid}").json()["images"][0]["url"].endswith("/images/1")


def test_booking_flow_end_to_end(owner, borrower, db):
    rid = new_resource(owner)["id"]
    assert owner.post("/api/bookings", json={"resource_id": rid, "start_at": iso(now() + timedelta(days=2)), "end_at": iso(now() + timedelta(days=2, hours=5))}).status_code == 409  # own item
    b = book(borrower, rid, note="Demo day")
    assert b.status_code == 201, b.text
    bid = b.json()["id"]
    assert b.json()["status"] == "requested" and b.json()["rental_amount"] == 100 and "DEMO" in b.json()["payment_notice"]
    assert any(n.type == "booking_request" for n in db.scalars(select(Notification)))
    assert borrower.post(f"/api/bookings/{bid}/approve").status_code == 403  # only the owner
    assert owner.get(f"/api/bookings/incoming?status=requested").json()["total"] == 1
    assert owner.post(f"/api/bookings/{bid}/approve").json()["status"] == "confirmed"
    assert owner.post(f"/api/bookings/{bid}/approve").status_code == 409  # invalid transition
    # the item is blocked for that period
    assert book(borrower, rid, start_h=49, hours=1).status_code == 409
    assert owner.post(f"/api/bookings/{bid}/handover", json={}).json()["status"] == "active"
    assert owner.post(f"/api/bookings/{bid}/return").status_code == 403  # borrower reports return
    assert borrower.post(f"/api/bookings/{bid}/return", data={"condition": "as_expected", "notes": "All good"}).json()["status"] == "returned"
    assert borrower.post(f"/api/bookings/{bid}/confirm-return", data={"condition": "as_expected"}).status_code == 403
    done = owner.post(f"/api/bookings/{bid}/confirm-return", data={"condition": "as_expected"}).json()
    assert done["status"] == "completed" and done["deposit_status"] == "demo_released"
    assert [h["to_status"] for h in done["history"]] == ["requested", "confirmed", "active", "returned", "completed"]
    assert db.scalar(select(Resource.last_booked_at).where(Resource.id == rid)) is not None
    # reviews: both sides once, nobody else
    stranger = make_user(db, "stranger@test.dev")
    assert Api("stranger@test.dev").post(f"/api/bookings/{bid}/reviews", json={"rating": 5}).status_code == 404
    assert borrower.post(f"/api/bookings/{bid}/reviews", json={"rating": 5, "comment": "Great"}).status_code == 201
    assert borrower.post(f"/api/bookings/{bid}/reviews", json={"rating": 4}).status_code == 409
    assert owner.post(f"/api/bookings/{bid}/reviews", json={"rating": 4}).status_code == 201
    assert borrower.post(f"/api/bookings/{bid}/reviews", json={"rating": 9}).status_code == 422
    assert borrower.get(f"/api/users/{done['owner']['id']}").json()["stats"]["average_rating"] == 5.0


def test_review_requires_completed_booking(owner, borrower):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    assert borrower.post(f"/api/bookings/{bid}/reviews", json={"rating": 5}).status_code == 409


def test_availability_rules(owner, borrower):
    rid = new_resource(owner, min_hours=3, max_days=2)["id"]
    assert book(borrower, rid, hours=1).status_code == 409  # below minimum
    assert book(borrower, rid, hours=24 * 3).status_code == 409  # above maximum
    assert book(borrower, rid, start_h=-48).status_code == 409  # in the past
    assert book(borrower, rid, start_h=24 * 40).status_code == 409  # outside the owner's window
    unlisted = new_resource(owner, offered=False)["id"]
    assert book(borrower, unlisted).status_code == 409  # not offered
    chk = borrower.get(f"/api/resources/{rid}/check", params={"start": iso(now() + timedelta(hours=48)), "end": iso(now() + timedelta(hours=52))}).json()
    assert chk["bookable"] and chk["estimated_cost"] == 100


def test_overlapping_requests_only_one_can_be_confirmed(owner, borrower, db):
    rid = new_resource(owner)["id"]
    make_user(db, "second@test.dev")
    second = Api("second@test.dev")
    b1 = book(borrower, rid, start_h=48, hours=6).json()["id"]
    b2 = book(second, rid, start_h=50, hours=6).json()["id"]  # overlapping request is allowed...
    assert owner.post(f"/api/bookings/{b1}/approve").status_code == 200
    r = owner.post(f"/api/bookings/{b2}/approve")  # ...but cannot also be confirmed
    assert r.status_code == 409
    assert db.scalar(select(Booking.status).where(Booking.id == b2)) == BookingStatus.requested


def test_database_constraint_blocks_double_booking_under_concurrency(owner, borrower, db):
    rid = new_resource(owner)["id"]
    make_user(db, "second@test.dev")
    second = Api("second@test.dev")
    ids = [book(borrower, rid, start_h=48, hours=6).json()["id"], book(second, rid, start_h=49, hours=6).json()["id"]]
    results = []

    def go(i):
        api = Api("owner@test.dev")
        results.append(api.post(f"/api/bookings/{ids[i]}/approve").status_code)

    threads = [threading.Thread(target=go, args=(i,)) for i in range(2)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert sorted(results) == [200, 409]
    db.expire_all()
    assert len(db.scalars(select(Booking).where(Booking.status == BookingStatus.confirmed)).all()) == 1


def test_reject_and_cancel_rules(owner, borrower, db):
    rid = new_resource(owner)["id"]
    b1 = book(borrower, rid, start_h=48).json()["id"]
    assert owner.post(f"/api/bookings/{b1}/reject", json={"reason": "Busy"}).json()["status"] == "rejected"
    assert borrower.post(f"/api/bookings/{b1}/cancel", json={}).status_code == 409
    b2 = book(borrower, rid, start_h=72).json()["id"]
    owner.post(f"/api/bookings/{b2}/approve")
    c = borrower.post(f"/api/bookings/{b2}/cancel", json={"reason": "Plans changed"}).json()
    assert c["status"] == "cancelled" and c["payment_status"] == "demo_refunded"
    assert book(borrower, rid, start_h=72).status_code == 201  # freed again
    b3 = book(borrower, rid, start_h=5, hours=3).json()["id"]
    owner.post(f"/api/bookings/{b3}/approve")
    late = borrower.post(f"/api/bookings/{b3}/cancel", json={}).json()
    assert late["late_cancellation"] is True


def test_damage_creates_dispute_and_admin_resolves(owner, borrower, admin, db):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    owner.post(f"/api/bookings/{bid}/approve")
    owner.post(f"/api/bookings/{bid}/handover", json={})
    borrower.post(f"/api/bookings/{bid}/return", data={"condition": "as_expected"})
    d = owner.post(f"/api/bookings/{bid}/confirm-return", data={"condition": "damaged", "notes": "Cracked lens"}).json()
    assert d["status"] == "disputed" and d["deposit_status"] == "demo_held"  # never auto-deducted
    reports = admin.get("/api/admin/reports").json()["items"]
    assert reports and reports[0]["kind"] == "damage"
    assert admin.post(f"/api/admin/reports/{reports[0]['id']}/resolve", json={"resolution": "Minor, release"}).status_code == 422
    ok = admin.post(f"/api/admin/reports/{reports[0]['id']}/resolve", json={"resolution": "Minor, release", "deposit_outcome": "release_deposit"})
    assert ok.status_code == 200
    assert owner.get(f"/api/bookings/{bid}").json()["status"] == "completed"
    assert borrower.get(f"/api/bookings/{bid}").json()["deposit_status"] == "demo_released"
    assert any(a["action"] == "dispute.resolve" for a in admin.get("/api/admin/audit-logs").json()["items"])


def test_booking_privacy(owner, borrower, db):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    make_user(db, "nosy@test.dev")
    assert Api("nosy@test.dev").get(f"/api/bookings/{bid}").status_code == 404


def test_notifications_read_state(owner, borrower):
    rid = new_resource(owner)["id"]
    book(borrower, rid)
    assert owner.get("/api/notifications/unread-count").json()["count"] == 1
    n = owner.get("/api/notifications").json()["items"][0]
    assert borrower.post(f"/api/notifications/{n['id']}/read").status_code == 404
    assert owner.post(f"/api/notifications/{n['id']}/read").json()["read"] is True
    assert owner.get("/api/notifications/unread-count").json()["count"] == 0
