"""Base settings shared by every environment.

All secrets and environment-specific values come from environment variables.
See ``.env.example`` at the repository root.
"""

from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

import dj_database_url
from celery.schedules import crontab
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent.parent


def env(name: str, default: str | None = None, *, required: bool = False) -> str:
    value = os.environ.get(name, default)
    if required and not value:
        raise ImproperlyConfigured(f"Environment variable {name} is required.")
    return value or ""


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in env(name, default).split(",") if item.strip()]


def env_int(name: str, default: int) -> int:
    return int(env(name, str(default)))


SECRET_KEY = env("DJANGO_SECRET_KEY", required=True)
DEBUG = env_bool("DJANGO_DEBUG", False)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.postgres",
    "rest_framework",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "apps.common",
    "apps.accounts",
    "apps.audit",
    "apps.profiles",
    "apps.family",
    "apps.records",
    "apps.medications",
    "apps.appointments",
    "apps.labs",
    "apps.treatments",
    "apps.sharing",
    "apps.notifications",
    "apps.timeline",
    "apps.administration",
]

MIDDLEWARE = [
    "apps.common.middleware.RequestIDMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.middleware.SecurityHeadersMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {"context_processors": []},
    }
]

DATABASES = {
    "default": dj_database_url.parse(
        env("DATABASE_URL", "postgres://healthos:healthos@localhost:5434/healthos"),
        conn_max_age=env_int("DATABASE_CONN_MAX_AGE", 60),
        conn_health_checks=True,
    )
}
# Required behind transaction-mode poolers (PgBouncer, Neon's pooled endpoint).
DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = env_bool("DATABASE_POOLED", False)
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"
AUTHENTICATION_BACKENDS = ["django.contrib.auth.backends.ModelBackend"]

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
]
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 10},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = False
USE_TZ = True

# The API serves no static files (Swagger UI loads its assets from a CDN).
STATIC_URL = "static/"

# ---------------------------------------------------------------------------
# Cache / Redis
# ---------------------------------------------------------------------------
REDIS_URL = env("REDIS_URL", "redis://localhost:6380/0")
# The cache backs rate limiting, so it must be shared by every server instance.
# "redis" (default) or "database" (a Postgres table; run `manage.py createcachetable`).
CACHE_BACKEND = env("CACHE_BACKEND", "redis")
if CACHE_BACKEND == "database":
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "healthos_cache",
            "KEY_PREFIX": "healthos",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "healthos",
        }
    }

# ---------------------------------------------------------------------------
# Django REST Framework
# ---------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.accounts.authentication.AccessTokenAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
        "rest_framework.parsers.MultiPartParser",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.StandardPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.common.exceptions.api_exception_handler",
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": env("THROTTLE_ANON", "120/min"),
        "user": env("THROTTLE_USER", "600/min"),
        "auth_login": env("THROTTLE_AUTH_LOGIN", "10/min"),
        "auth_signup": env("THROTTLE_AUTH_SIGNUP", "5/min"),
        "auth_email": env("THROTTLE_AUTH_EMAIL", "5/min"),
        "auth_refresh": env("THROTTLE_AUTH_REFRESH", "120/min"),
        "share_access": env("THROTTLE_SHARE_ACCESS", "60/min"),
        "uploads": env("THROTTLE_UPLOADS", "30/min"),
    },
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
    # Number of trusted reverse proxies in front of Django. 0 = use REMOTE_ADDR only,
    # so clients can't spoof X-Forwarded-For to dodge rate limits.
    "NUM_PROXIES": env_int("NUM_PROXIES", 0),
    "UNAUTHENTICATED_USER": None,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "HealthOS API",
    "DESCRIPTION": (
        "HealthOS personal and family health organization API. "
        "HealthOS organizes information; it does not diagnose or recommend treatment."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": "/api/v1",
    "COMPONENT_SPLIT_REQUEST": True,
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
    "ENUM_NAME_OVERRIDES": {
        "AppointmentStatusEnum": "apps.appointments.models.Appointment.Status",
        "AppointmentKindEnum": "apps.appointments.models.Appointment.Kind",
        "MedicationStatusEnum": "apps.medications.models.Medication.Status",
        "MedicationLogStatusEnum": "apps.medications.models.MedicationLog.Status",
        "ConditionStatusEnum": "apps.profiles.models.MedicalCondition.Status",
        "TreatmentPlanStatusEnum": "apps.treatments.models.TreatmentPlan.Status",
        "TreatmentTaskStatusEnum": "apps.treatments.models.TreatmentTask.Status",
        "TreatmentTaskKindEnum": "apps.treatments.models.TreatmentTask.Kind",
        "CareProviderKindEnum": "apps.records.models.CareProvider.Kind",
        "CaregiverStatusEnum": "apps.family.models.CaregiverAccess.Status",
        "UserStatusEnum": "apps.accounts.models.User.Status",
        "DocumentScanStatusEnum": "apps.records.models.MedicalDocument.ScanStatus",
    },
}

