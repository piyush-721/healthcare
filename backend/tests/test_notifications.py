from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.core import mail
from django.utils import timezone

from apps.appointments.models import Appointment
from apps.medications.models import Medication, MedicationLog, MedicationSchedule
from apps.notifications.models import Notification, NotificationCategory, NotificationPreference
from apps.notifications.services import notify
from apps.notifications.tasks import (
    dispatch_appointment_reminders,
    dispatch_medication_reminders,
    dispatch_share_expiry_notices,
    send_email,
)
from apps.profiles.access import Perm

from .conftest import grant_caregiver, self_profile


class TestNotifyService:
    def test_creates_in_app_and_privacy_safe_email(self, alice, django_capture_on_commit_callbacks):
        with django_capture_on_commit_callbacks(execute=True):
            notify(
                alice,
                category=NotificationCategory.APPOINTMENT_REMINDER,
                title="Upcoming appointment",
                body="Cardiology at 10:00",
                link="/appointments",
            )
        assert Notification.objects.filter(user=alice, show_in_app=True).count() == 1
        assert len(mail.outbox) == 1
        assert "Cardiology" not in mail.outbox[0].body

    def test_respects_preferences(self, alice, django_capture_on_commit_callbacks):
        NotificationPreference.objects.create(
            user=alice,
            category=NotificationCategory.MEDICATION_REMINDER,
            email_enabled=False,
            in_app_enabled=False,
        )
        with django_capture_on_commit_callbacks(execute=True):
            n = notify(alice, category=NotificationCategory.MEDICATION_REMINDER, title="Med")
        assert n is not None and n.show_in_app is False
        assert mail.outbox == []

    def test_security_always_in_app(self, alice):
        NotificationPreference.objects.create(
            user=alice, category="SECURITY", email_enabled=False, in_app_enabled=False
        )
        assert notify(alice, category="SECURITY", title="x").show_in_app

    def test_dedupe_key_prevents_duplicates(self, alice):
        assert notify(alice, category="SHARING", title="x", dedupe_key="k1")
        assert notify(alice, category="SHARING", title="x", dedupe_key="k1") is None

    def test_inactive_user_not_notified(self, alice):
        alice.status = "SUSPENDED"
        alice.save()
        assert notify(alice, category="SHARING", title="x") is None


class TestNotificationApi:
    def test_list_read_and_counts(self, alice_client, alice, bob):
        for i in range(3):
            notify(alice, category="SHARING", title=f"n{i}")
        notify(bob, category="SHARING", title="bob only")
        assert alice_client.get("/api/v1/notifications/unread-count/").json() == {"unread": 3}
        items = alice_client.get("/api/v1/notifications/").json()["results"]
        assert len(items) == 3
        alice_client.post(f"/api/v1/notifications/{items[0]['id']}/read/")
        assert alice_client.get("/api/v1/notifications/?unread=true").json()["count"] == 2
        alice_client.post("/api/v1/notifications/read-all/")
        assert alice_client.get("/api/v1/notifications/unread-count/").json() == {"unread": 0}

    def test_cannot_read_others_notifications(self, alice_client, bob):
        n = notify(bob, category="SHARING", title="secret")
        assert alice_client.post(f"/api/v1/notifications/{n.id}/read/").status_code == 404

    def test_preferences_round_trip(self, alice_client):
        prefs = alice_client.get("/api/v1/notifications/preferences/").json()
        med = next(p for p in prefs if p["category"] == "MEDICATION_REMINDER")
        assert med["email_enabled"] is False and med["in_app_enabled"] is True
        response = alice_client.put(
            "/api/v1/notifications/preferences/",
            [{"category": "MEDICATION_REMINDER", "email_enabled": True, "in_app_enabled": True}],
            format="json",
        )
        med = next(p for p in response.json() if p["category"] == "MEDICATION_REMINDER")
        assert med["email_enabled"] is True

    def test_security_in_app_cannot_be_disabled(self, alice_client):
        response = alice_client.put(
            "/api/v1/notifications/preferences/",
            [{"category": "SECURITY", "email_enabled": False, "in_app_enabled": False}],
            format="json",
        )
        assert response.status_code == 400


