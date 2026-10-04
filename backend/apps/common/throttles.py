from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = "auth_login"


class SignupThrottle(AnonRateThrottle):
    scope = "auth_signup"


class EmailActionThrottle(AnonRateThrottle):
    scope = "auth_email"


class RefreshThrottle(AnonRateThrottle):
    scope = "auth_refresh"


class ShareAccessThrottle(AnonRateThrottle):
    scope = "share_access"


class UploadThrottle(UserRateThrottle):
    scope = "uploads"


__all__ = [
    "EmailActionThrottle",
    "LoginThrottle",
    "RefreshThrottle",
    "ScopedRateThrottle",
    "ShareAccessThrottle",
    "SignupThrottle",
    "UploadThrottle",
]
