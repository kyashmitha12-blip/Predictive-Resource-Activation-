"""File storage abstraction: local disk for development, S3-compatible object storage for production."""
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.config import settings

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
DOC_TYPES = IMAGE_TYPES | {"application/pdf"}
EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"}


def sniff_type(data: bytes) -> str | None:
    """Detect the real file type from its first bytes instead of trusting the client's header."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    return None


async def read_validated(file: UploadFile, allowed: set[str]) -> tuple[bytes, str]:
    data = await file.read(settings.max_upload_bytes + 1)
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"File too large (max {settings.max_upload_bytes // (1024 * 1024)} MB).")
    if not data:
        raise HTTPException(422, "The uploaded file is empty.")
    ctype = sniff_type(data)
    if ctype not in allowed:
        names = ", ".join(sorted(EXT[t].upper() for t in allowed))
        raise HTTPException(415, f"Unsupported file type. Allowed: {names}.")
    return data, ctype


class LocalStorage:
    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ValueError("invalid storage key")
        return p

    def put(self, key: str, data: bytes, content_type: str) -> None:
        p = self._path(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

    def get(self, key: str) -> bytes | None:
        p = self._path(key)
        return p.read_bytes() if p.exists() else None

    def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            p.unlink()


class S3Storage:
    def __init__(self):
        import boto3

        self.bucket = settings.s3_bucket
        self.client = boto3.client(
            "s3",
            region_name=settings.s3_region or None,
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id or None,
            aws_secret_access_key=settings.s3_secret_access_key or None,
        )

    def put(self, key: str, data: bytes, content_type: str) -> None:
        self.client.put_object(Bucket=self.bucket, Key=key, Body=data, ContentType=content_type)

    def get(self, key: str) -> bytes | None:
        try:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()
        except self.client.exceptions.NoSuchKey:
            return None

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


_storage = None


def get_storage():
    global _storage
    if _storage is None:
        _storage = S3Storage() if settings.storage_backend == "s3" else LocalStorage(settings.local_storage_dir)
    return _storage


def make_key(prefix: str, content_type: str) -> str:
    return f"{prefix}/{uuid.uuid4().hex}.{EXT[content_type]}"