# ---------------------------------------------------------------------------
# Authentication tokens
# ---------------------------------------------------------------------------
AUTH_ACCESS_TOKEN_LIFETIME = timedelta(minutes=env_int("AUTH_ACCESS_TOKEN_MINUTES", 10))
AUTH_REFRESH_TOKEN_LIFETIME = timedelta(days=env_int("AUTH_REFRESH_TOKEN_DAYS", 14))
AUTH_JWT_SIGNING_KEY = env("AUTH_JWT_SIGNING_KEY", SECRET_KEY)
AUTH_JWT_ISSUER = "healthos"
AUTH_REFRESH_COOKIE_NAME = "healthos_refresh"
AUTH_REFRESH_COOKIE_PATH = "/api/v1/auth/"
AUTH_REFRESH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", True)
AUTH_REFRESH_COOKIE_SAMESITE = "Strict"
EMAIL_VERIFICATION_TOKEN_LIFETIME = timedelta(hours=48)
PASSWORD_RESET_TOKEN_LIFETIME = timedelta(hours=1)
ACCOUNT_REACTIVATION_TOKEN_LIFETIME = timedelta(hours=24)
CAREGIVER_INVITE_LIFETIME = timedelta(days=7)

# ---------------------------------------------------------------------------
# CSRF / CORS / cookies
# ---------------------------------------------------------------------------
FRONTEND_URL = env("FRONTEND_URL", "http://localhost:3000").rstrip("/")
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", FRONTEND_URL)
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS", FRONTEND_URL)
CSRF_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", True)
CSRF_COOKIE_SAMESITE = "Strict"
CSRF_COOKIE_HTTPONLY = False  # The SPA must read it to send X-CSRFToken (double submit).
SESSION_COOKIE_SECURE = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# ---------------------------------------------------------------------------
# Files
# ---------------------------------------------------------------------------
PRIVATE_STORAGE_BACKEND = env("PRIVATE_STORAGE_BACKEND", "apps.common.storage.LocalPrivateStorage")
PRIVATE_STORAGE_ROOT = Path(env("PRIVATE_STORAGE_ROOT", str(BASE_DIR / "private_storage")))
MALWARE_SCANNER_BACKEND = env("MALWARE_SCANNER_BACKEND", "apps.common.scanning.SignatureScanner")
MAX_UPLOAD_SIZE_BYTES = env_int("MAX_UPLOAD_SIZE_MB", 15) * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 2 * 1024 * 1024

# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST = env("EMAIL_HOST", "localhost")
EMAIL_PORT = env_int("EMAIL_PORT", 1025)
EMAIL_HOST_USER = env("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL", "HealthOS <no-reply@healthos.local>")

# ---------------------------------------------------------------------------
# Celery
# ---------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", False)
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_TASK_ACKS_LATE = True
CELERY_TASK_TIME_LIMIT = 120
CELERY_WORKER_HIJACK_ROOT_LOGGER = False
CELERY_TIMEZONE = "UTC"
# Shared secret for the scheduled-job endpoint (/api/v1/internal/cron/<job>/), used when
# a platform scheduler such as Vercel Cron replaces Celery beat. Empty disables the endpoint.
CRON_SECRET = env("CRON_SECRET", "")
CELERY_BEAT_SCHEDULE = {
    "dispatch-medication-reminders": {
        "task": "apps.notifications.tasks.dispatch_medication_reminders",
        "schedule": crontab(minute="*/5"),
    },
    "dispatch-appointment-reminders": {
        "task": "apps.notifications.tasks.dispatch_appointment_reminders",
        "schedule": crontab(minute="*/5"),
    },
    "notify-expiring-shares": {
        "task": "apps.notifications.tasks.dispatch_share_expiry_notices",
        "schedule": crontab(minute="*/15"),
    },
    "purge-expired-sessions": {
        "task": "apps.accounts.tasks.purge_expired_sessions",
        "schedule": crontab(hour="3", minute="0"),
    },
}

# ---------------------------------------------------------------------------
# Logging — structured JSON with request IDs
# ---------------------------------------------------------------------------
LOG_LEVEL = env("LOG_LEVEL", "INFO")
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"request_id": {"()": "apps.common.logging.RequestIDFilter"}},
    "formatters": {
        "json": {"()": "apps.common.logging.JSONFormatter"},
        "plain": {"format": "%(asctime)s %(levelname)s [%(request_id)s] %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": env("LOG_FORMAT", "json"),
            "filters": ["request_id"],
        }
    },
    "root": {"handlers": ["console"], "level": LOG_LEVEL},
    "loggers": {
        "django.request": {"level": "WARNING"},
        "django.db.backends": {"level": "WARNING"},
        "celery": {"level": "INFO"},
    },
}
