"""Local development settings."""

import os

os.environ.setdefault("DJANGO_SECRET_KEY", "dev-only-insecure-secret-key-change-me-0123456789")
os.environ.setdefault("AUTH_COOKIE_SECURE", "false")

from .base import *
from .base import env, env_bool

DEBUG = env_bool("DJANGO_DEBUG", True)
SESSION_COOKIE_SECURE = False
EMAIL_BACKEND = env("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
LOGGING["handlers"]["console"]["formatter"] = env("LOG_FORMAT", "plain")
