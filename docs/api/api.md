# API guide

Base path: **`/api/v1/`**. The full contract is OpenAPI 3: `/api/v1/schema/` (live),
[`openapi.yaml`](openapi.yaml) (committed), and Swagger UI at `/api/v1/docs/`.

## Authentication

| Step | Request |
| --- | --- |
| Get CSRF cookie | `GET /auth/csrf/` |
| Sign in | `POST /auth/login/` (header `X-CSRFToken`) → `{access_token, access_token_expires_at, user}` + `healthos_refresh` cookie |
| Call APIs | `Authorization: Bearer <access_token>` |
| Refresh | `POST /auth/refresh/` (cookie + `X-CSRFToken`) → new access token, rotated cookie |
| Sign out | `POST /auth/logout/` (cookie + `X-CSRFToken`) |

Other auth endpoints: `register/`, `verify-email/`, `verify-email/resend/`, `password/forgot/`,
`password/reset/`, `password/change/`, `account/deactivate/`, `account/reactivate/request/`,
`account/reactivate/confirm/`, `me/`, `sessions/`, `sessions/{id}/`, `logout-all/`,
`security-activity/`.

Email links carry tokens in the URL **fragment** (`/verify-email#token=…`). The frontend posts
them in the request body.

## Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": { "email": ["Enter a valid email address."] }
  }
}
```

Common codes: `VALIDATION_ERROR`, `NOT_AUTHENTICATED`, `AUTHENTICATION_FAILED`,
`PERMISSION_DENIED`, `NOT_FOUND`, `RATE_LIMITED` (with `retry_after_seconds`),
`INVALID_CREDENTIALS`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_DEACTIVATED`, `ACCOUNT_SUSPENDED`,
`SESSION_EXPIRED`, `REFRESH_CONFLICT`, `INVALID_TOKEN`, `SHARE_NOT_FOUND`, `SHARE_EXPIRED`,
`SHARE_REVOKED`, `SHARE_SCOPE_DENIED`, `SERVER_ERROR`. Stack traces are never returned.

## Profile scoping

All health data belongs to a **profile**: your own, a dependent you manage, or someone who made
you a caregiver.

- **List:** `GET /medications/?profile=<uuid>`. Leaving `profile` out means your own profile.
- **Create:** include `"profile": "<uuid>"` in the body. Leaving it out means your own profile.
- **Detail, update, delete:** by object id. Objects on profiles you can't view return **404**.
  Objects you can view but not manage return **403** on writes.
- `GET /profiles/` lists every profile you can access, with `access_role` and `permissions`.

## Pagination, filtering, sorting

Lists are page-number paginated:

```json
{ "count": 42, "next": "…?page=2", "previous": null, "results": [ … ] }
```

- `page`, `page_size` (max 100)
- `search=` free text on the documented fields
- `ordering=` such as `-scheduled_at` or `record_date`
- field filters such as `status=ACTIVE`, `record_type=IMAGING`, `scheduled_at__gte=…`

The timeline uses cursor pagination (`cursor` and `next_cursor`), because it merges several
sources.

## Endpoint index

| Area | Endpoints |
| --- | --- |
| Health | `GET /health/` |
| Profiles | `/profile/` (self), `/profiles/`, `/emergency-contacts/`, `/allergies/`, `/conditions/`, `/vitals/`, `/vaccinations/`, `/providers/` |
| Family | `GET/POST /family/`, `/family/caregivers/` (+ `{id}/revoke/`), `/family/invitations/` (+ `{id}/accept/`, `{id}/decline/`), `/family/caring-for/` (+ `{id}/leave/`) |
| Records | `/records/`, `/documents/` (multipart upload; `{id}/download/`, `{id}/archive/`, `{id}/restore/`) |
| Medications | `/medications/` (+ `{id}/pause|resume|complete|stop/`, `{id}/log/`, `{id}/logs/`, `{id}/adherence/`), `/medications/today/` |
| Appointments | `/appointments/?view=upcoming|past` (+ `{id}/status/`, `{id}/notes/`, `{id}/notes/{note_id}/`) |
| Labs | `/lab-reports/` (+ `tests/`, `trends/?test=`) |
| Treatments | `/treatment-plans/` (+ `{id}/tasks/`, `{id}/tasks/{task_id}/`) |
| Timeline | `GET /timeline/?types=&from=&to=&q=&cursor=&limit=`, `GET /dashboard/` |
| Sharing (owner) | `/shares/` (+ `{id}/revoke/`, `{id}/access-logs/`) |
| Sharing (recipient) | `GET /shared/`, `GET /shared/{section}/`, `GET /shared/documents/{id}/download/` with header `X-Share-Token` |
| Notifications | `/notifications/` (+ `unread-count/`, `{id}/read/`, `read-all/`), `GET/PUT /notifications/preferences/` |
| Admin | `/admin/stats/`, `/admin/config/`, `/admin/users/` (+ `suspend/`, `reactivate/`, `role/`, `security-events/`), `/admin/audit-logs/` (+ `event-types/`) |

## Rate limits (defaults, configurable via env)

| Scope | Limit |
| --- | --- |
| Login | 10/min per IP |
| Sign-up | 5/min per IP |
| Email actions (verify, reset, reactivate) | 5/min per IP |
| Refresh | 120/min per IP |
| Share access | 60/min per IP |
| Uploads | 30/min per user |
| Anonymous / authenticated default | 120 / 600 per min |
