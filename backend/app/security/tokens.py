import hashlib
import hmac
import secrets

from app.config import settings


def new_token(nbytes: int = 32) -> str:
    return secrets.token_urlsafe(nbytes)


def hash_token(token: str) -> str:
    """Keyed hash so a leaked database cannot be used to forge session or reset tokens."""
    return hmac.new(settings.secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()
