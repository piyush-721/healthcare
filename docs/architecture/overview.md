# Architecture overview

## System context

```text
                         Browser
                            │  https (same origin)
                            ▼
                    Next.js frontend ── rewrites /api/v1/* ──┐
                                                             ▼
                                                  Django REST API (gunicorn)
                                                             │
                     ┌───────────────────────┬───────────────┼────────────────┐
                     ▼                       ▼               ▼                ▼
                PostgreSQL                 Redis       Private storage    SMTP / email
         (business + audit data)    (cache, throttles,  (documents)        provider
                                     Celery broker)
                                          │
                                          ▼
                                   Celery worker + beat
                       (emails, reminders, malware scans, cleanup)
```

### Why the frontend proxies the API

The browser only talks to the Next.js origin. `/api/v1/*` is rewritten to Django, which means:

- the refresh-token and CSRF cookies are **first-party** and can be `SameSite=Strict`;
- no CORS is needed in the browser (CORS is still configured for direct API clients);
- one origin is easier to give a strict Content-Security-Policy.

## Responsibilities

| Layer | Owns |
| --- | --- |
| Frontend | Presentation, interaction, client-side validation for UX, server-state caching (RTK Query), session bootstrap and silent refresh |
| Django API | Authentication, **all** authorization, validation, business rules, persistence, audit logging, notification fan-out, file metadata |
| PostgreSQL | Durable application and audit data |
| Redis | DRF throttle counters, cache, Celery broker and result backend |
| Celery | Email delivery, medication/appointment reminders, share-expiry notices, document malware scanning, session cleanup |
| Private storage | Document bytes, addressed only by opaque keys |

## Domain map

```text
accounts ──┬─ User, AuthSession (refresh sessions), AccountToken (verify/reset/reactivate)
           │
profiles ──┼─ PatientProfile ◄── the subject of all health data
           │     ├─ EmergencyContact, Allergy, MedicalCondition, VitalRecord, VaccinationRecord
           │     └─ access.py — central authorization rules (Perm, resolve_access)
family ────┼─ CaregiverAccess (profile ↔ caregiver user, explicit permissions, status, expiry)
records ───┼─ CareProvider, MedicalRecord, MedicalDocument (+ private storage, scanning)
medications┼─ Medication, MedicationSchedule, MedicationLog
appointments─ Appointment, AppointmentNote
labs ──────┼─ LabReport, LabResult
treatments ┼─ TreatmentPlan, TreatmentTask
sharing ───┼─ DataShare (scoped, expiring provider access), ShareAccessLog
notifications Notification, NotificationPreference, email abstraction, reminder tasks
timeline ──┼─ derived timeline + dashboard (no tables)
audit ─────┼─ AuditLog (append-only)
administration admin-only endpoints (account metadata + audit; no health data)
```

## Request lifecycle (health-data endpoint)

1. `RequestIDMiddleware` assigns a correlation ID. It goes into the response header, every log
   line and audit rows.
2. `AccessTokenAuthentication` verifies the JWT and loads the backing `AuthSession`. A revoked
   session or inactive user is rejected immediately.
3. `ProfileScopedViewSet` resolves the target profile and checks the required permission through
   `profiles.access`. Querysets are always filtered to accessible profiles, so other people's
   objects are 404.
4. Serializers validate the payload. `ProfileRelatedField` ensures foreign keys point into the same
   profile.
5. Writes run in a transaction that also records an audit event.
6. Errors are normalized to `{"error": {"code", "message", "fields"}}`.

## Key design choices

See the ADRs in [`docs/decisions`](../decisions):

- [ADR-0001](../decisions/0001-token-storage-and-sessions.md) Token storage and session rotation
- [ADR-0002](../decisions/0002-profile-centric-authorization.md) Profile-centric authorization
- [ADR-0003](../decisions/0003-derived-timeline.md) Derived timeline, no timeline table
- [ADR-0004](../decisions/0004-provider-sharing-tokens.md) Provider sharing via scoped tokens
- [ADR-0005](../decisions/0005-server-state-in-rtk-query.md) Server state in RTK Query
- [ADR-0006](../decisions/0006-private-file-storage.md) Private file storage and scanning
