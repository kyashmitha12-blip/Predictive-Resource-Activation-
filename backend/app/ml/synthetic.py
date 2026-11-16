"""Synthetic demo history. Everything produced here is stored with source='synthetic' and labelled as such
in the UI. It exists only so the forecasting pipeline can be demonstrated before real bookings accumulate."""
from datetime import date, timedelta

import numpy as np

from app.models.base import CATEGORIES

# (typical weekly requests, event multiplier when an event week hits)
PROFILE = {
    "projector": (7, 1.7), "camera": (6, 1.6), "audio": (4, 1.9), "electronics_kit": (8, 1.5),
    "laptop": (3, 1.3), "lab_equipment": (2, 1.2), "tool": (3, 1.2), "event_equipment": (2, 2.3),
}
SEED = 20261024


def monday_of(d: date) -> date:
    return d - timedelta(days=d.weekday())


def generate(last_complete_week: date, n_weeks: int = 78, event_every: int = 11):
    """Return (rows, event_weeks). Rows: dict(category, week_start, bookings, event_flag)."""
    rng = np.random.default_rng(SEED)
    weeks = [last_complete_week - timedelta(weeks=n_weeks - 1 - i) for i in range(n_weeks)]
    event_idx = set(range(event_every - 1, n_weeks, event_every))
    rows = []
    for cat in CATEGORIES:
        base, mult = PROFILE[cat]
        for i, w in enumerate(weeks):
            season = 1 + 0.18 * np.sin(2 * np.pi * (w.isocalendar().week) / 52 + CATEGORIES.index(cat) % 3)
            growth = 1 + 0.004 * i
            lam = base * season * growth * (mult if i in event_idx else 1.0)
            rows.append({"category": cat, "week_start": w, "bookings": int(rng.poisson(max(lam, 0.3))),
                         "event_flag": i in event_idx})
    return rows, [weeks[i] for i in sorted(event_idx)]
