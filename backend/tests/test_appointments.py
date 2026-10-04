from datetime import timedelta

import pytest
from django.utils import timezone

from apps.appointments.models import Appointment


@pytest.fixture
def appointment(alice_client):
    response = alice_client.post(
        "/api/v1/appointments/",
        {
            "title": "Cardiology follow-up",
            "scheduled_at": (timezone.now() + timedelta(days=2)).isoformat(),
            "location": "City Clinic",
            "reason": "Review",
            "reminder_minutes_before": 60,
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    return response.json()


def test_upcoming_and_past_views(alice_client, alice, appointment):
    past = Appointment.objects.create(
        profile=alice.owned_profiles.get(is_self=True),
        title="Old visit",
        scheduled_at=timezone.now() - timedelta(days=3),
    )
    upcoming = alice_client.get("/api/v1/appointments/?view=upcoming").json()["results"]
    assert [a["id"] for a in upcoming] == [appointment["id"]]
    past_list = alice_client.get("/api/v1/appointments/?view=past").json()["results"]
    assert [a["id"] for a in past_list] == [str(past.id)]
    assert past_list[0]["needs_update"] is True


def test_cancel_and_restore(alice_client, appointment):
    url = f"/api/v1/appointments/{appointment['id']}/status/"
    response = alice_client.post(url, {"status": "CANCELLED", "cancellation_reason": "Sick"})
    assert response.json()["status"] == "CANCELLED"
    assert response.json()["cancellation_reason"] == "Sick"
    assert alice_client.post(url, {"status": "SCHEDULED"}).json()["status"] == "SCHEDULED"


def test_future_appointment_cannot_be_marked_completed(alice_client, appointment):
    response = alice_client.post(
        f"/api/v1/appointments/{appointment['id']}/status/", {"status": "COMPLETED"}
    )
    assert response.status_code == 400


def test_past_appointment_can_be_completed_or_missed(alice_client, alice):
    appt = Appointment.objects.create(
        profile=alice.owned_profiles.get(is_self=True),
        title="Visit",
        scheduled_at=timezone.now() - timedelta(hours=2),
    )
    for status in ("COMPLETED", "MISSED"):
        response = alice_client.post(f"/api/v1/appointments/{appt.id}/status/", {"status": status})
        assert response.json()["status"] == status


def test_follow_up_must_be_after_appointment(alice_client):
    response = alice_client.post(
        "/api/v1/appointments/",
        {
            "title": "X",
            "scheduled_at": (timezone.now() + timedelta(days=5)).isoformat(),
            "follow_up_date": timezone.now().date().isoformat(),
        },
        format="json",
    )
    assert response.status_code == 400


def test_notes_add_and_delete(alice_client, appointment):
    url = f"/api/v1/appointments/{appointment['id']}"
    note = alice_client.post(f"{url}/notes/", {"body": "Bring previous reports"}).json()
    assert note["author_name"] == "Alice Patient"
    assert len(alice_client.get(f"{url}/").json()["notes"]) == 1
    assert alice_client.delete(f"{url}/notes/{note['id']}/").status_code == 204
    assert alice_client.get(f"{url}/").json()["notes"] == []


def test_rescheduling_resets_reminder(alice_client, appointment):
    Appointment.objects.filter(id=appointment["id"]).update(reminder_sent_at=timezone.now())
    alice_client.patch(
        f"/api/v1/appointments/{appointment['id']}/",
        {"scheduled_at": (timezone.now() + timedelta(days=4)).isoformat()},
        format="json",
    )
    assert Appointment.objects.get(id=appointment["id"]).reminder_sent_at is None
