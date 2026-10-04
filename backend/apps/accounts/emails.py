"""Account lifecycle emails. Bodies are plain text and contain no health information."""

from apps.notifications.email import frontend_link, queue_email

from .models import User

_SIGN_OFF = "\n\n— HealthOS\nIf you did not request this, you can ignore this email."


def send_verification_email(user: User, token: str) -> None:
    queue_email(
        to=user.email,
        subject="Verify your HealthOS email address",
        body=(
            f"Hi {user.full_name},\n\nConfirm your email address to activate your account:\n"
            f"{frontend_link('/verify-email', token=token)}\n\nThis link expires in 48 hours."
            + _SIGN_OFF
        ),
    )


def send_existing_account_email(user: User) -> None:
    queue_email(
        to=user.email,
        subject="Someone tried to sign up with your email",
        body=(
            f"Hi {user.full_name},\n\nA new HealthOS sign-up was attempted with this email, "
            "but you already have an account. You can sign in or reset your password here:\n"
            f"{frontend_link('/forgot-password')}" + _SIGN_OFF
        ),
    )


def send_password_reset_email(user: User, token: str) -> None:
    queue_email(
        to=user.email,
        subject="Reset your HealthOS password",
        body=(
            f"Hi {user.full_name},\n\nUse this link to choose a new password:\n"
            f"{frontend_link('/reset-password', token=token)}\n\nThis link expires in 1 hour."
            + _SIGN_OFF
        ),
    )


def send_reactivation_email(user: User, token: str) -> None:
    queue_email(
        to=user.email,
        subject="Reactivate your HealthOS account",
        body=(
            f"Hi {user.full_name},\n\nUse this link to reactivate your account:\n"
            f"{frontend_link('/reactivate', token=token)}\n\nThis link expires in 24 hours."
            + _SIGN_OFF
        ),
    )
