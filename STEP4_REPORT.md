# LEND & LOOP — Step 4 Report: Predictive Resource Activation

## 0. How this step was approached

Per the brief's own instruction ("do not duplicate existing functionality... if a feature is
already implemented correctly, improve or test it instead of rebuilding it"), this step began
with a full read-through audit of every file in the prediction/activation/matching pipeline
before writing anything. That audit found the feature was **already built and already correct**
on nearly every point in the brief — it had clearly been developed as part of the project's
original scope, not added this step. So the actual work done in Step 4 was:

1. A full line-by-line audit of `app/ml/forecasting.py`, `app/services/forecast_service.py`,
   `app/services/supply.py`, `app/services/idle.py`, `app/services/activation.py`,
   `app/services/matching.py`, `app/services/bookings.py`, `app/services/availability.py`,
   the admin/insights API routers, the migrations, and the six frontend pages that surface this
   feature.
2. One real finding during that audit, run down to the actual code and disproven: see §9.
3. A new test file, `backend/tests/test_step4_security.py` (8 tests), covering the specific
   Section 9/11 checklist items that weren't already covered by the existing
   `backend/tests/test_predictive.py` (26 tests).
4. Full regression (backend + frontend) and a live-browser pass with screenshots.

**No application code was changed in this step.** Nothing needed to be, once verified.

---

## 1. Methodology (forecasting)

Weekly, per-category demand forecasting in `app/ml/forecasting.py`:

- **Target**: number of booking requests starting in a given week, per resource category.
- **Horizon**: the upcoming week (forecast is made 2 weeks ahead of the last fully-completed week,
  so every feature has lag ≥ 2 — no leakage from the week being predicted).
- **Features**: lag-2/3/4 bookings, 4-week trailing mean, a linear trend term, seasonal
  sin/cos-of-week-of-year, and an event-week flag (exams/fests/hackathons).
- **Candidates compared**: `baseline_naive` (repeat last known week), `baseline_mean4` (mean of
  last 4 weeks), `ridge` (linear model), `gradient_boosting` (small tree ensemble).
- **Selection**: lowest MAE on a **time-based hold-out** (the most recent 8 weeks, never
  shuffled). A baseline is allowed to win and is reported as such — nothing forces a "smarter"
  model to be picked.
- **Uncertainty**: an 80% interval computed from the selected model's hold-out residual
  standard deviation (not a fixed/fake band).
- **Reproducibility**: every run is stamped with a `model_version` = model name + run date + an
  8-char SHA1 fingerprint of the exact training rows used.

## 2. Historical data used

`DemandHistory` rows are tagged `source="synthetic"` or `source="real"`. `sync_real_demand()`
rebuilds the real-booking rows from actual (non-demo) `Booking` records on every forecast run, so
real usage continuously feeds back into training. `build_history()` computes a `basis` label
(`synthetic_only` / `real_only` / `mixed`) and every forecast response carries a plain-language
`data_note` stating exactly which it is — e.g. *"Trained on SYNTHETIC demo history only. Not a
validated real-world forecast."* In this demo environment the data is currently synthetic-only
(78 weeks, seeded); the moment real bookings accumulate, the label and the training set both
update automatically, with no code change required.

## 3. Model/baseline selected

Selected honestly by lowest hold-out MAE each run — currently `ridge` (MAE 1.72 vs. 1.80 for
`gradient_boosting`, 1.97/2.36 for the two baselines, on this seeded dataset). All four
candidates' MAE/RMSE are stored per run (`PredictionEvaluation`) and shown in the admin UI's
"Model comparison" table with a "Selected" badge — nothing is hidden.

## 4. Evaluation results and limitations

- MAE/RMSE computed on held-out weeks, never on training data (see `run_forecast`'s
  `train`/`test` split by `cutoff` date).
- `MIN_TRAIN_ROWS = 40`: below this, `run_forecast` raises `ValueError` rather than ever
  returning a number. Verified by `test_predictive.py::test_forecast_requires_admin_and_history`
  (zero history) and the new `test_step4_security.py::test_some_but_insufficient_history_...`
  (a *little* history — 4 weeks — still correctly refuses, distinct from the zero-history case).
