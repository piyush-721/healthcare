"""Settings for running on Vercel (Vercel Functions + Services).

Everything secret or deployment-specific still comes from environment
variables; this module only sets Vercel-appropriate defaults:

* Postgres via the Neon integration (pooled ``DATABASE_URL``), no persistent connections.
* Shared cache: Upstash Redis if ``REDIS_URL`` is set, otherwise a Postgres table.
* Celery tasks published to Vercel Queues; scheduled jobs triggered by Vercel Cron.
* Documents in a *private* Vercel Blob store.
* Vercel's edge sets X-Forwarded-For (and overwrites client-supplied values).
"""

import os

# Defaults that must be in place before base settings are evaluated.
os.environ.setdefault("AUTH_COOKIE_SECURE", "true")
os.environ.setdefault("DATABASE_CONN_MAX_AGE", "0")
os.environ.setdefault("DATABASE_POOLED", "true")
os.environ.setdefault("NUM_PROXIES", "1")
os.environ.setdefault("LOG_FORMAT", "json")
# Vercel Functions accept at most 4.5 MB request/response bodies.
os.environ.setdefault("MAX_UPLOAD_SIZE_MB", "4")
if not os.environ.get("REDIS_URL"):
    os.environ.setdefault("CACHE_BACKEND", "database")

from .base import env, env_list
from .prod import *


def _https(host: str) -> str:
    return f"https://{host}" if host else ""


# Hostnames Vercel assigns to this deployment (production domain, deployment and branch URLs).
_VERCEL_HOSTS = [
    host
    for host in (
        os.environ.get("VERCEL_PROJECT_PRODUCTION_URL", ""),
        os.environ.get("VERCEL_URL", ""),
        os.environ.get("VERCEL_BRANCH_URL", ""),
    )
    if host
]

ALLOWED_HOSTS = [*env_list("DJANGO_ALLOWED_HOSTS", ""), *_VERCEL_HOSTS]
FRONTEND_URL = env(
    "FRONTEND_URL", _https(os.environ.get("VERCEL_PROJECT_PRODUCTION_URL", ""))
).rstrip("/")
CSRF_TRUSTED_ORIGINS = [
    *env_list("CSRF_TRUSTED_ORIGINS", ""),
    *(_https(host) for host in _VERCEL_HOSTS),
    *([FRONTEND_URL] if FRONTEND_URL else []),
]
# Frontend and API share one origin on Vercel, so browsers never need CORS.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "")

# Vercel terminates TLS and always serves HTTPS; it reports the scheme in X-Forwarded-Proto.
SECURE_SSL_REDIRECT = False

PRIVATE_STORAGE_BACKEND = env(
    "PRIVATE_STORAGE_BACKEND", "apps.common.storage_vercel.VercelBlobPrivateStorage"
)

# Celery → Vercel Queues. The adapter registering these schemes is installed by Vercel at build.
CELERY_BROKER_URL = env("CELERY_BROKER_URL", "vercel://")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", "vercel-runtime-cache://")
CELERY_TASK_ALWAYS_EAGER = False
CELERY_BEAT_SCHEDULE = {}  # replaced by Vercel Cron Jobs → /api/v1/internal/cron/<job>/

# Bearer secret Vercel Cron sends; Vercel provisions CRON_SECRET automatically.
CRON_SECRET = env("CRON_SECRET", "")

# W008 (SECURE_SSL_REDIRECT off): Vercel's edge already redirects all traffic to HTTPS.
SILENCED_SYSTEM_CHECKS = ["security.W008"]
