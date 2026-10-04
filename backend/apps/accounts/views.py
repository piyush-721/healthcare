"""Authentication endpoints.

Token transport:
* access token — returned in the JSON body, kept in memory by the SPA, sent as
  ``Authorization: Bearer``; never persisted in browser storage.
* refresh token — HttpOnly, Secure, SameSite=Strict cookie scoped to
  ``/api/v1/auth/``. Endpoints that read it also enforce a double-submit CSRF check.
"""

from __future__ import annotations

from django.conf import settings
from django.db.models import Q
from django.http import HttpResponse
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import SECURITY_EVENTS, AuditEvent, AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.audit.services import record_event
from apps.common.exceptions import ServiceError
from apps.common.throttles import (
    EmailActionThrottle,
    LoginThrottle,
    RefreshThrottle,
    SignupThrottle,
)

from . import services
from .authentication import enforce_csrf
from .models import AuthSession
from .serializers import (
    AuthResponseSerializer,
    ChangePasswordSerializer,
    EmailSerializer,
    LoginSerializer,
    PasswordConfirmSerializer,
    RegisterSerializer,
    ResetPasswordSerializer,
    SessionSerializer,
    TokenSerializer,
    UserSerializer,
    UserUpdateSerializer,
)

ACCEPTED = {"detail": "If the account is eligible, we've sent an email with next steps."}


def _set_refresh_cookie(response: Response, issued: services.IssuedSession) -> None:
    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        issued.refresh_token,
        expires=issued.session.expires_at,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        secure=settings.AUTH_REFRESH_COOKIE_SECURE,
        httponly=True,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def _clear_refresh_cookie(response: HttpResponse) -> None:
    response.delete_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        path=settings.AUTH_REFRESH_COOKIE_PATH,
        samesite=settings.AUTH_REFRESH_COOKIE_SAMESITE,
    )


def _auth_response(issued: services.IssuedSession, status_code: int = 200) -> Response:
    payload = {
        "access_token": issued.access.token,
        "access_token_expires_at": issued.access.expires_at,
        "user": UserSerializer(issued.user).data,
    }
    response = Response(AuthResponseSerializer(payload).data, status=status_code)
    _set_refresh_cookie(response, issued)
    return response


class PublicAuthView(APIView):
    authentication_classes: list = []
    permission_classes = [AllowAny]


class CookieAuthView(PublicAuthView):
    """Public endpoint that relies on cookies and therefore requires a CSRF token."""

    def initial(self, request: Request, *args, **kwargs) -> None:  # type: ignore[no-untyped-def]
        super().initial(request, *args, **kwargs)
        enforce_csrf(request)


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CSRFView(PublicAuthView):
    @extend_schema(tags=["auth"], responses={200: dict})
    def get(self, request: Request) -> Response:
        return Response({"csrf_token": get_token(request)})


class RegisterView(PublicAuthView):
    throttle_classes = [SignupThrottle]

    @extend_schema(tags=["auth"], request=RegisterSerializer, responses={201: dict})
    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        services.register_user(
            email=data["email"],
            password=data["password"],
            full_name=data["full_name"],
            tz=data["timezone"],
            request=request,
        )
        return Response(
            {"detail": "Check your inbox to verify your email address."},
            status=status.HTTP_201_CREATED,
        )


class VerifyEmailView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=TokenSerializer, responses={200: dict})
    def post(self, request: Request) -> Response:
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.verify_email(serializer.validated_data["token"], request)
        return Response({"detail": "Your email address is verified. You can now sign in."})


class ResendVerificationView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=EmailSerializer, responses={202: dict})
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.resend_verification(serializer.validated_data["email"])
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class LoginView(CookieAuthView):
    throttle_classes = [LoginThrottle]

    @extend_schema(tags=["auth"], request=LoginSerializer, responses={200: AuthResponseSerializer})
    def post(self, request: Request) -> Response:
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        issued = services.login(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
            request=request,
        )
        return _auth_response(issued)


class RefreshView(CookieAuthView):
    throttle_classes = [RefreshThrottle]

    @extend_schema(tags=["auth"], request=None, responses={200: AuthResponseSerializer})
    def post(self, request: Request) -> Response:
        raw = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME)
        try:
            issued = services.refresh_session(raw, request)
        except ServiceError as exc:
            if exc.error_code == "SESSION_EXPIRED":
                response = Response(
                    {
                        "error": {
                            "code": "SESSION_EXPIRED",
                            "message": "Your session has ended. Please sign in again.",
                        }
                    },
                    status=status.HTTP_401_UNAUTHORIZED,
                )
                _clear_refresh_cookie(response)
                return response
            raise
        return _auth_response(issued)


