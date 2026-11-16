"""Small in-memory sliding-window rate limiter for sensitive endpoints.

It is per process. If you run several backend instances, move this to a shared store (e.g. Redis).
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

from app.config import settings

_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    if settings.trust_proxy:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(name: str, limit: int, window_seconds: int):
    def dep(request: Request):
        if not settings.rate_limit_enabled:
            return
        key = f"{name}:{client_ip(request)}"
        now = time.monotonic()
        q = _hits[key]
        while q and now - q[0] > window_seconds:
            q.popleft()
        if len(q) >= limit:
            retry = int(window_seconds - (now - q[0])) + 1
            raise HTTPException(429, "Too many attempts. Please wait and try again.", headers={"Retry-After": str(retry)})
        q.append(now)

    return dep


def reset_rate_limits() -> None:
    _hits.clear()
