from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    MANDATORY_IN_APP,
    Notification,
    NotificationCategory,
    NotificationPreference,
)
from .serializers import NotificationPreferenceSerializer, NotificationSerializer
from .services import channel_preferences


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = NotificationSerializer
    filterset_fields = ["category"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        qs = Notification.objects.filter(user=self.request.user, show_in_app=True)
        if self.request.query_params.get("unread") in ("1", "true"):
            qs = qs.filter(read_at__isnull=True)
        return qs

    @extend_schema(tags=["notifications"], responses={200: dict})
    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request: Request) -> Response:
        count = self.get_queryset().filter(read_at__isnull=True).count()
        return Response({"unread": count})

    @extend_schema(tags=["notifications"], request=None, responses={200: NotificationSerializer})
    @action(detail=True, methods=["post"], url_path="read")
    def mark_read(self, request: Request, pk: str) -> Response:
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(NotificationSerializer(notification).data)

    @extend_schema(tags=["notifications"], request=None, responses={200: dict})
    @action(detail=False, methods=["post"], url_path="read-all")
    def mark_all_read(self, request: Request) -> Response:
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated})


class NotificationPreferencesView(APIView):
    def _payload(self, request: Request) -> list[dict]:
        rows = []
        for category in NotificationCategory:
            email, in_app = channel_preferences(request.user, category)
            rows.append(
                {
                    "category": category.value,
                    "label": category.label,
                    "email_enabled": email,
                    "in_app_enabled": in_app,
                    "in_app_locked": category in MANDATORY_IN_APP,
                }
            )
        return rows

    @extend_schema(
        tags=["notifications"], responses={200: NotificationPreferenceSerializer(many=True)}
    )
    def get(self, request: Request) -> Response:
        return Response(self._payload(request))

    @extend_schema(
        tags=["notifications"],
        request=NotificationPreferenceSerializer(many=True),
        responses={200: NotificationPreferenceSerializer(many=True)},
    )
    def put(self, request: Request) -> Response:
        serializer = NotificationPreferenceSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        for item in serializer.validated_data:
            NotificationPreference.objects.update_or_create(
                user=request.user,
                category=item["category"],
                defaults={
                    "email_enabled": item["email_enabled"],
                    "in_app_enabled": item["in_app_enabled"],
                },
            )
        return Response(self._payload(request))
