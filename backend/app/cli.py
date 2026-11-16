"""Command line tools.

  python -m app.cli create-admin --email you@college.edu --name "Your Name"     (prompts for the password)
  python -m app.cli create-admin --from-env                                       (ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD)
  python -m app.cli seed [--reset] [--generate-activation]                        (development demo data only)
  python -m app.cli run-forecast                                                  (e.g. from a daily scheduler)
"""
import argparse
import getpass
import os
import random
import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.config import settings
from app.database import SessionLocal, engine
from app.models import *  # noqa: F401,F403
from app.models import (ActivationRequest, ActivationStatus, AuditLog, Booking, BookingStatus, BookingStatusHistory, ConditionReport,
                        ConditionReportKind, Condition, DemandHistory, PlatformSetting, Report, ReportKind, ReportStatus, Resource,
                        ResourceAvailability, ResourceStatus, Review, Role, User, VerificationStatus, VerificationSubmission)
from app.models.base import Base
from app.security.passwords import hash_password, password_problems
from app.services import activation, forecast_service
from app.services.core import audit, notify, notify_admins

DEMO_DOMAIN = "demo.campus.test"
DEMO_PASSWORD = "Demo#Pass2026"  # development demo accounts only; never used in production


def create_admin(args) -> int:
    email = (os.getenv("ADMIN_EMAIL") if args.from_env else args.email or "").strip().lower()
    name = (os.getenv("ADMIN_NAME") if args.from_env else args.name) or "Administrator"
    password = os.getenv("ADMIN_PASSWORD") if args.from_env else (os.getenv("ADMIN_PASSWORD") or getpass.getpass("Admin password: "))
    if not email or not password:
        print("Email and password are required.", file=sys.stderr)
        return 2
    problems = password_problems(password)
    if problems or (settings.is_production and len(password) < 12):
        print("Password too weak: needs " + ", ".join(problems or ["12+ characters in production"]), file=sys.stderr)
        return 2
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            if existing.role == Role.admin:
                print(f"Admin {email} already exists - nothing changed.")
                return 0
            print("A non-admin account with this email exists. Refusing to promote it automatically.", file=sys.stderr)
            return 1
        db.add(User(email=email, name=name, student_id=f"ADMIN-{random.randint(10000, 99999)}", department="Administration",
                    password_hash=hash_password(password), role=Role.admin, email_verified_at=datetime.now(timezone.utc),
                    verification_status=VerificationStatus.approved))
        db.commit()
    print(f"Created administrator {email}.")
    return 0


def run_forecast_cmd(_args) -> int:
    with SessionLocal() as db:
        run_id = forecast_service.run(db, None)
    print("Forecast run", run_id)
    return 0


