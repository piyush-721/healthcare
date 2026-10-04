"""Private document storage on Vercel Blob.

Uses a **private** Blob store, so every read and write requires the store's
read-write token (``BLOB_READ_WRITE_TOKEN``). Objects are never exposed by
URL: downloads still stream through HealthOS's authorized endpoint, which reads
the bytes server-side. Uploads are capped by ``MAX_UPLOAD_SIZE_MB`` (4 MB on
Vercel, below the 4.5 MB function payload limit), so whole-object reads are fine.
"""

from __future__ import annotations

import io
import uuid
from typing import BinaryIO

from vercel import blob

from .storage import PrivateStorage

PREFIX = "healthos-private/documents"


class VercelBlobPrivateStorage(PrivateStorage):
    def _pathname(self, key: str) -> str:
        if not key or ".." in key or key.startswith("/"):
            raise ValueError("Invalid storage key.")
        return f"{PREFIX}/{key}"

    def save(self, stream: BinaryIO, *, extension: str) -> str:
        file_id = uuid.uuid4().hex
        key = f"{file_id[:2]}/{file_id}{extension}"
        stream.seek(0)
        blob.put(
            self._pathname(key),
            stream.read(),
            access="private",
            add_random_suffix=False,
            overwrite=False,
        )
        return key

    def open(self, key: str) -> BinaryIO:
        try:
            result = blob.get(self._pathname(key), access="private", use_cache=False)
        except blob.BlobNotFoundError as exc:
            raise FileNotFoundError(key) from exc
        return io.BytesIO(result.content)

    def delete(self, key: str) -> None:
        try:
            blob.delete(self._resolve_url(key))
        except (blob.BlobNotFoundError, FileNotFoundError):
            return

    def exists(self, key: str) -> bool:
        try:
            blob.head(self._pathname(key))
        except blob.BlobNotFoundError:
            return False
        return True

    def _resolve_url(self, key: str) -> str:
        try:
            return blob.head(self._pathname(key)).url
        except blob.BlobNotFoundError as exc:
            raise FileNotFoundError(key) from exc