- Limitation surfaced directly in the admin UI's "Limitations" panel: synthetic-only data means
  the current numbers are not a validated real-world forecast; the 80% range is from hold-out
  error, not a guarantee; effective supply assumes one booking per resource per week.

## 5. Supply-gap calculation

`app/services/supply.py`:
- **Effective supply** = count of each resource, counted once, that is: owned by an
  `account_status=active` + `verification_status=approved` owner, has an availability window
  overlapping the forecast period, and has ≥ `min_hours` of that window not already consumed by a
  confirmed/active booking.
- **Gap** = `max(0, round(predicted_demand) − effective_supply)`.
- **Demand level**: low/moderate/high/critical from gap and demand magnitude.
- Both `predicted_demand` and `effective_supply` are shown **live-recomputed** alongside the
  value captured *at forecast time*, so accepting an activation visibly shrinks the gap in
  real time (`forecast_service.summary()`).

## 6. Idle-resource identification

`app/services/idle.py`:
- **Hard eligibility rules** (exclude, don't just downrank): resource must be
  active/inactive status, not `worn` condition, owner must be active + verified +
  opted in (`open_to_activation=True`), not already counted in effective supply, not already
  busy in the window, not already asked this run, and the owner must not have hit
  `max_requests_per_owner_per_week`.
- **Idle flag**: `never_booked`, or days-since-last-use ≥ threshold, or utilization < threshold
  — handled explicitly (a resource with *no* booking history is labelled `never_booked`, never
  silently treated as "0% utilization" as if that were measured).
- **Score** (0–1): 0.40 recency + 0.30 low-utilization + 0.15 condition + 0.15 owner reliability,
  with the full breakdown returned to both the admin table and the owner's own request detail
  page (not just a single opaque number).

## 7. Owner-approved activation workflow

`app/services/activation.py`, matching the brief's 9-step flow exactly:
predict → gap → idle-detect → rank idle candidates → generate human-readable, number-backed
`ActivationRequest`s (capped per owner per week, never duplicated for the same run) → owner is
notified → owner reviews the real numbers and the reasoning on their own page → owner
**accepts** (choosing their own available window inside the requested period) or **declines**
(optional reason) or later **withdraws** an acceptance → only on accept does a
`ResourceAvailability(source="activation")` row get created and the resource become bookable —
nothing is activated automatically. Every decision is audited (`activation.accept` /
`.decline` / `.withdraw`). A declined or expired request can never later be accepted — `accept()`
strictly requires `status == pending` (new regression test:
`test_declined_activation_request_can_never_later_be_accepted`,
`test_expired_activation_request_can_never_be_accepted`).

## 8. Database changes

**None required.** The single baseline migration (`migrations/versions/0001_initial_schema.py`)
already contains everything this feature needs: `demand_history` (with `source`),
`demand_forecasts`, `prediction_evaluations`, `activation_requests`,
`resource_availability` (with `source` and `activation_request_id`), `users.open_to_activation`,
and the `btree_gist` extension for the no-double-booking exclusion constraint. This was confirmed
by reading the migration directly rather than assumed.

## 9. Security test results (Section 9 checklist)

All of the following are enforced **server-side**, confirmed by running real requests against
the real API and database (never mocks):

| Requirement | Enforced by | Verified by |
|---|---|---|
| Only the actual owner can approve/reject their own activation request | `activation._owned()` → 404 for anyone else | `test_predictive.py` + Step 3/4 suites |
| A student cannot activate another student's resource | same `_owned()` check | `test_activation_requires_owner_consent_and_updates_supply` |
| A student cannot access admin forecasting endpoints | router-level `dependencies=[Depends(require_admin)]` on `/api/admin/*` | new `test_student_cannot_access_admin_prediction_endpoints` (all 5 GET/POST endpoints individually) |
| Rejected requests cannot be activated | `accept()` requires `status==pending` | new `test_declined_...`, `test_expired_...` |
| Duplicate activation requests are handled correctly | per-owner weekly cap in `generate_requests()`; re-running asks nobody twice | `test_owner_weekly_request_cap`, new `test_duplicate_accept_calls_are_rejected_not_silently_merged` |
| Owner approval does not bypass verification/moderation | `accept()` checks resource not archived/removed | new `test_owner_cannot_activate_a_resource_that_was_removed_by_moderation` |
| Activation decisions are recorded in audit logs | `audit(db, owner, "activation.accept"/"decline"/"withdraw", ...)` | new `test_decline_and_withdraw_are_both_audited` |
| Unavailable resources cannot become bookable through the prediction workflow | see below | new `test_suspended_owners_listing_is_excluded_from_matching_and_booking` |

**One genuine investigation worth recording**: during the audit, `matching.py`'s resource query
and `bookings.py::create_booking()` appeared at first read to filter only on
`Resource.status == active`, with no owner-verification check — which looked like it could let a
suspended/unverified owner's old listing stay matchable and bookable. Reading
`app/services/availability.py::check_availability()` (which *both* `match()` and
`create_booking()` call before accepting or ranking anything) showed this is **already covered**:
it independently checks `owner.account_status == active` and
`owner.verification_status == approved` on every call, live, regardless of the resource's own
cached `status`. A new regression test proves this end-to-end: an owner is suspended via the real
admin API, their resource's `status` is confirmed to remain `"active"` (nothing cascades to it),
and the resource is then confirmed excluded from `/api/matching` results and rejected with 409
from `/api/bookings` — so there was no gap, but it is now a permanent regression test rather than
an unverified assumption.

## 10. Frontend + backend test results

- **Backend**: `pytest` — **58 passed**, 0 failed (50 pre-existing + 8 new in
  `test_step4_security.py`). Includes the full Step 3 security suite and the 20-step end-to-end
  journey test, run together with the predictive suite — nothing broke.
- **Frontend**: `tsc --noEmit` — clean. `vitest run` — **10 passed**. `vite build` — succeeds,
  no warnings beyond the expected chart-library chunk size notice.

## 11. Responsive test results

Checked live (Playwright + Chromium, against the real running stack) at 1440, 1366, 768 and
390px for the admin demand-forecast page, admin supply-gap page, admin idle/activation page, and
the owner's activation list and detail pages. All render correctly with no horizontal page
scroll; data tables that don't fit scroll within their own panel (the same intentional pattern
used by every other data table in the app since Step 3). Screenshots attached.

