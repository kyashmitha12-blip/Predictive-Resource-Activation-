"""Weekly demand forecasting per resource category.

Forecast target: number of booking requests starting in a given week, per category.
Forecast horizon: the *upcoming* week. At forecast time we only know completed weeks, so the target
week is two weeks after the last completed week; every feature therefore uses lag >= 2.

Candidates are compared on a time-based hold-out (the most recent weeks, never shuffled):
  baseline_naive  - repeat the last known week
  baseline_mean4  - mean of the last four known weeks
  ridge           - linear model on lags, seasonality and an event flag
  gradient_boosting - small tree ensemble on the same features
The candidate with the lowest hold-out MAE is selected (a baseline can win - that is reported honestly).
"""
import hashlib
from dataclasses import dataclass, field
from datetime import date, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

BASE_FEATURES = ["lag2", "lag3", "lag4", "mean_2_5", "trend", "week_sin", "week_cos", "event"]
MIN_TRAIN_ROWS = 40
Z_80 = 1.2816  # 80% interval


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def _features(df: pd.DataFrame, categories: list[str]) -> pd.DataFrame:
    """df columns: category, week_start (Timestamp, Mondays), bookings (NaN for unknown), event_flag."""
    out = []
    for cat, g in df.sort_values("week_start").groupby("category"):
        g = g.copy()
        b = g["bookings"]
        g["lag2"], g["lag3"], g["lag4"] = b.shift(2), b.shift(3), b.shift(4)
        g["mean_2_5"] = pd.concat([b.shift(k) for k in (2, 3, 4, 5)], axis=1).mean(axis=1, skipna=False)
        g["trend"] = (b.shift(2) - b.shift(6)) / 4
        woy = g["week_start"].dt.isocalendar().week.astype(float)
        g["week_sin"], g["week_cos"] = np.sin(2 * np.pi * woy / 52), np.cos(2 * np.pi * woy / 52)
        g["event"] = g["event_flag"].astype(float)
        out.append(g)
    f = pd.concat(out)
    for c in categories:
        f[f"cat_{c}"] = (f["category"] == c).astype(float)
    return f


def feature_names(categories: list[str]) -> list[str]:
    return BASE_FEATURES + [f"cat_{c}" for c in categories]


def _candidates():
    return {
        "ridge": make_pipeline(StandardScaler(), Ridge(alpha=3.0)),
        "gradient_boosting": GradientBoostingRegressor(n_estimators=120, max_depth=2, learning_rate=0.06,
                                                       subsample=0.8, random_state=7),
    }


@dataclass
class ForecastResult:
    selected: str
    model_version: str
    evaluations: list[dict]
    predictions: dict[str, dict]
    target_week: date
    n_train_rows: int
    notes: list[str] = field(default_factory=list)


def run_forecast(history: pd.DataFrame, categories: list[str], today: date, event_weeks: set[date],
                 test_weeks: int = 8) -> ForecastResult:
    """history: category, week_start (date), bookings, event_flag - COMPLETED weeks only."""
    if history.empty:
        raise ValueError("No demand history available. Seed demo data or wait for bookings.")
    hist = history.copy()
    hist["week_start"] = pd.to_datetime(hist["week_start"])
    current_week = pd.Timestamp(monday_of(today))
    last_complete = current_week - pd.Timedelta(weeks=1)
    target = current_week + pd.Timedelta(weeks=1)

    # Complete weekly grid per category up to the target week (unknown weeks stay NaN).
    weeks = pd.date_range(hist["week_start"].min(), target, freq="W-MON")
    grid = pd.MultiIndex.from_product([categories, weeks], names=["category", "week_start"]).to_frame(index=False)
    grid = grid.merge(hist, on=["category", "week_start"], how="left")
    known = grid["week_start"] <= last_complete
    grid.loc[known, "bookings"] = grid.loc[known, "bookings"].fillna(0)  # no record in a completed week = 0
    grid.loc[~known, "bookings"] = np.nan
    ev = {pd.Timestamp(e) for e in event_weeks}
    grid["event_flag"] = grid["event_flag"].fillna(False).astype(bool) | grid["week_start"].isin(ev)

    f = _features(grid, categories)
    cols = feature_names(categories)
    train_all = f.dropna(subset=["bookings"] + BASE_FEATURES)
    if len(train_all) < MIN_TRAIN_ROWS:
        raise ValueError(f"Not enough history to train (have {len(train_all)} rows, need {MIN_TRAIN_ROWS}).")

    cutoff = sorted(train_all["week_start"].unique())[-test_weeks]
    train, test = train_all[train_all["week_start"] < cutoff], train_all[train_all["week_start"] >= cutoff]

    def metrics(y, p):
        return float(mean_absolute_error(y, p)), float(np.sqrt(mean_squared_error(y, p)))

    results: dict[str, dict] = {}
    for name, col in (("baseline_naive", "lag2"), ("baseline_mean4", "mean_2_5")):
        p = test[col].to_numpy()
        mae, rmse = metrics(test["bookings"], p)
        results[name] = {"mae": mae, "rmse": rmse, "resid": (test["bookings"].to_numpy() - p)}
    for name, model in _candidates().items():
        model.fit(train[cols], train["bookings"])
        p = np.clip(model.predict(test[cols]), 0, None)
        mae, rmse = metrics(test["bookings"], p)
        results[name] = {"mae": mae, "rmse": rmse, "resid": (test["bookings"].to_numpy() - p)}

    selected = min(results, key=lambda k: (round(results[k]["mae"], 4), k.startswith("baseline") is False))
    sigma = float(np.std(results[selected]["resid"], ddof=1)) if len(test) > 2 else 1.0

    target_rows = f[f["week_start"] == target].set_index("category")
    if selected.startswith("baseline"):
        col = "lag2" if selected == "baseline_naive" else "mean_2_5"
        raw = target_rows[col].to_dict()
    else:
        model = _candidates()[selected]
        model.fit(train_all[cols], train_all["bookings"])
        raw = dict(zip(target_rows.index, np.clip(model.predict(target_rows[cols]), 0, None)))

    preds = {}
    for cat in categories:
        p = float(raw.get(cat, 0.0) or 0.0)
        preds[cat] = {"predicted": round(p, 2), "lower": round(max(0.0, p - Z_80 * sigma), 2),
                      "upper": round(p + Z_80 * sigma, 2)}

    fingerprint = hashlib.sha1(pd.util.hash_pandas_object(train_all[["category", "week_start", "bookings"]]).values.tobytes()).hexdigest()[:8]
    version = f"{selected}-{today:%Y%m%d}-{fingerprint}"
    evals = [{"model_name": k, "mae": round(v["mae"], 3), "rmse": round(v["rmse"], 3), "is_selected": k == selected,
              "n_train": int(len(train)), "n_test": int(len(test))} for k, v in results.items()]
    notes = [
        f"Evaluated on the most recent {test_weeks} weeks held out from training.",
        "Predictions are decision support, not guarantees; the 80% range comes from hold-out error.",
    ]
    return ForecastResult(selected, version, evals, preds, target.date(), int(len(train_all)), notes)
