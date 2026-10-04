"""Notification fan-out: in-app feed plus optional, privacy-preserving email."""

from __future__ import annotations

import logging

from django.db import IntegrityError, transaction

from apps.accounts.models import User

from .email import frontend_link, queue_email
from .models import (
    DEFAULT_PREFERENCES,
    MANDATORY_IN_APP,
    Notification,
    NotificationCategory,
    NotificationPreference,
)

logger = logging.getLogger(__name__)


def channel_preferences(user: User, category: str) -> tuple[bool, bool]:
    pref = NotificationPreference.objects.filter(user=user, category=category).first()
    email, in_app = (
        (pref.email_enabled, pref.in_app_enabled)
        if pref
        else DEFAULT_PREFERENCES[NotificationCategory(category)]
    )
    if category in MANDATORY_IN_APP:
        in_app = True
    return email, in_app


def notify(
    user: User,
    *,
    category: str,
    title: str,
    body: str = "",
    link: str = "",
    dedupe_key: str | None = None,
) -> Notification | None:
    """Create a notification for ``user``.

    ``title`` must not contain clinical details: it is reused as the email
    subject. Emails only say that something needs attention and link to the
    app, so health information never travels over email.

    Returns ``None`` if a notification with the same ``dedupe_key`` already exists.
    """
    if not user.is_active:
        return None
    email_enabled, in_app_enabled = channel_preferences(user, category)
    try:
        with transaction.atomic():
            notification = Notification.objects.create(
                user=user,
                category=category,
                title=title[:150],
                body=body[:500],
                link=link,
                show_in_app=in_app_enabled,
                dedupe_key=dedupe_key,
            )
    except IntegrityError:
        return None
    if email_enabled and user.is_email_verified:
        queue_email(
            to=user.email,
            subject=f"HealthOS: {title}",
            body=(
                f"Hi {user.full_name},\n\nYou have a new HealthOS notification: {title}.\n\n"
                f"Open HealthOS to see the details:\n{frontend_link(link or '/notifications')}"
                "\n\nYou can change email preferences in Settings → Notifications.\n\n— HealthOS"
            ),
        )
        Notification.objects.filter(id=notification.id).update(emailed_at=notification.created_at)
    return notification