## 12. Full-application integration check

The full backend regression suite exercises registration → verification → marketplace listing →
booking → approval → return/dispute → admin moderation → demand forecasting → supply-gap →
idle-detection → activation request → owner accept/decline/withdraw → smart matching → audit
logging, all against one real database in one run. Nothing from Steps 1–3 was removed, renamed,
or altered to "make this step easier" — Step 4 added one new test file and changed nothing else.

## 13. Remaining limitations (honestly stated)

- The forecast is currently trained on **synthetic demo history only** (no real booking volume
  yet) — the UI labels this everywhere it's shown; it is not a validated real-world forecast.
- Model comparison currently favors `ridge` on this seeded dataset; this can change once real
  data accumulates, and the app will report whichever model actually wins, honestly.
- As before: no real email delivery (SMTP not configured — dev outbox only), no production
  deployment, and no payment/escrow has been attempted or claimed anywhere in this project.
- Effective-supply and idle-detection thresholds (idle-days, utilization %, weekly request cap,
  overask factor) are admin-configurable platform settings, not hardcoded constants, but their
  current default values haven't been tuned against real usage — only against the synthetic
  seed.

## 14. Running the complete application

Unchanged from before — see the project `README.md` / `docker-compose.demo.yml` for the
one-command local setup. For this audit, services were run directly:
```
pg_ctlcluster 16 main start
cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000
cd frontend && npm run dev
# demo data + a live activation scenario:
cd backend && python -m app.cli seed --reset --generate-activation
```
