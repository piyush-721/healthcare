# HealthOS

**Your health, organized in one place.**

HealthOS is a personal and family healthcare management platform. Health information is
usually scattered across paper prescriptions, PDFs, WhatsApp messages, lab portals and medicine
boxes. HealthOS brings it together: profiles, medical records, medications, appointments, lab
results, treatment plans and a unified timeline. You decide exactly who else can see it.

> HealthOS is an **organization and coordination** tool. It does not diagnose conditions,
> recommend treatment, change medication or replace a healthcare professional. In an emergency,
> contact your local emergency services.

---

## Contents

- [Features](#features)
- [Architecture](#architecture)
- [Technology stack](#technology-stack)
- [Getting started](#getting-started)
  - [Option A — Docker (everything)](#option-a--docker-everything)
  - [Option B — Local development](#option-b--local-development)
  - [Option C — Vercel](#option-c--vercel)
- [Running tests](#running-tests)
- [API documentation](#api-documentation)
- [Security notes](#security-notes)
- [Project structure](#project-structure)
- [Further documentation](#further-documentation)

## Features

| Area | What you can do |
| --- | --- |
| **Accounts** | Sign up, verify email, sign in, refresh sessions silently, reset/change password, see active devices and security activity, deactivate and reactivate the account |
| **Health profile** | Demographics, allergies, conditions, vitals, vaccinations, emergency contacts, care providers |
| **Family** | Add dependents (such as a child) as profiles you manage; invite caregivers with **explicit, per-area permissions** (for example "view medications" or "manage appointments"), optionally time-limited |
| **Medical records** | Records with documents attached. Uploads are type- and size-validated, scanned for malware, stored privately and downloaded only through an authorized endpoint. Documents can be archived and restored |
| **Medications** | Prescribed dosage, frequency, schedules, pause/resume/complete, dose logging, today's doses, adherence history, reminders |
| **Appointments** | Upcoming/completed/cancelled/missed, notes, follow-ups, reminders |
| **Lab reports** | Manual result entry with the reference ranges from the report, trend charts, linked source document |
| **Treatment plans** | Checklists of the steps your doctor asked for, with progress tracking |
| **Health timeline** | Chronological view derived from every domain, with type, date-range and text filters |
| **Sharing** | Consent-based, read-only, time-limited links for a provider, covering only the sections you choose. Revocable instantly, with every access logged |
| **Notifications** | In-app feed plus privacy-preserving email, per-category preferences, scheduled reminders |
| **Admin console** | User management (suspend, reactivate, change role) and the audit log viewer. Admins **cannot** see health data |

## Architecture

```text
Browser ──► Next.js (App Router, React, Redux Toolkit + RTK Query)
              │  same-origin /api/v1/* proxied to Django (first-party cookies, no CORS)
              ▼
           Django REST Framework ──► PostgreSQL (business + audit data)
              │        │
              │        └──► Redis ──► Celery worker + beat (emails, reminders, malware scans)
              └──► Private file storage (local disk now; S3-style backend pluggable)
```

- **Backend:** one Django app per domain (`accounts`, `profiles`, `family`, `records`,
  `medications`, `appointments`, `labs`, `treatments`, `sharing`, `notifications`, `timeline`,
  `audit`, `administration`). They share an authorization engine (`apps/profiles/access.py`)
  and a base viewset that enforces profile-scoped permissions on every health-data endpoint.
- **Frontend:** RTK Query owns server state. Redux slices hold only the session, the active
  profile and toasts. Feature folders hold the UI, and a small design system lives in
  `components/ui`.

See [docs/architecture/overview.md](docs/architecture/overview.md) for details.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript (strict), Redux Toolkit / RTK Query, Tailwind CSS 4, Recharts |
| Backend | Python 3.12, Django 5.2, Django REST Framework, drf-spectacular (OpenAPI 3) |
| Data | PostgreSQL 16, Redis 7 |
| Async | Celery 5 (worker + beat) |
| Tooling | pytest, Vitest + Testing Library, Playwright, Ruff, Black, ESLint, Prettier, pre-commit, GitHub Actions |
| Local infra | Docker Compose (postgres, redis, mailpit, backend, worker, frontend) |

## Getting started

### Prerequisites

- Docker with Docker Compose v2
- For local (non-Docker) development, also Python 3.12 (with [uv](https://docs.astral.sh/uv/) recommended) and Node.js 20+

```bash
cp .env.example .env   # adjust values if needed; never commit .env
```

### Option A — Docker (everything)

```bash
docker compose up --build
docker compose exec backend python manage.py seed_demo   # optional demo data
```

| Service | URL |
| --- | --- |
| App | http://localhost:3000 |
| API | http://localhost:8000/api/v1/ |
| API docs (Swagger) | http://localhost:8000/api/v1/docs/ |
| Mailpit (dev inbox for verification/reset emails) | http://localhost:8025 |

Postgres is published on `localhost:5434` and Redis on `localhost:6380`, which avoids clashing with
local installs. Override these with `POSTGRES_PORT` and `REDIS_PORT`.

### Option B — Local development

```bash
make services          # Postgres, Redis, Mailpit in Docker
make install           # backend venv (uv) + npm ci
make migrate           # apply Django migrations
make seed              # optional demo data
make backend           # Django on :8000
make worker            # Celery worker + beat (reminders, emails, scans)
make frontend          # Next.js on :3000
```

Without a Celery worker, set `CELERY_TASK_ALWAYS_EAGER=true` so tasks run inline.

**Demo accounts** (after `make seed`; password `Demo-Password-2026`):

| Email | Role |
| --- | --- |
| `demo@healthos.local` | Patient with medications, appointments, labs, a dependent child and a caregiver |
| `caregiver@healthos.local` | Caregiver for the demo patient (manage medications/appointments, view labs) |
| `admin@healthos.local` | Platform admin. Note that the admin cannot open anyone's health data |

### Option C — Vercel

The whole stack runs on Vercel as one project: Next.js and Django as
[Vercel Services](https://vercel.com/docs/services), Celery through Vercel Queues, scheduled
jobs through Vercel Cron, documents in private Vercel Blob storage, and Postgres from Neon.
Follow the step-by-step guide in [docs/deployment/vercel.md](docs/deployment/vercel.md),
including the plan limits for cron and the 4 MB upload limit.

**Database and migrations**

```bash
cd backend
.venv/bin/python manage.py makemigrations   # after model changes
.venv/bin/python manage.py migrate
.venv/bin/python manage.py createsuperuser  # creates a platform admin (no health-data access)
```

## Running tests

```bash
make test-backend     # pytest (270+ tests incl. authorization matrix and end-to-end API flow)
make test-frontend    # Vitest + Testing Library component tests
make test-e2e         # Playwright: the full 18-step acceptance journey in a real browser
                      # (stack + Mailpit must be running; E2E_BROWSER_CHANNEL=chrome uses local Chrome)
make lint             # ruff, black, eslint, tsc, prettier
```

The backend suite covers the plan's required authorization boundaries for every health-data
endpoint (owner, stranger, caregiver with and without permission, expired or revoked grants,
admin). It also covers file-upload security, share expiry and revocation, audit events, Celery
reminder tasks, and the full acceptance journey in `backend/tests/test_e2e_flow.py`.

## API documentation

- Interactive docs: `GET /api/v1/docs/` (Swagger UI) and `/api/v1/redoc/`
- Machine-readable: `GET /api/v1/schema/`. A committed copy lives at [docs/api/openapi.yaml](docs/api/openapi.yaml)
- Guide to conventions (auth, errors, pagination, profile scoping): [docs/api/api.md](docs/api/api.md)
- Frontend types are generated from the schema: `make schema`

## Security notes

- **Tokens:** the access token is short-lived (10 min) and held in memory only. The refresh token
  is an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth/`. It rotates on every
  use, and reuse revokes the session. Neither token ever touches `localStorage`.
- **CSRF:** the cookie-reading auth endpoints use double-submit protection. All other endpoints use
  bearer tokens.
- **Authorization:** every health-data request is checked server-side against profile ownership and
  caregiver grants. Objects you can't access return 404, so their existence isn't disclosed, and
  foreign keys cannot reference another person's data.
- **Admin isolation:** the admin role grants zero health-data access.
- **Files:** extension and magic-byte validation, size limits, safe filenames, malware-scan
  quarantine, private storage, and authorized streaming downloads only.
- **Sharing:** high-entropy tokens, stored only as hashes and delivered in URL fragments so they
  never appear in server logs. Shares are scope-limited, expire, are revocable, and every attempt
  is logged.
- **Also:** rate limiting, secure headers/CSP, structured logs with request IDs, and an immutable
  audit log.

Full details are in [docs/security/security.md](docs/security/security.md).

## Project structure

```text
.
├── backend/                 Django project
│   ├── config/              settings (base/dev/test/prod), urls, celery
│   ├── apps/                one app per domain (see Architecture)
│   └── tests/               pytest suite
├── frontend/                Next.js app
│   └── src/
│       ├── app/             routes: (auth), (app), admin, shared
│       ├── components/      ui/ design system, layout/, domain/
│       ├── features/        feature UIs (medications, sharing, …)
│       ├── services/        RTK Query endpoint definitions
│       ├── store/           Redux store + slices
│       ├── hooks/ lib/ types/
├── docs/                    architecture, api, database, security, decisions (ADRs)
├── docker-compose.yml  Makefile  .env.example
```

## Further documentation

- [Architecture overview](docs/architecture/overview.md) · [Backend](docs/architecture/backend.md) · [Frontend](docs/architecture/frontend.md)
- [Database schema](docs/database/schema.md)
- [Security model](docs/security/security.md)
- [API guide](docs/api/api.md)
- [Architecture decision records](docs/decisions/)
