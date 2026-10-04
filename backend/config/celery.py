"""Celery application.

Workers and beat are started with ``celery -A config worker`` / ``celery -A config beat``.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("healthos")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
