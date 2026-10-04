"""Asynchronous notification work: email delivery and scheduled reminders."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from celery import shared_task
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import NotificationCategory
from .services import notify

logger = logging.getLogger(__name__)

REMINDER_LOOKBACK = timedelta(minutes=15)


# Backoff is capped low: on Vercel Queues a pending retry keeps the function invocation open.
@shared_task(
    bind=True, autoretry_for=(OSError,), retry_backoff=True, retry_backoff_max=30, max_retries=5
)
def send_email(self, *, to: str, subject: str, body: str) -> None:  # type: ignore[no-untyped-def]
    send_mail(subject=subject, message=body, from_email=None, recipient_list=[to])
    logger.info("email sent", extra={"task_id": self.request.id})


def _recipients(profile, manage_perm: str):  # type: ignore[no-untyped-def]
    """Profile owner plus active caregivers holding ``manage_perm``."""
    from apps.family.models import CaregiverAccess
    from apps.profiles.access import active_grant_q

    users = {profile.owner_id: profile.owner}
    grants = CaregiverAccess.objects.filter(
        active_grant_q(), profile=profile, permissions__contains=[manage_perm]
    ).select_related("caregiver")
    for grant in grants:
        users[grant.caregiver_id] = grant.caregiver
    return [u for u in users.values() if u.is_active]


@shared_task
def dispatch_medication_reminders() -> int:
    """Remind about scheduled doses that came due in the last few minutes and aren't logged."""
    from apps.medications.models import Medication, MedicationLog, MedicationSchedule
    from apps.profiles.access import Perm

    now = timezone.now()
    sent = 0
    schedules = MedicationSchedule.objects.filter(
        medication__status=Medication.Status.ACTIVE,
        medication__reminders_enabled=True,
    ).select_related("medication__profile__owner")
    for schedule in schedules:
        medication = schedule.medication
        tz = ZoneInfo(medication.profile.owner.timezone)
        local_now = now.astimezone(tz)
        for day in {local_now.date(), (local_now - REMINDER_LOOKBACK).date()}:
            if not medication.is_scheduled_on(day) or not schedule.applies_on(day):
                continue
            due = datetime.combine(day, schedule.time_of_day, tzinfo=tz)
            if not (now - REMINDER_LOOKBACK <= due <= now):
                continue
            if MedicationLog.objects.filter(schedule=schedule, scheduled_for=due).exists():
                continue
            for user in _recipients(medication.profile, Perm.MANAGE_MEDICATIONS):
                created = notify(
                    user,
                    category=NotificationCategory.MEDICATION_REMINDER,
                    title="Medication reminder",
                    body=(
                        f"{medication.name} {medication.dosage} for "
                        f"{medication.profile.full_name} is scheduled at "
                        f"{schedule.time_of_day:%H:%M}."
                    ),
                    link=f"/medications/{medication.id}?profile={medication.profile_id}",
                    dedupe_key=f"med:{schedule.id}:{due.isoformat()}:{user.id}",
                )
                sent += created is not None
    logger.info("medication reminders dispatched", extra={"count": sent})
    return sent


@shared_task
def dispatch_appointment_reminders() -> int:
    from apps.appointments.models import Appointment
    from apps.profiles.access import Perm

    now = timezone.now()
    sent = 0
    candidates = Appointment.objects.filter(
        status=Appointment.Status.SCHEDULED,
        reminder_minutes_before__isnull=False,
        reminder_sent_at__isnull=True,
        scheduled_at__gt=now,
        scheduled_at__lte=now + timedelta(days=8),
    ).select_related("profile__owner")
    for appointment in candidates:
        if appointment.scheduled_at - timedelta(minutes=appointment.reminder_minutes_before) > now:
            continue
        with transaction.atomic():
            locked = (
                Appointment.objects.select_for_update(skip_locked=True)
                .filter(id=appointment.id, reminder_sent_at__isnull=True)
                .first()
            )
            if locked is None:
                continue
            for user in _recipients(appointment.profile, Perm.MANAGE_APPOINTMENTS):
                local = appointment.scheduled_at.astimezone(ZoneInfo(user.timezone))
                created = notify(
                    user,
                    category=NotificationCategory.APPOINTMENT_REMINDER,
                    title="Upcoming appointment",
                    body=(
                        f"{appointment.title} for {appointment.profile.full_name} on "
                        f"{local:%a %d %b at %H:%M}."
                    ),
                    link=f"/appointments/{appointment.id}?profile={appointment.profile_id}",
                    dedupe_key=f"appt:{appointment.id}:{user.id}",
                )
                sent += created is not None
            locked.reminder_sent_at = now
            locked.save(update_fields=["reminder_sent_at", "updated_at"])
    logger.info("appointment reminders dispatched", extra={"count": sent})
    return sent


@shared_task
def dispatch_share_expiry_notices() -> int:
    """Tell owners when a provider share has expired."""
    from apps.sharing.models import DataShare

    now = timezone.now()
    sent = 0
    expired = DataShare.objects.filter(
        expires_at__lte=now, revoked_at__isnull=True, expiry_notified_at__isnull=True
    ).select_related("created_by", "profile")
    for share in expired:
        notify(
            share.created_by,
            category=NotificationCategory.SHARING,
            title="Share expired",
            body=f"Access for {share.recipient_name} to {share.profile.full_name}'s "
            "information has expired.",
            link=f"/sharing/{share.id}",
            dedupe_key=f"share-expired:{share.id}",
        )
        DataShare.objects.filter(id=share.id).update(expiry_notified_at=now)
        sent += 1
    return sent
