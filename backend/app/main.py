import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api import admin, auth, bookings, chat, insights, notifications, resources
from app.config import settings
from app.database import engine

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("pra")

app = FastAPI(title="LEND & LOOP API", version="1.0.0",
              description="Campus resource sharing with demand forecasting and consent-based owner activation.",
              docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token"])


@app.middleware("http")
async def security_headers(request: Request, call_next):
    rid = uuid.uuid4().hex[:8]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error rid=%s path=%s", rid, request.url.path)  # message only; no request bodies are logged
        return JSONResponse({"detail": "Something went wrong on our side. Please try again.", "request_id": rid}, status_code=500)
    response.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin",
                             "X-Request-ID": rid})
    if request.url.path.startswith("/api") and not request.url.path.startswith("/api/docs"):
        log.info("%s %s -> %s %.0fms rid=%s", request.method, request.url.path, response.status_code, (time.perf_counter() - start) * 1000, rid)
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    fields = [{"field": ".".join(str(p) for p in e["loc"] if p not in ("body", "query", "form")), "message": e["msg"].removeprefix("Value error, ")} for e in exc.errors()]
    first = fields[0] if fields else {"field": "", "message": "Invalid request."}
    return JSONResponse({"detail": f"{first['field']}: {first['message']}".strip(": "), "errors": fields}, status_code=422)


for r in (auth.router, resources.router, bookings.router, notifications.router, insights.router, chat.router, admin.router):
    app.include_router(r)


@app.get("/api/health", tags=["system"])
def health():
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
        return {"status": "ok", "env": settings.env, "email": "smtp" if settings.email_configured else "dev_outbox_only",
                "storage": settings.storage_backend}
    except Exception:
        return JSONResponse({"status": "database_unavailable"}, status_code=503)


@app.get("/health", include_in_schema=False)
def health_root():
    return health()


if not settings.email_configured:
    log.warning("SMTP is not configured: verification and reset emails are NOT delivered (dev outbox only).")
