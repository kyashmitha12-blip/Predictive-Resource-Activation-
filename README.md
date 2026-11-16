# LEND & LOOP
**Share More. Own Less.** An intelligent campus resource-sharing platform that connects students who need equipment with people who have resources to lend. Its core feature is *predictive resource activation*: forecast demand, find idle gear, and ask owners for consent.

Students lend and borrow projectors, lab kits, cameras, books and more. The platform's distinguishing idea: it *forecasts* demand per category, compares it with the supply actually available, finds under-used items that could close the gap, and **asks their owners for consent** to share them.

```
demand forecast → effective supply → supply gap → idle-resource detection
   → consent-based owner request → smart matching → book / return → new data → forecast again
```

> **Honesty notes.** Demand history in the demo is **synthetic and labelled as such** everywhere it appears. Payments are **DEMO only**; no money moves, no card data is stored, nothing is escrowed. This repository has **not** been deployed, and real email has **not** been verified (see [Limitations](#limitations)).

## Stack
| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind, React Router, TanStack Query, Recharts, lucide-react, Vitest |
| Backend | FastAPI, Pydantic, SQLAlchemy 2, Alembic, PostgreSQL |
| ML | pandas, scikit-learn (baselines + Ridge + gradient boosting) |
| Auth | argon2id, HttpOnly cookie sessions (hashed tokens), CSRF header, RBAC |

## Easiest way to run it (Docker Desktop, no setup)
```bash
docker compose -f docker-compose.demo.yml up --build
```
Wait for "Application startup complete", then open **http://localhost:8080** and sign in with a demo account below. This starts Postgres, runs migrations, loads demo data, and serves the app. (Written but not run in the authoring environment, which had no Docker daemon.)

## Quick start (local, without Docker)
Requires Python 3.12+, Node 20+, PostgreSQL 14+ (needs the `btree_gist` extension, bundled with Postgres contrib).

```bash
# 1. database
createuser pra --pwprompt            # dev password used by defaults: pra_dev_password
createdb -O pra pra && createdb -O pra pra_test

# 2. backend
cd backend
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.cli seed --reset --generate-activation
uvicorn app.main:app --port 8000     # API docs: http://localhost:8000/api/docs

# 3. frontend (new terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173 (proxies /api to :8000)
```

### Demo accounts (seed only; refused in production)
Password for all: `Demo#Pass2026`

| Email | Role / state |
|---|---|
| admin@demo.campus.test | Admin |
| aisha@ / ravi@ / meera@ / karthik@demo.campus.test | Verified students (owners) |
| nisha@demo.campus.test | Verification pending |
| vikram@demo.campus.test | Verification rejected |
| tarun@demo.campus.test | Email not verified |

### Production admin
Public registration can never create an admin. Provision the first one from the server:
```bash
python -m app.cli create-admin --email you@college.edu --name "Your Name"   # prompts for a password
python -m app.cli create-admin --from-env   # reads ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD
```
Other CLI: `python -m app.cli run-forecast`, `python -m app.cli seed` (development only).

## Tests
```bash
cd backend && python -m pytest      # 35 tests, runs real migrations against the pra_test database
cd frontend && npx tsc --noEmit && npx vitest run && npm run build
```
Backend tests include a threaded **double-booking race**, the auth/RBAC/CSRF rules, forecasting, idle detection, consent flow, matching, and a **20-step end-to-end journey** (`tests/test_e2e_journey.py`): register → verify → admin approval → list → book → approve → handover → return → review → forecast → shortage → idle detection → owner consent → supply update → matching → admin analytics.

## How it works
- **No double booking.** Enforced in the database: an `EXCLUDE USING gist` constraint on `tstzrange(start_at, end_at, '[)')` for confirmed/active bookings (migration enables `btree_gist`). The API also pre-checks for friendly errors.
- **Forecast** (`app/ml/forecasting.py`): weekly bookings per category, lag features (≥2 weeks to avoid leakage), time-based holdout. Candidates: naive, 4-week mean, Ridge, gradient boosting. The lowest-MAE model is chosen **and compared against the baselines**; an 80% interval is reported. The data basis is shown as `synthetic_only`, `mixed` or `real_only`.
- **Effective supply** counts each eligible resource once (approved, good condition, available in the window). **Gap** = max(0, round(forecast) − supply).
- **Idle score** = 0.40 recency + 0.30 low utilization + 0.15 condition + 0.15 owner reliability. Hard rules: owner opt-in, verified owner, good condition, max 2 requests per owner per week.
- **Activation is consent-based.** Owners accept, decline or withdraw; each step is audit-logged. Nothing becomes bookable without acceptance.
- **Matching score** = 0.25 price + 0.20 condition + 0.25 owner reliability + 0.20 location + 0.10 keywords, with human-readable reasons on every result.
- **Disputes** never auto-deduct a deposit; an admin decides.

## Email and verification links (development vs production)
Verification and password-reset emails need an SMTP server. What the app does depends on the environment:

| Situation | What the API returns | What the user sees |
|---|---|---|
| `ENV=development`, `SMTP_HOST` empty | `dev_verification_link` / `dev_reset_link` are included in the response; `email_status: "dev_outbox"` | The link on screen, labelled "Development mode: no email was sent". Messages also listed at `GET /api/dev/outbox`. |
| `SMTP_HOST` set (any environment) | **No link in any response**; `email_status: "smtp"` | "A verification email was requested". The link exists only in the email. |
| `ENV=production`, `SMTP_HOST` empty | **No link in any response**; `email_status: "not_configured"`; nothing is sent | "Email delivery is not set up on this server, so no verification email was sent." Production should always configure SMTP. |

Guarantees, each covered by a test in `backend/tests/test_email_links.py`:
- Links are returned **only** when `ENV` is not `production` **and** no SMTP is configured. The rule is evaluated on every request.
- `/api/dev/outbox` returns 404 in production.
- Once an email is really sent, its body (which contains a live token link) is **not** kept in the database. In production without SMTP the link is not stored at all.
- The app never says an email was sent unless SMTP accepted it. SMTP delivery itself has not been verified against a real mail server here.

## Security
argon2id hashing; session tokens stored only as HMAC hashes; HttpOnly + SameSite cookies (Secure in production); CSRF header on every write; role checks on every admin route; rate limiting on auth routes; upload type sniffed from magic bytes with a 5 MB cap; verification documents served only to the owner and admins; security headers; production refuses to start with a weak `SECRET_KEY`; no secrets in frontend env.

## Docker
```bash
cp .env.example .env     # set POSTGRES_PASSWORD and SECRET_KEY
docker compose up --build   # app at http://localhost:8080
docker compose exec backend python -m app.cli create-admin --email you@college.edu --name "You"
```
The backend container runs `alembic upgrade head` on start. `docker-compose.yml` validates, but the images have **not** been built or run in this environment.

## Deployment (not yet performed)
1. **Postgres:** managed instance (Render, Railway, Neon, Supabase); `btree_gist` must be allowed.
2. **Storage:** an S3-compatible bucket (R2, S3, B2). Set `STORAGE_BACKEND=s3` and the `S3_*` variables. Keep the bucket private.
3. **Backend:** deploy `backend/` on Render (`render.yaml` provided) or Railway. Set `ENV=production`, a 32+ char `SECRET_KEY`, `DATABASE_URL`, `FRONTEND_ORIGIN`, `TRUST_PROXY=true`. Then run `create-admin` from the service shell.
4. **Frontend:** deploy `frontend/` to Vercel; edit the backend host in `frontend/vercel.json` rewrites so `/api` is same-origin (keeps cookies first-party).
5. **Email:** set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `SMTP_FROM` before launch. In production without SMTP, nobody can verify their email and the UI says so (see the table above).

## Limitations
- **Not deployed**; Render/Vercel/Docker configs are untested templates.
- **Email delivery unverified.** SMTP code exists but was not tested against a real server.
- **Synthetic demand history** drives the demo forecast; accuracy numbers on it say nothing about real campus demand. The system blends in real bookings as they accrue.
- **Payments are DEMO-only.** No gateway, no escrow.
- Rate limiter is in-process (use Redis for multi-instance deployments).
- Student ID verification is a manual admin review, not an automated check.
