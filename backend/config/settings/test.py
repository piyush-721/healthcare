"""Test settings: fast hashing, eager Celery, in-memory email and cache."""

import os
import tempfile
from pathlib import Path

os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key-not-for-production-0123456789abcdef")
os.environ.setdefault("AUTH_COOKIE_SECURE", "true")

from .base import *
from .base import BASE_DIR  # noqa: F401

DEBUG = False
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CACHES = {"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}}
PRIVATE_STORAGE_ROOT = Path(tempfile.mkdtemp(prefix="healthos-test-storage-"))
REST_FRAMEWORK = {**REST_FRAMEWORK}
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = dict.fromkeys(
    REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"], "10000/min"
)
LOGGING["root"]["level"] = "WARNING"
LOGGING["handlers"]["console"]["formatter"] = "plain"
