# Security model

HealthOS stores health information, so the design starts from privacy and least privilege.

## Threat model (summary)

| Threat | Mitigation |
| --- | --- |
| Token theft via XSS | Access token in memory only; refresh token `HttpOnly`; strict CSP; React escaping; no `dangerouslySetInnerHTML` |
| Refresh-token theft | Rotation on every use; reuse of an old token (outside a 30 s multi-tab grace) revokes the session and is audited |
| CSRF | Cookie is `SameSite=Strict` and path-scoped; cookie-reading endpoints require double-submit `X-CSRFToken`; all other endpoints use bearer tokens |
| Credential stuffing / brute force | Per-IP throttles on login, signup, email actions and refresh; generic error messages; failed logins audited |
| Account enumeration | Sign-up, resend-verification, forgot-password and reactivation return identical responses whether or not the account exists |
| IDOR / horizontal privilege escalation | Querysets filtered to accessible profiles (404 otherwise); FK fields restricted to the same profile; `profile` never writable on update |
| Mass assignment | Explicit serializer field lists; status/role/owner fields read-only; transitions only through dedicated actions |
| Vertical escalation (admin) | Admin role grants **no** health-data access; admin endpoints expose account metadata and audit data only; admins can't suspend or demote themselves |
| Malicious uploads | Extension allow-list, magic-byte check, size limit, sanitized names, malware scan with quarantine, `attachment` + `sandbox` CSP on download |
| Data exposure in transit / logs | HSTS and SSL redirect in production; share tokens in URL fragments; logs and audit never contain passwords, tokens or file contents |
| Over-sharing with providers | Section-scoped, read-only, expiring (max 30 days), revocable shares; every attempt logged; caregivers can't re-share |
| Stale access | Session re-validated on each request; caregiver grants checked for status and expiry on each request; deactivation revokes sessions, shares and grants |

## Authentication

- Passwords are hashed with PBKDF2-SHA256 at Django's default work factor and validated for length
  (≥ 10), similarity, common-password lists and all-numeric values.
- Access tokens are HS256 JWTs with a 10-minute lifetime. Claims: `iss`, `sub`, `sid`, `typ`,
  `iat`, `exp`. Each request re-checks the session row, so revocation is immediate.
- Refresh tokens are 384-bit random values. The database stores only `HMAC-SHA256(SECRET_KEY,
  token)`. They rotate on every refresh. Sessions expire after 14 days.
- Email verification is required before sign-in. Verification, reset and reactivation tokens are
  single-use, hashed and expiring (48 h / 1 h / 24 h). Issuing a new one invalidates the old.
- Password reset revokes all sessions. Password change revokes all other sessions.

## Authorization rules

The rules live in `backend/apps/profiles/access.py` and are enforced by `ProfileScopedViewSet`.

1. All health data belongs to a `PatientProfile`.
2. The profile **owner** (the person, or the guardian of a dependent) has every permission.
3. A **caregiver** has exactly the permissions on an ACTIVE, unexpired `CaregiverAccess` grant.
   `MANAGE_*` implies the matching `VIEW_*`. There is no "full access" permission.
4. **Platform admins** get nothing from their role.
5. **Healthcare providers** never authenticate as users. They use scoped share tokens.
6. Only owners can invite caregivers, change grants, create shares or delete dependent profiles.

| Permission | Allows |
| --- | --- |
| `VIEW_PROFILE` / `MANAGE_PROFILE` | Demographics, allergies, conditions, vitals, vaccinations, emergency contacts, care providers |
| `VIEW_MEDICATIONS` / `MANAGE_MEDICATIONS` | Medications, schedules, dose logging |
| `VIEW_APPOINTMENTS` / `MANAGE_APPOINTMENTS` | Appointments, notes, status |
| `VIEW_DOCUMENTS` / `UPLOAD_DOCUMENTS` | Records and documents (view, download / create, edit, archive) |
| `VIEW_LAB_RESULTS` / `MANAGE_LAB_RESULTS` | Lab reports and trends |
| `VIEW_TREATMENT_PLANS` / `MANAGE_TREATMENT_PLANS` | Plans and tasks |

The timeline and dashboard include only the sections the caller may view.

**Response semantics:** no relationship to the profile gives 404; a relationship without the needed
permission gives 403; no token gives 401.

