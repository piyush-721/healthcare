"""Malware scanning abstraction.

Production deployments should plug in a real engine (for example ClamAV via
``clamd``) by implementing :class:`MalwareScanner`. The default
:class:`SignatureScanner` performs a real but limited signature check — it
detects the industry-standard EICAR test file — so the quarantine workflow is
exercised end to end in development and tests.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import BinaryIO

from django.conf import settings
from django.utils.module_loading import import_string


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    engine: str
    detail: str = ""


class MalwareScanner(ABC):
    @abstractmethod
    def scan(self, stream: BinaryIO) -> ScanResult: ...


class SignatureScanner(MalwareScanner):
    SIGNATURES: dict[str, bytes] = {
        "EICAR-Test-File": (
            b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"
        ),
    }

    def scan(self, stream: BinaryIO) -> ScanResult:
        stream.seek(0)
        overlap = max(len(sig) for sig in self.SIGNATURES.values())
        tail = b""
        for chunk in iter(lambda: stream.read(64 * 1024), b""):
            window = tail + chunk
            for name, signature in self.SIGNATURES.items():
                if signature in window:
                    return ScanResult(clean=False, engine="signature", detail=name)
            tail = window[-overlap:]
        return ScanResult(clean=True, engine="signature")


def get_scanner() -> MalwareScanner:
    return import_string(settings.MALWARE_SCANNER_BACKEND)()
