import os

from django.core.asgi import get_asgi_application

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.vercel" if os.environ.get("VERCEL") else "config.settings.prod",
)

application = get_asgi_application()
