"""Upload validation: size limits, extension allow-list, magic-byte sniffing, safe names."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from pathlib import PurePath

from django.conf import settings
from django.core.files.uploadedfile import UploadedFile
from rest_framework.exceptions import ValidationError


@dataclass(frozen=True)
class FileKind:
    extensions: tuple[str, ...]
    content_type: str
    signatures: tuple[bytes, ...]


ALLOWED_KINDS: tuple[FileKind, ...] = (
    FileKind((".pdf",), "application/pdf", (b"%PDF-",)),
    FileKind((".png",), "image/png", (b"\x89PNG\r\n\x1a\n",)),
    FileKind((".jpg", ".jpeg"), "image/jpeg", (b"\xff\xd8\xff",)),
    FileKind((".webp",), "image/webp", (b"RIFF",)),
)


@dataclass(frozen=True)
class ValidatedFile:
    original_name: str
    extension: str
    content_type: str
    size: int
    sha256: str


def safe_filename(name: str, max_length: int = 120) -> str:
    """Return a display-safe filename: no paths, control chars or exotic characters."""
    name = PurePath(name.replace("\\", "/")).name
    name = unicodedata.normalize("NFKC", name)
    name = re.sub(r"[^\w.\- ()]", "_", name).strip(" .")
    if not name:
        name = "document"
    stem, dot, ext = name.rpartition(".")
    if dot and len(name) > max_length:
        name = f"{stem[: max_length - len(ext) - 1]}.{ext}"
    return name[:max_length]


def validate_upload(upload: UploadedFile) -> ValidatedFile:
    if upload.size is None or upload.size == 0:
        raise ValidationError({"file": ["The file is empty."]})
    if upload.size > settings.MAX_UPLOAD_SIZE_BYTES:
        limit_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        raise ValidationError({"file": [f"Files must be {limit_mb} MB or smaller."]})

    original = safe_filename(upload.name or "document")
    extension = PurePath(original).suffix.lower()
    kind = next((k for k in ALLOWED_KINDS if extension in k.extensions), None)
    if kind is None:
        raise ValidationError({"file": ["Only PDF, PNG, JPEG and WebP files are allowed."]})

    upload.seek(0)
    head = upload.read(16)
    if not any(head.startswith(sig) for sig in kind.signatures) or (
        kind.content_type == "image/webp" and head[8:12] != b"WEBP"
    ):
        raise ValidationError({"file": ["The file content does not match its extension."]})

    digest = hashlib.sha256()
    upload.seek(0)
    for chunk in upload.chunks():
        digest.update(chunk)
    upload.seek(0)
    return ValidatedFile(original, extension, kind.content_type, upload.size, digest.hexdigest())
