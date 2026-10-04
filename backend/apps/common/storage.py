"""Private file storage abstraction.

Files containing health information are never written beneath a web-served path
and are never addressed by predictable public URLs. Downloads always pass through
an authorized API view. A cloud implementation (e.g. S3 with short-lived signed
URLs) can be added by implementing :class:`PrivateStorage` and pointing
``PRIVATE_STORAGE_BACKEND`` at it.
"""

from __future__ import annotations

import os
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path
from typing import BinaryIO

from django.conf import settings
from django.utils.module_loading import import_string


class PrivateStorage(ABC):
    @abstractmethod
    def save(self, stream: BinaryIO, *, extension: str) -> str:
        """Persist the stream and return an opaque storage key."""

    @abstractmethod
    def open(self, key: str) -> BinaryIO: ...

    @abstractmethod
    def delete(self, key: str) -> None: ...

    @abstractmethod
    def exists(self, key: str) -> bool: ...


class LocalPrivateStorage(PrivateStorage):
    """Stores files on local disk outside any static/media root."""

    def __init__(self, root: Path | None = None) -> None:
        self.root = Path(root or settings.PRIVATE_STORAGE_ROOT)

    def _path(self, key: str) -> Path:
        candidate = (self.root / key).resolve()
        if self.root.resolve() not in candidate.parents:
            raise ValueError("Invalid storage key.")
        return candidate

    def save(self, stream: BinaryIO, *, extension: str) -> str:
        file_id = uuid.uuid4().hex
        key = f"{file_id[:2]}/{file_id}{extension}"
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        stream.seek(0)
        with open(path, "wb") as out:
            for chunk in iter(lambda: stream.read(64 * 1024), b""):
                out.write(chunk)
        os.chmod(path, 0o600)
        return key

    def open(self, key: str) -> BinaryIO:
        return open(self._path(key), "rb")

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()

    def exists(self, key: str) -> bool:
        return self._path(key).exists()


@lru_cache(maxsize=1)
def _storage_class() -> type[PrivateStorage]:
    return import_string(settings.PRIVATE_STORAGE_BACKEND)


def get_private_storage() -> PrivateStorage:
    return _storage_class()()
