from django.urls import path

from . import views

urlpatterns = [
    path("csrf/", views.CSRFView.as_view(), name="auth-csrf"),
    path("register/", views.RegisterView.as_view(), name="auth-register"),
    path("verify-email/", views.VerifyEmailView.as_view(), name="auth-verify-email"),
    path(
        "verify-email/resend/",
        views.ResendVerificationView.as_view(),
        name="auth-verify-email-resend",
    ),
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("refresh/", views.RefreshView.as_view(), name="auth-refresh"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("logout-all/", views.LogoutAllView.as_view(), name="auth-logout-all"),
    path("password/forgot/", views.ForgotPasswordView.as_view(), name="auth-password-forgot"),
    path("password/reset/", views.ResetPasswordView.as_view(), name="auth-password-reset"),
    path("password/change/", views.ChangePasswordView.as_view(), name="auth-password-change"),
    path(
        "account/deactivate/", views.DeactivateAccountView.as_view(), name="auth-account-deactivate"
    ),
    path(
        "account/reactivate/request/",
        views.ReactivationRequestView.as_view(),
        name="auth-reactivate-request",
    ),
    path(
        "account/reactivate/confirm/",
        views.ReactivationConfirmView.as_view(),
        name="auth-reactivate-confirm",
    ),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path("sessions/", views.SessionListView.as_view(), name="auth-sessions"),
    path("sessions/<uuid:pk>/", views.SessionRevokeView.as_view(), name="auth-session-revoke"),
    path("security-activity/", views.SecurityActivityView.as_view(), name="auth-security-activity"),
]