class LogoutView(CookieAuthView):
    @extend_schema(tags=["auth"], request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        services.logout(request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME), request)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class LogoutAllView(APIView):
    @extend_schema(tags=["auth"], request=None, responses={204: None})
    def post(self, request: Request) -> Response:
        count = services.revoke_all_sessions(request.user, reason="logout_all")
        record_event(AuditEvent.LOGOUT_ALL, request=request, metadata={"sessions": count})
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class ForgotPasswordView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=EmailSerializer, responses={202: dict})
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_password_reset(serializer.validated_data["email"], request)
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class ResetPasswordView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=ResetPasswordSerializer, responses={200: dict})
    def post(self, request: Request) -> Response:
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reset_password(
            serializer.validated_data["token"], serializer.validated_data["password"], request
        )
        return Response({"detail": "Your password has been reset. Please sign in."})


class ChangePasswordView(APIView):
    @extend_schema(tags=["auth"], request=ChangePasswordSerializer, responses={200: dict})
    def post(self, request: Request) -> Response:
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.change_password(
            request.user,
            current_password=serializer.validated_data["current_password"],
            new_password=serializer.validated_data["new_password"],
            session=request.auth,
            request=request,
        )
        return Response({"detail": "Your password has been changed."})


class DeactivateAccountView(APIView):
    @extend_schema(tags=["auth"], request=PasswordConfirmSerializer, responses={204: None})
    def post(self, request: Request) -> Response:
        serializer = PasswordConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.deactivate_account(
            request.user, password=serializer.validated_data["password"], request=request
        )
        response = Response(status=status.HTTP_204_NO_CONTENT)
        _clear_refresh_cookie(response)
        return response


class ReactivationRequestView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=EmailSerializer, responses={202: dict})
    def post(self, request: Request) -> Response:
        serializer = EmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.request_reactivation(serializer.validated_data["email"])
        return Response(ACCEPTED, status=status.HTTP_202_ACCEPTED)


class ReactivationConfirmView(PublicAuthView):
    throttle_classes = [EmailActionThrottle]

    @extend_schema(tags=["auth"], request=TokenSerializer, responses={200: dict})
    def post(self, request: Request) -> Response:
        serializer = TokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reactivate_account(serializer.validated_data["token"], request)
        return Response({"detail": "Your account has been reactivated. You can now sign in."})


class MeView(generics.RetrieveUpdateAPIView):
    http_method_names = ["get", "patch", "options"]

    def get_object(self):  # type: ignore[no-untyped-def]
        return self.request.user

    def get_serializer_class(self):  # type: ignore[no-untyped-def]
        return UserUpdateSerializer if self.request.method == "PATCH" else UserSerializer

    @extend_schema(tags=["auth"], request=UserUpdateSerializer, responses={200: UserSerializer})
    def patch(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        super().partial_update(request, *args, **kwargs)
        return Response(UserSerializer(request.user).data)

    @extend_schema(tags=["auth"], responses={200: UserSerializer})
    def get(self, request: Request, *args, **kwargs) -> Response:  # type: ignore[no-untyped-def]
        return Response(UserSerializer(request.user).data)


class SessionListView(generics.ListAPIView):
    serializer_class = SessionSerializer
    pagination_class = None
    filter_backends: list = []

    def get_queryset(self):  # type: ignore[no-untyped-def]
        return AuthSession.objects.filter(
            user=self.request.user, revoked_at__isnull=True, expires_at__gt=timezone.now()
        ).order_by("-last_used_at")

    def get_serializer_context(self):  # type: ignore[no-untyped-def]
        context = super().get_serializer_context()
        context["current_session_id"] = getattr(self.request.auth, "id", None)
        return context


class SessionRevokeView(APIView):
    @extend_schema(tags=["auth"], request=None, responses={204: None})
    def delete(self, request: Request, pk: str) -> Response:
        session = generics.get_object_or_404(
            AuthSession, id=pk, user=request.user, revoked_at__isnull=True
        )
        session.revoke("user_revoked")
        record_event(AuditEvent.SESSION_REVOKED, request=request, target=session)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SecurityActivityView(generics.ListAPIView):
    """The signed-in user's own account-security events."""

    serializer_class = AuditLogSerializer
    filter_backends: list = []

    def get_queryset(self):  # type: ignore[no-untyped-def]
        user = self.request.user
        return (
            AuditLog.objects.filter(Q(actor=user) | Q(subject_user=user))
            .filter(event_type__in=[str(e) for e in SECURITY_EVENTS])
            .order_by("-created_at")
        )
