import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from .models import AccountToken, AuthSession

logger = logging.getLogger(__name__)


@shared_task
def purge_expired_sessions() -> dict[str, int]:
    """Delete sessions and one-time tokens that expired more than 30 days ago."""
    cutoff = timezone.now() - timedelta(days=30)
    sessions, _ = AuthSession.objects.filter(expires_at__lt=cutoff).delete()
    tokens, _ = AccountToken.objects.filter(expires_at__lt=cutoff).delete()
    logger.info("purged expired sessions", extra={"sessions": sessions, "tokens": tokens})
    return {"sessions": sessions, "tokens": tokens}
