from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AuthSession, User
from apps.accounts.services import revoke_all_sessions
from apps.audit.models import SECURITY_EVENTS, AuditEvent, AuditLog
from apps.audit.serializers import AdminAuditLogSerializer
from apps.audit.services import record_event
from apps.common.exceptions import ServiceError

from .permissions import IsPlatformAdmin
from .serializers import (
    AdminUserDetailSerializer,
    AdminUserSerializer,
    RoleSerializer,
    SuspendSerializer,
)


class AdminStatsView(APIView):
    permission_classes = [IsPlatformAdmin]

    @extend_schema(tags=["admin"], responses={200: dict})
    def get(self, request: Request) -> Response:
        now = timezone.now()
        users = User.objects.aggregate(
            total=Count("id"),
            active=Count("id", filter=Q(status=User.Status.ACTIVE)),
            deactivated=Count("id", filter=Q(status=User.Status.DEACTIVATED)),
            suspended=Count("id", filter=Q(status=User.Status.SUSPENDED)),
            unverified=Count("id", filter=Q(email_verified_at__isnull=True)),
            admins=Count("id", filter=Q(role=User.Role.ADMIN)),
            new_7d=Count("id", filter=Q(date_joined__gte=now - timedelta(days=7))),
            new_30d=Count("id", filter=Q(date_joined__gte=now - timedelta(days=30))),
        )
        day_ago = now - timedelta(days=1)
        events = AuditLog.objects.filter(created_at__gte=day_ago)
        return Response(
            {
                "users": users,
                "active_sessions": AuthSession.objects.filter(
                    revoked_at__isnull=True, expires_at__gt=now
                ).count(),
                "audit_last_24h": {
                    "total": events.count(),
                    "failed_logins": events.filter(event_type=AuditEvent.LOGIN_FAILED).count(),
                    "token_reuse": events.filter(event_type=AuditEvent.REFRESH_TOKEN_REUSE).count(),
                    "share_denials": events.filter(
                        event_type=AuditEvent.SHARE_ACCESS_DENIED
                    ).count(),
                },
            }
        )


class AdminConfigView(APIView):
    """Read-only view of non-secret platform configuration."""

    permission_classes = [IsPlatformAdmin]

    @extend_schema(tags=["admin"], responses={200: dict})
    def get(self, request: Request) -> Response:
        rates = settings.REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]
        return Response(
            {
                "access_token_minutes": int(
                    settings.AUTH_ACCESS_TOKEN_LIFETIME.total_seconds() // 60
                ),
                "refresh_token_days": settings.AUTH_REFRESH_TOKEN_LIFETIME.days,
                "max_upload_mb": settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024),
                "throttle_rates": rates,
                "storage_backend": settings.PRIVATE_STORAGE_BACKEND.rsplit(".", 1)[-1],
                "malware_scanner": settings.MALWARE_SCANNER_BACKEND.rsplit(".", 1)[-1],
                "email_backend": settings.EMAIL_BACKEND.rsplit(".", 2)[-2],
            }
        )


class AdminUserViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsPlatformAdmin]
    filterset_fields = ["status", "role"]
    search_fields = ["email", "full_name"]
    ordering_fields = ["date_joined", "last_login", "email"]
    ordering = ["-date_joined"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        now = timezone.now()
        return User.objects.annotate(
            active_sessions=Count(
                "auth_sessions",
                filter=Q(auth_sessions__revoked_at__isnull=True, auth_sessions__expires_at__gt=now),
            )
        )

    def get_serializer_class(self):  # type: ignore[no-untyped-def]
        return AdminUserDetailSerializer if self.action != "list" else AdminUserSerializer

    @extend_schema(tags=["admin"], responses={200: AdminAuditLogSerializer(many=True)})
    @action(detail=True, methods=["get"], url_path="security-events")
    def security_events(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        qs = (
            AuditLog.objects.filter(Q(actor=user) | Q(subject_user=user))
            .filter(event_type__in=[str(e) for e in SECURITY_EVENTS])
            .select_related("actor", "subject_user")
        )
        page = self.paginate_queryset(qs)
        return self.get_paginated_response(AdminAuditLogSerializer(page, many=True).data)

    def _guard_self(self, request: Request, user: User, verb: str) -> None:
        if user.id == request.user.id:
            raise ServiceError(f"You can't {verb} your own account.", code="INVALID_OPERATION")

    @extend_schema(
        tags=["admin"], request=SuspendSerializer, responses={200: AdminUserDetailSerializer}
    )
    @action(detail=True, methods=["post"])
    def suspend(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        self._guard_self(request, user, "suspend")
        serializer = SuspendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user.set_status(User.Status.SUSPENDED)
            user.save(update_fields=["status", "status_changed_at"])
            revoke_all_sessions(user, reason="suspended")
            record_event(
                AuditEvent.ACCOUNT_SUSPENDED,
                request=request,
                subject_user=user,
                target=user,
                metadata={"reason": serializer.validated_data["reason"]},
            )
        return Response(AdminUserDetailSerializer(self.get_object()).data)

    @extend_schema(tags=["admin"], request=None, responses={200: AdminUserDetailSerializer})
    @action(detail=True, methods=["post"])
    def reactivate(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        if user.status == User.Status.ACTIVE:
            raise ServiceError("This account is already active.", code="INVALID_OPERATION")
        user.set_status(User.Status.ACTIVE)
        user.save(update_fields=["status", "status_changed_at"])
        record_event(
            AuditEvent.ACCOUNT_REACTIVATED,
            request=request,
            subject_user=user,
            target=user,
            metadata={"by_admin": True},
        )
        return Response(AdminUserDetailSerializer(self.get_object()).data)

    @extend_schema(
        tags=["admin"], request=RoleSerializer, responses={200: AdminUserDetailSerializer}
    )
    @action(detail=True, methods=["post"])
    def role(self, request: Request, pk: str) -> Response:
        user = self.get_object()
        self._guard_self(request, user, "change the role of")
        serializer = RoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data["role"]
        if new_role != user.role:
            old_role = user.role
            user.role = new_role
            user.save(update_fields=["role"])
            record_event(
                AuditEvent.ROLE_CHANGED,
                request=request,
                subject_user=user,
                target=user,
                metadata={"from": old_role, "to": new_role},
            )
        return Response(AdminUserDetailSerializer(self.get_object()).data)


class AdminAuditLogViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    permission_classes = [IsPlatformAdmin]
    serializer_class = AdminAuditLogSerializer
    filterset_fields = {
        "event_type": ["exact", "in"],
        "actor": ["exact"],
        "subject_user": ["exact"],
        "created_at": ["gte", "lte"],
        "target_type": ["exact"],
    }
    search_fields = ["actor__email", "subject_user__email", "target_id", "request_id"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return AuditLog.objects.select_related("actor", "subject_user")

    @extend_schema(tags=["admin"], responses={200: dict})
    @action(detail=False, methods=["get"], url_path="event-types")
    def event_types(self, request: Request) -> Response:
        return Response([{"value": v, "label": label} for v, label in AuditEvent.choices])
