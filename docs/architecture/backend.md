# Backend architecture

Django 5.2 + Django REST Framework, Python 3.12, PostgreSQL. Project root: `backend/`.

## Layout

```text
backend/
├── config/
│   ├── settings/{base,dev,test,prod}.py   environment-specific settings (all secrets from env)
│   ├── urls.py                            /api/v1/ routing, OpenAPI endpoints
│   └── celery.py                          Celery app (autodiscovers tasks.py)
├── apps/<domain>/
│   ├── models.py        data model + constraints/indexes
│   ├── serializers.py   API validation (explicit field lists → no mass assignment)
│   ├── services.py      business logic (transactions, audit, notifications)
│   ├── views.py         thin DRF views / viewsets
│   ├── tasks.py         Celery tasks (where needed)
│   └── urls.py
└── tests/               pytest suite (one module per area + authorization matrix + e2e flow)
```

Views stay thin. Anything with side effects (auditing, emails, revocation, token handling) lives in
`services.py`, so it can be reused and tested directly.

## Cross-cutting building blocks

| Module | Purpose |
| --- | --- |
| `apps/common/exceptions.py` | Consistent error envelope, `ServiceError` for domain errors, no stack traces leaked |
| `apps/common/middleware.py` | Request IDs, API security headers, `Cache-Control: no-store` |
| `apps/common/logging.py` | JSON log formatter + request-ID filter |
| `apps/common/storage.py` | `PrivateStorage` interface + `LocalPrivateStorage` |
| `apps/common/scanning.py` | `MalwareScanner` interface + signature scanner (EICAR) |
| `apps/common/files.py` | Upload validation: size, extension allow-list, magic bytes, safe names, SHA-256 |
| `apps/common/throttles.py` | Scoped rate limits (login, signup, email actions, refresh, uploads, share access) |
| `apps/profiles/access.py` | **Authorization engine**: `Perm`, `resolve_access`, `accessible_profiles` |
| `apps/profiles/api.py` | `ProfileScopedViewSet`, `ProfileRelatedField` — used by every health-data endpoint |
| `apps/audit/services.py` | `record_event()` — strips sensitive keys, attaches IP/UA/request ID |
| `apps/notifications/services.py` | `notify()` — preferences, dedupe keys, privacy-safe email |

## Authentication

Short-lived JWT access tokens (HS256, 10 min) carry `sub` (user) and `sid` (session). Each request
re-validates the session row, so revocation is immediate. Refresh tokens are opaque 384-bit random
strings. Only an HMAC of each is stored, and they rotate on every refresh. See
[ADR-0001](../decisions/0001-token-storage-and-sessions.md).

## Authorization

See [ADR-0002](../decisions/0002-profile-centric-authorization.md) and
[security.md](../security/security.md#authorization-rules).

## Background jobs

| Task | Schedule | Notes |
| --- | --- | --- |
| `notifications.tasks.send_email` | on demand | Retries with backoff on transport errors |
| `records.tasks.scan_document` | after upload commit | Marks CLEAN/INFECTED/FAILED; infected payloads deleted |
| `notifications.tasks.dispatch_medication_reminders` | every 5 min | 15-min lookback, skips logged doses, deduped per user/dose |
| `notifications.tasks.dispatch_appointment_reminders` | every 5 min | Row-locked, `reminder_sent_at` prevents repeats |
| `notifications.tasks.dispatch_share_expiry_notices` | every 15 min | Notifies owners when a share expires |
| `accounts.tasks.purge_expired_sessions` | daily 03:00 UTC | Deletes long-expired sessions and tokens |

Tasks are enqueued with `transaction.on_commit`, so a rolled-back request never sends email.

## Observability

- JSON logs on stdout (`LOG_FORMAT=json`; `plain` in development), each with `request_id`.
- `X-Request-ID` is echoed on every response. Inbound IDs are accepted only if well-formed.
- `GET /api/v1/health/` reports `database` and `cache` status, and nothing about infrastructure.
- Unhandled exceptions are logged with stack traces server-side. Clients get `SERVER_ERROR`.

## Settings per environment

| Module | Use |
| --- | --- |
| `dev` | Debug on, plain logs, non-secure cookies for http://localhost |
| `test` | MD5 hashing (fast), eager Celery, locmem email/cache, temp storage, relaxed throttles |
| `prod` | Debug off, HSTS, SSL redirect, secure cookies, proxy SSL header |
