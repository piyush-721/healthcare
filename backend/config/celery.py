"""Celery application.

Workers and beat are started with ``celery -A config worker`` / ``celery -A config beat``.
"""

import os

from celery import Celery

os.environ.setdefault(
    "DJANGO_SETTINGS_MODULE",
    "config.settings.vercel" if os.environ.get("VERCEL") else "config.settings.dev",
)

# On Vercel, Celery tasks run in a queue-triggered function whose handler executes
# each task inside an asyncio event loop. Our tasks are synchronous Django code and
# each invocation runs exactly one task, so synchronous ORM use is safe there; Django
# would otherwise reject it with SynchronousOnlyOperation. Scoped to the worker only.
if os.environ.get("VERCEL_PYTHON_SUBSCRIBER_ID"):
    os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")

app = Celery("healthos")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
