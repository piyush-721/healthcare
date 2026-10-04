"""Production settings. Every secret must be provided via the environment."""

from .base import *
from .base import env_bool, env_int

DEBUG = False
SECURE_SSL_REDIRECT = env_bool("SECURE_SSL_REDIRECT", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_HSTS_SECONDS = env_int("SECURE_HSTS_SECONDS", 31536000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
AUTH_REFRESH_COOKIE_SECURE = True
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
