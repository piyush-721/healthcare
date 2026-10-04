"""Email delivery abstraction.

Application code calls :func:`queue_email`; delivery happens asynchronously in a
Celery worker after the surrounding transaction commits. The transport is
Django's configurable ``EMAIL_BACKEND`` (SMTP/Mailpit locally, any provider in
production), so swapping providers requires no code changes.
"""

from __future__ import annotations

from django.conf import settings
from django.db import transaction


def frontend_link(path: str, *, token: str | None = None) -> str:
    """Build a frontend URL. Secrets go in the fragment so they never reach server logs."""
    url = f"{settings.FRONTEND_URL}{path}"
    return f"{url}#token={token}" if token else url


def queue_email(*, to: str, subject: str, body: str) -> None:
    from .tasks import send_email

    transaction.on_commit(lambda: send_email.delay(to=to, subject=subject, body=body))
