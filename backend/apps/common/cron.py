"""Scheduled jobs triggered over HTTP.

On platforms without a long-running scheduler (Vercel), Vercel Cron calls
``GET /api/v1/internal/cron/<job>/`` with ``Authorization: Bearer <CRON_SECRET>``.
The view only *enqueues* the Celery task, so the request returns immediately and
the work runs on the queue workers exactly as it would under Celery beat.
"""

from __future__ import annotations

import hmac
import logging

from django.conf import settings
from django.http import Http404
from django.utils.module_loading import import_string
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

JOBS: dict[str, str] = {
    "medication-reminders": "apps.notifications.tasks.dispatch_medication_reminders",
    "appointment-reminders": "apps.notifications.tasks.dispatch_appointment_reminders",
    "share-expiry": "apps.notifications.tasks.dispatch_share_expiry_notices",
    "purge-sessions": "apps.accounts.tasks.purge_expired_sessions",
}


class CronJobView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    @extend_schema(exclude=True)
    def get(self, request: Request, job: str) -> Response:
        secret = settings.CRON_SECRET
        if not secret or job not in JOBS:
            # Disabled or unknown: indistinguishable from a missing route.
            raise Http404
        supplied = request.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode(), f"Bearer {secret}".encode()):
            return Response(
                {"error": {"code": "NOT_AUTHENTICATED", "message": "Authentication is required."}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        result = import_string(JOBS[job]).delay()
        logger.info("cron job enqueued", extra={"job": job, "task_id": result.id})
        return Response({"job": job, "task_id": result.id}, status=status.HTTP_202_ACCEPTED)
