import logging

from django.core.cache import cache
from django.db import connection
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class HealthView(APIView):
    """Liveness/readiness probe. Reports component status only — no infrastructure details."""

    authentication_classes: list = []
    permission_classes = [AllowAny]
    throttle_classes: list = []

    @extend_schema(responses={200: dict, 503: dict}, tags=["system"])
    def get(self, request: Request) -> Response:
        checks = {"database": self._check_database(), "cache": self._check_cache()}
        healthy = all(value == "ok" for value in checks.values())
        return Response(
            {"status": "ok" if healthy else "degraded", "checks": checks},
            status=200 if healthy else 503,
        )

    @staticmethod
    def _check_database() -> str:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            return "ok"
        except Exception:
            logger.exception("Health check: database unavailable")
            return "unavailable"

    @staticmethod
    def _check_cache() -> str:
        try:
            cache.set("healthcheck", "1", 5)
            return "ok" if cache.get("healthcheck") == "1" else "unavailable"
        except Exception:
            logger.exception("Health check: cache unavailable")
            return "unavailable"
