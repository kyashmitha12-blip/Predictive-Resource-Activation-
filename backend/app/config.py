"""Application settings, loaded from environment variables (see .env.example)."""
from functools import lru_cache

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEV_SECRET = "dev-only-change-me-dev-only-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "development"  # development | test | production
    database_url: str = "postgresql+psycopg2://pra:pra_dev_password@localhost:5432/pra"
    secret_key: str = DEV_SECRET

    # Where the browser app lives (used for CORS and links inside emails)
    frontend_origin: str = "http://localhost:5173"
    extra_cors_origins: str = ""  # comma separated

    # Sessions / cookies
    session_ttl_hours: int = 12
    cookie_samesite: str = "lax"
    cookie_secure: bool | None = None  # None -> secure only in production
    trust_proxy: bool = False  # honour X-Forwarded-For (set true behind Render/Railway)

    # Rate limiting (in-memory; use a shared store if you run several instances)
    rate_limit_enabled: bool = True

    # File storage
    storage_backend: str = "local"  # local | s3
    local_storage_dir: str = "./storage_data"
    s3_bucket: str = ""
    s3_region: str = "auto"
    s3_endpoint_url: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    max_upload_bytes: int = 5 * 1024 * 1024

    # Email: if smtp_host is empty the app runs in "dev outbox" mode and does NOT send email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "LEND & LOOP <no-reply@example.com>"

    # Demo-only switches
    demo_payments: bool = True  # payments are simulated; no real money moves

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def sync_database_url(self) -> str:
        url = self.database_url
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]
        if url.startswith("postgresql://"):
            url = "postgresql+psycopg2://" + url[len("postgresql://"):]
        return url

    @property
    def cors_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        origins += [o.strip() for o in self.extra_cors_origins.split(",") if o.strip()]
        return origins

    @property
    def secure_cookies(self) -> bool:
        return self.is_production if self.cookie_secure is None else self.cookie_secure

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host)

    @model_validator(mode="after")
    def _production_guards(self):
        if self.env == "production":
            if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be set to a random value of 32+ characters in production")
            if self.storage_backend == "local":
                import logging
                logging.getLogger("pra").warning(
                    "STORAGE_BACKEND=local in production: uploaded files are lost on redeploy. Use s3."
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
