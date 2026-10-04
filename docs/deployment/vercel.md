# Deploying HealthOS on Vercel

HealthOS runs entirely on Vercel as **one project** with two
[Services](https://vercel.com/docs/services) on one domain:

```text
https://<your-app>.vercel.app
├── /api/*   → service "api": Django (Vercel Function, Python 3.12)
│              ├── Celery tasks → Vercel Queues → private worker function
│              └── scheduled jobs ← Vercel Cron → /api/v1/internal/cron/<job>/
└── /*       → service "web": Next.js
```

| HealthOS needs | Provided on Vercel by |
| --- | --- |
| Next.js frontend | Next.js service (`frontend/`) |
| Django API | Django service (`backend/`, entrypoint `config.wsgi:application`) |
| Celery worker | Vercel Queues + a queue-triggered function built from `config.celery:app` |
| Celery beat | Vercel Cron Jobs (`vercel.json` → `crons`) |
| PostgreSQL | Neon (Vercel Marketplace) → `DATABASE_URL` |
| Cache / rate limiting | Postgres table by default, or Upstash Redis (Marketplace) → `REDIS_URL` |
| Private documents | **Private** Vercel Blob store → `BLOB_READ_WRITE_TOKEN` |
| Email | Any SMTP provider (for example Resend from the Marketplace) |

Frontend and API share an origin, so the refresh cookie stays first-party, no
CORS is needed, and Vercel's edge supplies the real client IP.

The configuration lives in [`vercel.json`](../../vercel.json),
[`backend/pyproject.toml`](../../backend/pyproject.toml) (`[tool.vercel]`),
[`backend/config/settings/vercel.py`](../../backend/config/settings/vercel.py) and
[`backend/vercel_build.py`](../../backend/vercel_build.py).

## Before you start

- **Beta features:** Vercel Services and Vercel Queues are in beta (available on all plans).
- **Plan limits for cron:**
  - **Pro:** the default schedules in `vercel.json` (reminders every 5 minutes) need Pro.
  - **Hobby:** cron jobs can run at most once a day, and deployments with more frequent
    schedules are rejected. On Hobby, change every `schedule` in `vercel.json` to a daily
    expression (for example `0 8 * * *`). Medication and appointment reminders then arrive
    at most once a day.
- **Upload size:** Vercel Functions accept request and response bodies up to 4.5 MB, so
  document uploads are limited to **4 MB** on Vercel. This is applied automatically on both
  the API and the UI.

## 1. Create the project

1. Push the repository to GitHub, GitLab or Bitbucket.
2. In Vercel, choose **Add New → Project**, import the repository, and keep the **Root
   Directory as the repository root**. Vercel reads `vercel.json` and builds both services.
   Don't deploy yet; set up storage and variables first.

## 2. Add storage (Project → Storage)

1. **Postgres:** add **Neon**. This sets `DATABASE_URL` (pooled) for the project. The
   Vercel settings already disable persistent connections and server-side cursors, as
   pooled connections require.
2. **Blob:** create a Blob store with **Private** access and connect it to the project.
   Check that `BLOB_READ_WRITE_TOKEN` appears under Environment Variables. If it doesn't,
   create a read-write token for the store and add it.
3. **Redis (optional):** add **Upstash for Redis** if you want rate limiting in Redis.
   Without `REDIS_URL`, a Postgres table is used, which works fine for small deployments.

## 3. Environment variables (Project → Settings → Environment Variables)

| Variable | Required | Value |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | ✅ | Long random string, for example `python -c "import secrets;print(secrets.token_urlsafe(64))"` |
| `AUTH_JWT_SIGNING_KEY` | Recommended | A different long random string |
| `CRON_SECRET` | ✅ | Random string of at least 16 characters. Vercel sends it to the cron endpoint as a bearer token |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_SSL` / `EMAIL_USE_TLS` | ✅ for sign-up | SMTP credentials. Resend example: `smtp.resend.com`, `465`, `resend`, `<API key>`, `EMAIL_USE_SSL=true` |
| `DEFAULT_FROM_EMAIL` | ✅ for sign-up | For example `HealthOS <no-reply@yourdomain.com>` (must be a verified sender) |
| `HEALTHOS_SEED_DEMO` | Optional | `1` creates the demo accounts during the build (idempotent) |
| `FRONTEND_URL` | Optional | Your custom domain, for example `https://health.example.com`. It defaults to the production `*.vercel.app` URL and is used in email links |
| `DJANGO_ALLOWED_HOSTS` | Optional | Extra hostnames such as a custom domain. Vercel's own URLs are allowed automatically |
| `SKIP_MIGRATIONS` | Optional | `1` on Preview, if previews share the production database |

You don't need to set `DJANGO_SETTINGS_MODULE`. Vercel sets `VERCEL=1`, and the backend then
uses `config.settings.vercel` automatically.

## 4. Deploy

Deploy from the dashboard, or push to your production branch. During the build, the
Django service runs `backend/vercel_build.py`, which does the following:

1. `manage.py check --deploy` (fails the build on insecure settings)
2. `migrate`
3. `createcachetable` (when Redis isn't configured)
4. `seed_demo` (only if `HEALTHOS_SEED_DEMO=1`)

Then verify:

- `https://<your-app>.vercel.app/api/v1/health/` returns `{"status":"ok",…}`
- `https://<your-app>.vercel.app/` shows the landing page
- **Project → Cron Jobs** lists the four jobs, and **Queues** shows the `celery-healthos-celery` topic

### Demo accounts

With `HEALTHOS_SEED_DEMO=1`, the following accounts are created. They are already verified, so
no email is needed. The password for all three is `Demo-Password-2026`.

| Email | Role |
| --- | --- |
| `demo@healthos.local` | Patient with sample data |
| `caregiver@healthos.local` | Caregiver for the demo patient |
| `admin@healthos.local` | Platform admin (no health-data access) |

These credentials are public, so remove `HEALTHOS_SEED_DEMO` and delete the accounts before
storing real health information.

## Testing the Vercel setup locally

The configuration was verified without deploying:

```bash
# Build exactly as Vercel would (writes .vercel/output; nothing is uploaded)
npx vercel@latest build --prod

# Run both services, plus local Vercel Queues and Cron emulation
npx vercel@latest dev -L
```

`vercel dev` needs Python 3.12 on `PATH`. With CLI 62.2, the local router connects to
services over IPv6 (`[::1]`), while the Python dev servers bind IPv4 only. If API requests
fail locally with `ECONNRESET`, forward the service port from `[::1]` to `127.0.0.1` and add
`[::1]` to `DJANGO_ALLOWED_HOSTS`. This affects only the local emulator, not deployments.

## How the pieces work

- **Background tasks:** application code calls `.delay()` as usual. On Vercel, the
  `vercel://` broker publishes to Vercel Queues, which invokes the private worker function
  (one task per invocation, `task_acks_late=True`, at-least-once delivery). Retry backoffs
  are kept short, because a pending retry holds the invocation open.
- **Scheduled jobs:** Vercel Cron calls `GET /api/v1/internal/cron/<job>/` with
  `Authorization: Bearer $CRON_SECRET`. The endpoint only enqueues the matching Celery task.
  Without `CRON_SECRET`, the endpoint returns 404.
- **Documents:** stored under `healthos-private/documents/…` in a private Blob store. Bytes
  are read server-side and streamed through the authorized download endpoint. There are no
  public or signed Blob URLs.
- **Client IPs:** Vercel's edge overwrites `X-Forwarded-For` with the real client address,
  and the Vercel settings trust exactly one proxy (`NUM_PROXIES=1`). Rate limits and audit
  logs therefore see real IPs.