These boundaries are covered by `backend/tests/test_authorization.py`, a parametrized matrix that
runs every health-data endpoint against every role.

## Provider sharing

- Token: 256-bit random, shown once at creation, stored as an HMAC.
- Link format: `https://app/shared#token=…`. The fragment never reaches servers, proxies or
  `Referer` headers. The page sends the token in the `X-Share-Token` header.
- Scope: a subset of PROFILE, MEDICATIONS, APPOINTMENTS, DOCUMENTS, LAB_RESULTS,
  TREATMENT_PLANS, FINANCIAL. Bills are only visible with FINANCIAL.
- Lifetime: 1 hour to 30 days. Expiry and revocation are checked on every request.
- Logging: every attempt is recorded as a `ShareAccessLog` row (GRANTED / DENIED_EXPIRED /
  DENIED_REVOKED / DENIED_SCOPE) and an audit event. The owner sees the access log.

## Files

- Allowed types: PDF, PNG, JPEG, WebP. Both the extension **and** the leading magic bytes must
  match.
- Default size limit is 15 MB (`MAX_UPLOAD_SIZE_MB`). Empty files are rejected.
- Stored under random keys outside any web root (`0600` permissions), and never served
  statically. The storage backend is pluggable through the `PrivateStorage` interface; an S3
  backend should use short-lived pre-signed URLs.
- Scanned asynchronously. Downloads are blocked until a file is CLEAN. INFECTED payloads are
  deleted and the event is audited.
- Downloads stream through an authorized endpoint with `Content-Disposition: attachment`,
  `Cache-Control: private, no-store` and `Content-Security-Policy: sandbox`.

## Audit logging

`AuditLog` is append-only (updates and deletes raise in application code). Each entry holds the
event type, actor, subject, profile ID, target, IP, user agent, request ID, and metadata with
sensitive keys stripped. Events include LOGIN, LOGIN_FAILED, LOGOUT, PASSWORD_CHANGED,
PASSWORD_RESET, ACCOUNT_DEACTIVATED/SUSPENDED/REACTIVATED, ROLE_CHANGED,
REFRESH_TOKEN_REUSE, RECORD_CREATED/UPDATED/DELETED, DOCUMENT_UPLOADED/VIEWED/ARCHIVED/QUARANTINED,
CAREGIVER_*, SHARE_CREATED/REVOKED, SHARED_RECORD_ACCESSED and SHARE_ACCESS_DENIED.

Users see their own security events. Admins see the full log, which contains identifiers and no
clinical content.

## HTTP hardening

- API responses carry `Content-Security-Policy: default-src 'none'`,
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`,
  COOP/CORP and `Cache-Control: no-store`.
- Frontend: a strict CSP (`frame-ancestors 'none'`, `object-src 'none'`, `connect-src 'self'`) and
  the same supporting headers.
- Production settings add HSTS (1 year, preload), SSL redirect, secure cookies and proxy SSL
  header handling.
- CORS is restricted to `CORS_ALLOWED_ORIGINS`, with credentials only on `/api/`.

## Secrets and configuration

All secrets come from environment variables (`.env.example` documents them). `.env` is
git-ignored, and the frontend bundle contains no secrets. Use separate `DJANGO_SECRET_KEY` and
`AUTH_JWT_SIGNING_KEY` values in production. Rotating the JWT key invalidates every outstanding
access token at once. Clients recover by refreshing through their (unaffected) refresh sessions.

## Product safety boundaries

HealthOS never diagnoses, prescribes, changes dosages, tells users to stop medication or makes
emergency decisions. Lab values are compared only with the reference range printed on the user's
own report, using neutral wording ("Above report range"). The `LabResult.source` field already
marks machine-extracted values for future OCR, which must be reviewed by the user and must never
overwrite their entries.

## Known limitations / next steps

- The malware scanner is a signature stub that detects only EICAR. Plug in ClamAV (`clamd`) or a
  cloud scanning API through `MALWARE_SCANNER_BACKEND`.
- Refresh-token reuse detection covers the previous token generation. Full token-family tracking
  could be added.
- No MFA yet. TOTP/WebAuthn would plug into `accounts.services.login`.
- Behind a reverse proxy, configure the proxy (or a trusted middleware) so `REMOTE_ADDR`
  reflects the real client. Throttling and audit IPs depend on it.