class TestReminderTasks:
    def test_medication_reminder_sent_once_to_owner_and_managing_caregiver(
        self, alice, bob, make_user
    ):
        viewer = make_user("viewer@example.com")
        grant_caregiver(alice, bob, [Perm.MANAGE_MEDICATIONS])
        grant_caregiver(alice, viewer, [Perm.VIEW_MEDICATIONS])
        tz = ZoneInfo(alice.timezone)
        due = (timezone.now() - timedelta(minutes=3)).astimezone(tz)
        med = Medication.objects.create(
            profile=self_profile(alice), name="Metformin", dosage="500 mg", start_date=due.date()
        )
        MedicationSchedule.objects.create(medication=med, time_of_day=time(due.hour, due.minute))
        assert dispatch_medication_reminders() == 2
        assert dispatch_medication_reminders() == 0  # deduplicated
        recipients = set(
            Notification.objects.filter(category="MEDICATION_REMINDER").values_list(
                "user__email", flat=True
            )
        )
        assert recipients == {"alice@example.com", "bob@example.com"}

    def test_no_reminder_if_dose_already_logged(self, alice):
        tz = ZoneInfo(alice.timezone)
        due = (
            (timezone.now() - timedelta(minutes=3)).astimezone(tz).replace(second=0, microsecond=0)
        )
        med = Medication.objects.create(
            profile=self_profile(alice), name="X", dosage="1", start_date=due.date()
        )
        schedule = MedicationSchedule.objects.create(
            medication=med, time_of_day=time(due.hour, due.minute)
        )
        MedicationLog.objects.create(
            medication=med,
            schedule=schedule,
            status="TAKEN",
            scheduled_for=datetime.combine(due.date(), schedule.time_of_day, tzinfo=tz),
        )
        assert dispatch_medication_reminders() == 0

    def test_paused_or_reminders_disabled_skipped(self, alice):
        due = timezone.now() - timedelta(minutes=3)
        for status, enabled in (("PAUSED", True), ("ACTIVE", False)):
            med = Medication.objects.create(
                profile=self_profile(alice),
                name=status,
                dosage="1",
                start_date=due.date(),
                status=status,
                reminders_enabled=enabled,
            )
            MedicationSchedule.objects.create(
                medication=med, time_of_day=time(due.hour, due.minute)
            )
        assert dispatch_medication_reminders() == 0

    def test_appointment_reminder_window(self, alice):
        profile = self_profile(alice)
        soon = Appointment.objects.create(
            profile=profile,
            title="Soon",
            scheduled_at=timezone.now() + timedelta(minutes=30),
            reminder_minutes_before=60,
        )
        Appointment.objects.create(
            profile=profile,
            title="Later",
            scheduled_at=timezone.now() + timedelta(days=3),
            reminder_minutes_before=60,
        )
        assert dispatch_appointment_reminders() == 1
        soon.refresh_from_db()
        assert soon.reminder_sent_at is not None
        assert dispatch_appointment_reminders() == 0

    def test_share_expiry_notice(self, alice_client, alice):
        from apps.sharing.models import DataShare

        share = alice_client.post(
            "/api/v1/shares/",
            {"recipient_name": "Dr", "scopes": ["PROFILE"], "duration_hours": 1},
            format="json",
        ).json()
        DataShare.objects.filter(id=share["id"]).update(expires_at=timezone.now())
        assert dispatch_share_expiry_notices() == 1
        assert dispatch_share_expiry_notices() == 0
        assert Notification.objects.filter(user=alice, title="Share expired").exists()


@pytest.mark.django_db
def test_send_email_task():
    send_email(to="x@example.com", subject="S", body="B")
    assert mail.outbox[0].subject == "S"
