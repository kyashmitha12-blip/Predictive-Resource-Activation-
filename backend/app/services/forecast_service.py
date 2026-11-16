"""Glue between the database and the forecasting module: build history, run, store, summarise."""
import uuid
from datetime import date, datetime, timedelta, timezone

import pandas as pd
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.ml.forecasting import monday_of, run_forecast
from app.models import (ActivationRequest, ActivationStatus, Booking, DemandForecast, DemandHistory,
                        PlatformSetting, PredictionEvaluation, Resource, User)
from app.models.base import CATEGORIES
from app.services.core import audit, get_settings_map, notify_admins
from app.services.supply import demand_level, effective_supply, supply_gap


def sync_real_demand(db: Session, today: date) -> int:
    """Aggregate real (non-demo) booking requests by category and start-week into demand_history."""
    last_complete = monday_of(today) - timedelta(weeks=1)
    db.execute(delete(DemandHistory).where(DemandHistory.source == "real"))
    week = func.date_trunc("week", Booking.start_at)
    rows = db.execute(select(Resource.category, week, func.count()).join(Resource, Resource.id == Booking.resource_id)
                      .where(Booking.is_demo.is_(False)).group_by(Resource.category, week)).all()
    n = 0
    for cat, wk, cnt in rows:
        wk_date = wk.date()
        if wk_date <= last_complete:
            db.add(DemandHistory(category=cat, week_start=wk_date, bookings=cnt, event_flag=False, source="real"))
            n += 1
    db.flush()
    return n


def event_weeks(db: Session) -> set[date]:
    row = db.get(PlatformSetting, "event_weeks")
    return {date.fromisoformat(x) for x in (row.value if row and row.value else [])}


def build_history(db: Session) -> tuple[pd.DataFrame, dict]:
    rows = db.scalars(select(DemandHistory)).all()
    df = pd.DataFrame([{"category": r.category, "week_start": r.week_start, "bookings": r.bookings,
                        "event_flag": r.event_flag, "source": r.source} for r in rows])
    if df.empty:
        return df, {"real_weeks": 0, "synthetic_weeks": 0, "real_bookings": 0, "basis": "none"}
    real, synth = df[df.source == "real"], df[df.source == "synthetic"]
    combined = (df.groupby(["category", "week_start"], as_index=False)
                .agg(bookings=("bookings", "sum"), event_flag=("event_flag", "max")))
    basis = "synthetic_only" if real.empty else "real_only" if synth.empty else "mixed"
    info = {"real_weeks": int(real["week_start"].nunique()), "synthetic_weeks": int(synth["week_start"].nunique()),
            "real_bookings": int(real["bookings"].sum()), "basis": basis}
    return combined, info


def run(db: Session, actor: User | None, today: date | None = None) -> str:
    today = today or datetime.now(timezone.utc).date()
    sync_real_demand(db, today)
    history, info = build_history(db)
    result = run_forecast(history, CATEGORIES, today, event_weeks(db))
    run_id = str(uuid.uuid4())
    period_start, period_end = result.target_week, result.target_week + timedelta(days=6)
    supply = effective_supply(db, period_start, period_end)
    for evl in result.evaluations:
        db.add(PredictionEvaluation(run_id=run_id, model_version=result.model_version, model_name=evl["model_name"],
                                    is_selected=evl["is_selected"], mae=evl["mae"], rmse=evl["rmse"],
                                    n_train=evl["n_train"], n_test=evl["n_test"],
                                    n_real_weeks=info["real_weeks"], n_synthetic_weeks=info["synthetic_weeks"]))
    shortages = []
    for cat, p in result.predictions.items():
        sup = supply.get(cat, {}).get("effective", 0)
        gap = supply_gap(p["predicted"], sup)
        db.add(DemandForecast(run_id=run_id, category=cat, period_start=period_start, period_end=period_end,
                              predicted_demand=p["predicted"], lower=p["lower"], upper=p["upper"],
                              effective_supply=sup, supply_gap=gap, demand_level=demand_level(p["predicted"], sup),
                              model_name=result.selected, model_version=result.model_version, data_basis=info["basis"]))
        if gap > 0:
            shortages.append((cat, gap))
    audit(db, actor, "forecast.run", "forecast", None, run_id=run_id, model=result.selected, basis=info["basis"])
    if shortages:
        top = ", ".join(f"{c.replace('_', ' ')} (gap {g})" for c, g in sorted(shortages, key=lambda x: -x[1])[:4])
        notify_admins(db, "supply_shortage", "Supply shortage predicted", f"Week of {period_start}: {top}", "/admin/supply-gap")
    db.commit()
    return run_id


def latest_run_id(db: Session) -> str | None:
    return db.scalar(select(DemandForecast.run_id).order_by(DemandForecast.created_at.desc(), DemandForecast.id.desc()).limit(1))


def summary(db: Session, run_id: str | None = None) -> dict | None:
    run_id = run_id or latest_run_id(db)
    if not run_id:
        return None
    rows = list(db.scalars(select(DemandForecast).where(DemandForecast.run_id == run_id).order_by(DemandForecast.category)))
    evals = list(db.scalars(select(PredictionEvaluation).where(PredictionEvaluation.run_id == run_id).order_by(PredictionEvaluation.mae)))
    first = rows[0]
    live = effective_supply(db, first.period_start, first.period_end)
    act = dict(((c, s), n) for c, s, n in db.execute(
        select(ActivationRequest.category, ActivationRequest.status, func.count())
        .where(ActivationRequest.run_id == run_id).group_by(ActivationRequest.category, ActivationRequest.status)))
    cats = []
    for r in rows:
        sup = live.get(r.category, {})
        live_supply = sup.get("effective", 0)
        cats.append({
            "category": r.category, "predicted_demand": r.predicted_demand, "lower": r.lower, "upper": r.upper,
            "total_listed": sup.get("listed", 0), "effective_supply": live_supply,
            "supply_at_forecast": r.effective_supply, "supply_gap": supply_gap(r.predicted_demand, live_supply),
            "gap_at_forecast": r.supply_gap, "demand_level": demand_level(r.predicted_demand, live_supply),
            "pending_requests": act.get((r.category, ActivationStatus.pending), 0),
            "accepted_requests": act.get((r.category, ActivationStatus.accepted), 0),
        })
    return {"run_id": run_id, "period_start": first.period_start, "period_end": first.period_end,
            "created_at": first.created_at, "model_name": first.model_name, "model_version": first.model_version,
            "data_basis": first.data_basis,
            "data_note": {"synthetic_only": "Trained on SYNTHETIC demo history only. Not a validated real-world forecast.",
                          "mixed": "Trained on synthetic demo history combined with real bookings recorded on this platform.",
                          "real_only": "Trained on real bookings recorded on this platform."}.get(first.data_basis, ""),
            "categories": cats,
            "evaluations": [{"model_name": e.model_name, "mae": e.mae, "rmse": e.rmse, "is_selected": e.is_selected,
                             "n_train": e.n_train, "n_test": e.n_test} for e in evals]}
