# LEND & LOOP — Admin Login Enhancement: Final Report

## Files created

- `backend/app/api/auth.py` — added one endpoint, `POST /api/auth/admin-login` (~14 lines).
- `backend/tests/test_admin_login.py` — new, 12 tests covering the 10 required scenarios plus two
  extras (suspended admin, rate-limit isolation).
- `frontend/src/pages/public/AdminLogin.tsx` — new page.

## Files modified

- `frontend/src/hooks/useAuth.tsx` — added `adminLogin()` alongside the existing `login()`;
  nothing existing changed.
- `frontend/src/App.tsx` — added one route, `admin/login`, in the public route group (next to
  `Landing`, using the same dark `PublicLayout`). The existing `/admin/*` protected route group
  is untouched.
- `frontend/src/pages/public/Login.tsx` — added one line, "Administrator? Sign in here" linking
  to `/admin/login`, in the footer. Nothing else on the page changed.

**Nothing was deleted, rebuilt, or redesigned.** The existing `/login`, `/admin/*` dashboard,
database schema, and all other pages are byte-for-byte unchanged except the one added link.

## Admin login URL

`/admin/login` (student login remains at `/login`, unchanged).

## How the admin account is securely provisioned

Reused as-is — this already existed and needed no changes:
```
python -m app.cli create-admin --email you@college.edu --name "Your Name"   # prompts for password
python -m app.cli create-admin --from-env   # reads ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD
```
- Password is never hardcoded or echoed back; it's typed via `getpass` or read from environment
  variables you control.
- Refuses to "promote" an existing non-admin account by that email — you'd see
  `A non-admin account with this email exists. Refusing to promote it automatically.`
- There is no public admin-registration route anywhere in the app.
- In production, the CLI additionally requires a 12+ character password.

I provisioned one real account this way during testing (`auditor@demo.campus.test`) to verify
the end-to-end flow live — see the screenshots.

## How admin authorization works

1. **Login-time gate (new)**: `POST /api/auth/admin-login` looks up the user, verifies the
   password with the same hashing used everywhere else (`verify_password`, with a constant-time
   dummy-hash comparison when the email doesn't exist, to avoid leaking which emails are
   registered), and only *then* checks `user.role == admin`. A correct password for a
   non-admin account gets `403 "Access denied. This login is only for authorized
   administrators."` and **no session cookie is ever issued** — confirmed by test
   (`pra_session` absent from the response, and a follow-up `/api/auth/me` call still 401s).
2. **Every request after that (unchanged, pre-existing)**: all `/api/admin/*` backend routes are
   wrapped in `dependencies=[Depends(require_admin)]`, which re-reads the role from the database
   on every single call — never from anything the client sent. This was true before this change
   and still is.
3. **Frontend route guard (unchanged, pre-existing)**: `/admin/*` is wrapped in
   `<RequireAuth role="admin">`, which redirects anyone without that role away before the admin
   UI ever renders. This is a UX convenience only — the real enforcement is point 2, which is
   why forcing the browser to `/admin` cannot show data a backend call would also refuse.
4. There is no role field anywhere in the login request body — `LoginIn` only accepts
   `email`/`password` and rejects unknown fields (`Strict` schema), so there is nothing for a
   modified frontend to even send that the backend would look at.

## Tests executed and their actual results

**New test file** `backend/tests/test_admin_login.py`, run via real HTTP calls against the real
database (never mocked):
```
tests/test_admin_login.py ............                                    [100%]
12 passed
```
Mapped to your list:
1. Valid admin credentials access the dashboard — `test_1_...` ✅
2. Invalid admin password rejected — `test_2_...` ✅
3. Student credentials via Admin Login denied, no session started — `test_3_...` ✅
4. Unauthenticated users blocked from admin routes — `test_4_...` ✅
5. Students blocked from admin APIs directly — `test_5_...` ✅
6. URL change to `/admin` doesn't bypass backend authorization — `test_6_...` ✅ (proven at the
   layer that matters: the API itself, not just the frontend route)
7. Modified "role" in the request body grants nothing — `test_7_...` ✅
8. Existing student login still works — `test_8_...` ✅
9. Existing admin dashboard endpoints still work after admin-login — `test_9_...` ✅
10. Admin logout works — `test_10_...` ✅
    (plus: suspended-admin refusal, and admin-login's rate limiter not blocking student login)

**Full regression**, run after:
- Backend: `pytest` — **70 passed**, 0 failed (58 previous + 12 new). Includes every Step 1–4
  test file; nothing regressed.
- Frontend: `tsc --noEmit` — clean. `vitest run` — **10 passed**. `vite build` — succeeds.
- Live-browser pass (Playwright against the real running stack), screenshots captured and
  visually checked: the student `/login` page with the new admin link, the empty `/admin/login`
  page, the exact "Access denied..." message when student credentials are entered there, the
  real admin dashboard after a successful admin login, and the page at 390px mobile width.

## Remaining limitations

- The admin-login rate limiter is the same in-memory, single-process limiter already used
  elsewhere in the app (documented there as needing a shared store like Redis for a
  multi-instance deployment) — not a new limitation, just inherited.
- No new audit-log entry is written specifically for an admin-login attempt (success, failure,
  or denial) — the pre-existing `/api/auth/login` doesn't audit login attempts either, so this
  keeps the two endpoints consistent; happy to add it if you'd like login attempts tracked.
- As with every prior step: no real email delivery or production deployment has been attempted
  or claimed.
