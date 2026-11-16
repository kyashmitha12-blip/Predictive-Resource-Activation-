"""Explicit coverage of the Step 3 security/workflow checklist (marketplace + both dashboards).
Each test name matches one bullet from that checklist. All enforcement is server-side: every
call here goes through the real HTTP API, never the ORM, so a frontend bypass can't fake a pass.
"""
from app.models import Role
from tests.conftest import Api, book, make_user, new_resource


def test_student_a_cannot_edit_student_bs_listing(owner, borrower):
    rid = new_resource(owner)["id"]
    r = borrower.patch(f"/api/resources/{rid}", json={"name": "Hacked"})
    assert r.status_code == 404  # not merely hidden in the UI: the API itself refuses it
    assert owner.get(f"/api/resources/{rid}").json()["name"] != "Hacked"


def test_student_a_cannot_remove_student_bs_listing(owner, borrower):
    rid = new_resource(owner)["id"]
    assert borrower.delete(f"/api/resources/{rid}").status_code == 404
    assert owner.get(f"/api/resources/{rid}").status_code == 200


def test_owner_cannot_approve_their_own_booking_request(owner, db):
    """A student can never be both parties: booking your own listed resource is refused outright,
    so there is no booking where the 'owner' could approve themselves."""
    rid = new_resource(owner)["id"]
    r = book(owner, rid)
    assert r.status_code == 409
    assert "own" in r.json()["detail"].lower()


def test_student_a_cannot_approve_student_bs_booking_request(owner, borrower, db):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    make_user(db, "outsider@test.dev")
    outsider = Api("outsider@test.dev")
    # Someone with no relationship to the booking isn't even told it exists (404), never shown a 403 to probe with.
    assert outsider.post(f"/api/bookings/{bid}/approve").status_code == 404
    assert borrower.post(f"/api/bookings/{bid}/approve").status_code == 403  # the requester is a real party, just not the owner
    assert owner.post(f"/api/bookings/{bid}/approve").status_code == 200  # only the real owner can


def test_student_a_cannot_reject_or_handover_student_bs_booking(owner, borrower, db):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    make_user(db, "outsider2@test.dev")
    outsider = Api("outsider2@test.dev")
    assert outsider.post(f"/api/bookings/{bid}/reject", json={"reason": "no"}).status_code == 404
    assert outsider.post(f"/api/bookings/{bid}/handover", json={}).status_code == 404
    assert borrower.post(f"/api/bookings/{bid}/handover", json={}).status_code == 403  # borrower isn't the owner


def test_borrower_cannot_confirm_their_own_return(owner, borrower):
    rid = new_resource(owner)["id"]
    bid = book(borrower, rid).json()["id"]
    owner.post(f"/api/bookings/{bid}/approve")
    owner.post(f"/api/bookings/{bid}/handover", json={})
    borrower.post(f"/api/bookings/{bid}/return", data={"condition": "as_expected"})
    assert borrower.post(f"/api/bookings/{bid}/confirm-return", data={"condition": "as_expected"}).status_code == 403


def test_student_cannot_reach_admin_endpoints_even_with_a_valid_session(owner, borrower, admin):
    for ep in ["/api/admin/overview", "/api/admin/audit-logs", "/api/admin/supply-gap", "/api/admin/users", "/api/admin/verifications"]:
        assert owner.get(ep).status_code == 403, ep
        assert borrower.get(ep).status_code == 403, ep
    assert admin.get("/api/admin/overview").status_code == 200


def test_student_cannot_self_promote_or_act_as_admin_by_request_body(anon, db):
    make_user(db, "sneaky@test.dev")
    sneaky = Api("sneaky@test.dev")
    reg = anon.post("/api/auth/register", json={"name": "X", "email": "x2@test.dev", "student_id": "RIT1", "department": "CSE", "password": "Passw0rd1!", "role": "admin"})
    assert reg.status_code == 422  # role is not an accepted field; schema rejects the extra key
    me = sneaky.get("/api/auth/me").json()["user"]
    assert me["role"] == "student"


def test_unverified_student_cannot_list_a_resource_or_book_one(anon, owner, db):
    reg = anon.post("/api/auth/register", json={"name": "Unver", "email": "unver@test.dev", "student_id": "RIT2", "department": "CSE", "password": "Passw0rd1!"})
    csrf = reg.json()["csrf_token"]
    h = {"X-CSRF-Token": csrf}
    assert anon.post("/api/resources", json={"name": "Thing", "category": "tool"}, headers=h).status_code == 403
    rid = new_resource(owner)["id"]
    s = __import__("tests.conftest", fromlist=["now"]).now()
    from datetime import timedelta
    body = {"resource_id": rid, "start_at": (s + timedelta(hours=10)).isoformat().replace("+00:00", "Z"),
            "end_at": (s + timedelta(hours=14)).isoformat().replace("+00:00", "Z")}
    assert anon.post("/api/bookings", json=body, headers=h).status_code == 403


def test_booking_requests_cannot_exceed_offered_availability_window(owner, borrower):
    rid = new_resource(owner)["id"]  # offered window is [now-1h, now+30d]
    from datetime import timedelta
    from tests.conftest import iso, now
    s = now() + timedelta(days=31)  # outside the offered window
    r = borrower.post("/api/bookings", json={"resource_id": rid, "start_at": iso(s), "end_at": iso(s + timedelta(hours=2))})
    assert r.status_code == 409


def test_two_students_cannot_both_reserve_an_overlapping_slot(owner, borrower, db):
    rid = new_resource(owner)["id"]
    b1 = book(borrower, rid).json()
    owner.post(f"/api/bookings/{b1['id']}/approve")
    make_user(db, "third@test.dev")
    third = Api("third@test.dev")
    overlap = third.post("/api/bookings", json={"resource_id": rid, "start_at": b1["start_at"], "end_at": b1["end_at"]})
    assert overlap.status_code == 409


def test_unauthenticated_requests_to_protected_endpoints_are_rejected(anon):
    assert anon.post("/api/resources", json={"name": "x", "category": "tool"}).status_code == 401
    assert anon.get("/api/bookings/mine").status_code == 401
    assert anon.get("/api/admin/overview").status_code == 401
    assert anon.post("/api/bookings/1/approve").status_code == 401