# ----------------------------------------------------------------------------------------------------------------------
def seed(args) -> int:
    if settings.is_production:
        print("Refusing to seed demo data in production.", file=sys.stderr)
        return 1
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.email.like(f"%@{DEMO_DOMAIN}"))):
            if not args.reset:
                print("Demo data already exists. Use --reset to wipe ALL data and re-seed (development only).", file=sys.stderr)
                return 1
    if args.reset:
        with engine.begin() as c:
            names = ", ".join(f'"{t.name}"' for t in Base.metadata.sorted_tables)
            c.execute(text(f"TRUNCATE {names} RESTART IDENTITY CASCADE"))
    rng = random.Random(7)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    ph = hash_password(DEMO_PASSWORD)
    with SessionLocal() as db:
        # ---------------- users ----------------
        def mk(name, dept, sid, status=VerificationStatus.approved, email_ok=True, role=Role.student, reason=None, local=None):
            u = User(email=f"{local or name.split()[0].lower()}@{DEMO_DOMAIN}", name=name, student_id=sid, department=dept,
                     college="Rajalakshmi Institute of Technology (demo)", password_hash=ph, role=role,
                     email_verified_at=now if email_ok else None, verification_status=status, verification_reason=reason,
                     preferred_area=rng.choice(["Main Block", "Library", "Hostel Gate", "Workshop Block", "Canteen"]), is_demo=True)
            db.add(u)
            return u
        admin = mk("Campus Admin", "Administration", "ADMIN-DEMO", role=Role.admin, local="admin")
        names = [("Aisha Rahman", "CSE"), ("Ravi Kumar", "ECE"), ("Meera Nair", "EEE"), ("Karthik Subramanian", "IT"),
                 ("Divya Lakshmi", "AI&DS"), ("Arjun Menon", "CSE"), ("Sneha Iyer", "ECE"), ("Rohit Sharma", "Mech"),
                 ("Priya Venkat", "IT"), ("Imran Khan", "CSE"), ("Lakshmi Narayanan", "EEE"), ("Surya Prakash", "ECE"),
                 ("Fatima Begum", "AI&DS"), ("Dinesh Babu", "Mech")]
        owners = [mk(n, d, f"RIT22{d[:2].upper()}{i + 1:03d}") for i, (n, d) in enumerate(names)]
        pending = mk("Nisha Patel", "CSE", "RIT22CS101", VerificationStatus.pending)
        rejected = mk("Vikram Singh", "Mech", "RIT22ME102", VerificationStatus.rejected,
                      reason="The uploaded ID photo was unreadable. Please upload a clearer image.")
        mk("Tarun Joshi", "IT", "RIT22IT103", VerificationStatus.not_submitted, email_ok=False)
        db.flush()
        png = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0f01f0005000201a5f645400000000049454e44ae426082")
        from app.storage import get_storage
        for u, st, reason in ((pending, VerificationStatus.pending, None), (rejected, VerificationStatus.rejected, rejected.verification_reason)):
            key = f"verification/{u.id}/demo-placeholder.png"
            get_storage().put(key, png, "image/png")
            db.add(VerificationSubmission(user_id=u.id, college=u.college, student_id_number=u.student_id, note="Demo placeholder document",
                                          document_key=key, status=st, reviewed_by=admin.id if reason else None,
                                          reviewed_at=now if reason else None, decision_reason=reason))
        for u in owners:
            db.add(AuditLog(actor_id=admin.id, action="verification.approve", entity_type="user", entity_id=u.id, details={"seed": True}))
        notify_admins(db, "verification_submitted", "New verification request", f"{pending.name} ({pending.student_id})", "/admin/verifications")

        # ---------------- resources ----------------
        catalog = {
            "projector": (4, 150, 1500, ["Epson EB-X06", "BenQ MS550", "Acer X1123H", "ViewSonic PA503S", "Optoma HD146X", "Epson EB-E01",
                                         "Sony VPL-DX221", "Dell S510", "Portable Mini LED Projector", "BenQ GV1", "Canon LV-X320", "Panasonic PT-LB306"]),
            "camera": (5, 250, 3000, ["Canon EOS 1500D", "Nikon D3500", "Sony Alpha a6000", "GoPro Hero 9", "Canon EOS 200D", "Fujifilm X-T200",
                                      "Manfrotto Compact Tripod", "DJI OM4 Gimbal", "Nikon D5600", "Panasonic Lumix G7"]),
            "audio": (8, 80, 800, ["Shure SM58 Microphone", "Boya BY-M1 Lavalier Mic", "JBL PartyBox 110", "Behringer Xenyx Mixer", "Zoom H4n Recorder",
                                   "Boat Stone Speaker Set", "Rode VideoMic", "Samson Q2U USB Mic"]),
            "electronics_kit": (7, 40, 400, ["Arduino Uno Starter Kit", "ESP32 Dev Kit", "Raspberry Pi 4 (4GB) Kit", "37-in-1 Sensor Pack", "Soldering Station Kit",
                                             "Arduino Mega Kit", "Jetson Nano Dev Kit", "Breadboard & Jumper Pack", "Logic Analyzer 8ch", "STM32 Nucleo Board",
                                             "Arduino Nano IoT Kit", "Motor Driver & Servo Pack", "Raspberry Pi Pico Kit"]),
            "laptop": (6, 120, 2500, ["Lenovo ThinkPad T480", "MacBook Air M1", "HP Pavilion 15", "Dell Inspiron 5570", "Portable 15\" Monitor", "Laptop Cooling Pad + USB Hub"]),
            "lab_equipment": (5, 100, 2000, ["Digital Storage Oscilloscope", "Function Generator", "Bench Power Supply 30V", "Digital Multimeter Set", "Logic Trainer Kit"]),
            "tool": (6, 60, 600, ["Bosch Cordless Drill", "Soldering Iron 60W", "Heat Gun", "Dremel Rotary Tool", "Hand Tool Set", "Crimping & Stripping Kit"]),
            "event_equipment": (4, 90, 1000, ["Foldable Backdrop Stand", "LED Par Light Set (4)", "Banner Stand Pair", "Extension Reel Pack", "Portable Whiteboard", "Podium Mic Stand"]),
        }
        areas = ["Main Block", "Library", "Hostel Gate", "Workshop Block", "Canteen", "Auditorium"]
        conditions = [Condition.new, Condition.good, Condition.good, Condition.fair]
        all_res: dict[str, list[tuple[Resource, bool]]] = {}
        k = 0
        for cat, (n_offered, base_price, dep, items) in catalog.items():
            all_res[cat] = []
            for i, name in enumerate(items):
                offered = i < n_offered
                owner = owners[(k * 5 + i) % len(owners)]
                k += 1
                cond = Condition.worn if (not offered and i == len(items) - 1 and cat == "projector") else rng.choice(conditions)
                price = 0 if rng.random() < 0.15 else round(base_price * rng.choice([0.6, 0.8, 1, 1.2]) / 10) * 10
                r = Resource(owner_id=owner.id, name=name, category=cat, description=f"{name} in {cond.value} condition. Seeded demo listing - replace with your own.",
                             condition=cond, price_per_day=price, deposit=dep if price else dep // 2, pickup_area=rng.choice(areas),
                             min_hours=2, max_days=7, is_demo=True,
                             status=ResourceStatus.active if (offered or i % 2 == 0) else ResourceStatus.inactive)
                db.add(r)
                db.flush()
                if offered:
                    db.add(ResourceAvailability(resource_id=r.id, start_at=now - timedelta(days=1), end_at=now + timedelta(days=28), source="owner"))
                all_res[cat].append((r, offered))

        # ---------------- bookings ----------------
        def add_booking(r: Resource, borrower: User, start, end, status: BookingStatus, **kw) -> Booking:
            b = Booking(resource_id=r.id, borrower_id=borrower.id, owner_id=r.owner_id, start_at=start, end_at=end, status=status, is_demo=True,
                        rental_amount=float(r.price_per_day) * max(1, -(-int((end - start).total_seconds()) // 86400)),
                        deposit_amount=r.deposit, note=kw.pop("note", ""), created_at=start - timedelta(days=2), **kw)
            db.add(b)
            db.flush()
            chain = {BookingStatus.requested: ["requested"], BookingStatus.confirmed: ["requested", "confirmed"],
                     BookingStatus.active: ["requested", "confirmed", "active"], BookingStatus.returned: ["requested", "confirmed", "active", "returned"],
                     BookingStatus.completed: ["requested", "confirmed", "active", "returned", "completed"],
                     BookingStatus.disputed: ["requested", "confirmed", "active", "returned", "disputed"],
                     BookingStatus.cancelled: ["requested", "cancelled"], BookingStatus.rejected: ["requested", "rejected"]}[status]
            prev = None
            for j, st in enumerate(chain):
                db.add(BookingStatusHistory(booking_id=b.id, from_status=prev, to_status=st, actor_id=borrower.id if j == 0 else r.owner_id,
                                            note="Seeded demo record", created_at=start - timedelta(days=2) + timedelta(hours=j * 6)))
                prev = st
            b.payment_status = "demo_paid" if status in (BookingStatus.confirmed, BookingStatus.active, BookingStatus.returned, BookingStatus.completed, BookingStatus.disputed) and r.price_per_day > 0 else ("demo_pending" if status == BookingStatus.requested and r.price_per_day > 0 else "not_required")
            b.deposit_status = {"confirmed": "demo_held", "active": "demo_held", "returned": "demo_held", "disputed": "demo_held", "completed": "demo_released"}.get(status.value, "none")
            return b

        def other(u: User) -> User:
            return rng.choice([o for o in owners if o.id != u.id])

        completed: list[Booking] = []
        for cat, lst in all_res.items():
            for r, offered in lst:
                owner = db.get(User, r.owner_id)
                if offered:                                   # recently used: a few completed rentals in the last 30 days
                    for _ in range(rng.randint(1, 3)):
                        d = rng.randint(3, 27)
                        s = (now - timedelta(days=d)).replace(hour=rng.choice([9, 11, 14]))
                        e = s + timedelta(hours=rng.choice([6, 24, 48]))
                        b = add_booking(r, other(owner), s, e, BookingStatus.completed, returned_at=e - timedelta(hours=1), completed_at=e, returned_on_time=rng.random() > 0.1)
                        r.last_booked_at = max(r.last_booked_at or e, e)
                        completed.append(b)
                elif rng.random() < 0.8:                      # idle: last used a long time ago (or never)
                    ago = rng.randint(16, 85)
                    s = now - timedelta(days=ago)
                    e = s + timedelta(hours=24)
                    b = add_booking(r, other(owner), s, e, BookingStatus.completed, returned_at=e, completed_at=e, returned_on_time=True)
                    r.last_booked_at = e
                    completed.append(b)
        # reviews on most completed rentals (both directions)
        for b in completed:
            if rng.random() < 0.7:
                db.add(Review(booking_id=b.id, reviewer_id=b.borrower_id, reviewee_id=b.owner_id, rating=rng.choice([4, 5, 5, 5, 4, 3]), comment=rng.choice(["Smooth handover, item as described.", "Very helpful owner.", "Worked well for our project demo.", "Slightly late reply but all good."])))
            if rng.random() < 0.5:
                db.add(Review(booking_id=b.id, reviewer_id=b.owner_id, reviewee_id=b.borrower_id, rating=rng.choice([5, 5, 4, 4, 3]), comment=rng.choice(["Returned on time and clean.", "Polite and careful.", "Good communication."])))
        db.flush()

        s0 = now + timedelta(days=2)
        # pending requests (owners see them in Incoming)
        for cat, who, off in (("projector", owners[1], 0), ("camera", owners[2], 0), ("electronics_kit", owners[3], 0)):
            r = [r for r, o in all_res[cat] if o][off]
            borrower = who if who.id != r.owner_id else owners[5]
            add_booking(r, borrower, s0 + timedelta(days=1), s0 + timedelta(days=1, hours=8), BookingStatus.requested, note="Need it for our department demo.")
            notify(db, r.owner_id, "booking_request", f"New booking request for {r.name}", f"{borrower.name} would like to borrow it.", "/app/requests")
        # confirmed upcoming
        for cat, idx in (("audio", 1), ("laptop", 0), ("lab_equipment", 2)):
            r = [r for r, o in all_res[cat] if o][idx]
            add_booking(r, other(db.get(User, r.owner_id)), s0 + timedelta(days=2), s0 + timedelta(days=2, hours=10), BookingStatus.confirmed)
        # active now, awaiting return confirmation, disputed
        r = [r for r, o in all_res["tool"] if o][0]
        add_booking(r, other(db.get(User, r.owner_id)), now - timedelta(hours=3), now + timedelta(hours=21), BookingStatus.active)
        r = [r for r, o in all_res["event_equipment"] if o][0]
        e = now - timedelta(hours=2)
        add_booking(r, other(db.get(User, r.owner_id)), e - timedelta(hours=8), e, BookingStatus.returned, returned_at=e, returned_on_time=True)
        r = [r for r, o in all_res["camera"] if o][1]
        e = now - timedelta(days=1)
        bd = add_booking(r, other(db.get(User, r.owner_id)), e - timedelta(hours=24), e, BookingStatus.disputed, returned_at=e, returned_on_time=True)
        db.add(ConditionReport(booking_id=bd.id, kind=ConditionReportKind.returned, reporter_id=bd.owner_id, condition="damaged", notes="Lens cap missing and a scratch on the body.", photo_keys=[]))
        db.add(Report(reporter_id=bd.owner_id, kind=ReportKind.damage, target_type="booking", target_id=bd.id, booking_id=bd.id, description="Lens cap missing and a scratch on the body.", status=ReportStatus.open))
        notify_admins(db, "dispute_opened", "Damage dispute needs review", f"Booking #{bd.id}", "/admin/reports")
        for cat, ix, st in (("audio", 2, BookingStatus.cancelled), ("laptop", 1, BookingStatus.rejected)):
            r = [r for r, o in all_res[cat] if o][ix]
            add_booking(r, other(db.get(User, r.owner_id)), s0 + timedelta(days=5), s0 + timedelta(days=5, hours=6), st)
        pj = all_res["projector"][4][0]
        db.add(Report(reporter_id=owners[4].id, kind=ReportKind.complaint, target_type="resource", target_id=pj.id, description="Listing says full HD but my test showed lower resolution (demo complaint).", status=ReportStatus.open))

        # ---------------- demand history (SYNTHETIC) + event calendar ----------------
        from app.ml.forecasting import monday_of
        from app.ml.synthetic import generate
        last_complete = monday_of(now.date()) - timedelta(weeks=1)
        rows, event_weeks = generate(last_complete)
        for r_ in rows:
            db.add(DemandHistory(source="synthetic", **r_))
        target_week = monday_of(now.date()) + timedelta(weeks=1)
        db.add(PlatformSetting(key="event_weeks", value=[target_week.isoformat()]))  # demo event calendar: "hackathon week"
        db.commit()

        forecast_service.run(db, admin)
        n = 0
        if args.generate_activation:
            res = activation.generate_requests(db, admin, categories=["projector"])
            for a in db.scalars(select(ActivationRequest)):
                a.is_demo = True
            db.commit()
            n = res["created"]
    print("Seeded demo data.")
    print(f"  Password for every demo account: {DEMO_PASSWORD}")
    print(f"  Admin:           admin@{DEMO_DOMAIN}")
    print(f"  Verified owners: aisha@{DEMO_DOMAIN}, ravi@..., meera@..., karthik@... (14 students)")
    print(f"  Pending / rejected / unverified: nisha@, vikram@, tarun@ (@{DEMO_DOMAIN})")
    print("  Demand history is SYNTHETIC and labelled as such in the app.")
    if n:
        print(f"  Created {n} projector activation requests; camera and electronics kit shortages are left for a live demo.")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin")
    a.add_argument("--email"); a.add_argument("--name"); a.add_argument("--from-env", action="store_true")
    s = sub.add_parser("seed")
    s.add_argument("--reset", action="store_true", help="TRUNCATE all tables first (development only)")
    s.add_argument("--generate-activation", action="store_true")
    sub.add_parser("run-forecast")
    args = ap.parse_args(argv)
    return {"create-admin": create_admin, "seed": seed, "run-forecast": run_forecast_cmd}[args.cmd](args)


if __name__ == "__main__":
    sys.exit(main())
