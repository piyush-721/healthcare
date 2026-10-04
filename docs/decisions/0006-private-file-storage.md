# ADR-0006: Private file storage and asynchronous scanning

**Status:** Accepted

## Decision
- A `PrivateStorage` interface (`save/open/delete/exists`). `LocalPrivateStorage` writes random keys
  under `PRIVATE_STORAGE_ROOT` with `0600` permissions and guards against path traversal.
- Metadata (`MedicalDocument`) is stored separately from the bytes, and `storage_key` is never
  serialized.
- Downloads always go through an authorized endpoint. A cloud backend should issue short-lived
  signed URLs only after the same authorization check.
- Scanning runs in Celery after commit through a pluggable `MalwareScanner`. Documents stay
  unavailable until CLEAN, and infected payloads are deleted and audited.

## Consequences
Uploads respond quickly. Users briefly see "Scanning…", and the UI polls until the scan finishes.
