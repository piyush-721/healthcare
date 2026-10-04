from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.utils import timezone

from apps.medications.models import MedicationLog

TODAY = timezone.now().date()


@pytest.fixture
def medication(alice_client):
    response = alice_client.post(
        "/api/v1/medications/",
        {
            "name": "Metformin",
            "dosage": "500 mg",
            "frequency": "TWICE_DAILY",
            "start_date": (TODAY - timedelta(days=6)).isoformat(),
            "schedules": [{"time_of_day": "08:00"}, {"time_of_day": "20:00"}],
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    return response.json()


class TestMedicationCrud:
    def test_create_with_schedules(self, medication):
        assert [s["time_of_day"] for s in medication["schedules"]] == ["08:00:00", "20:00:00"]
        assert medication["status"] == "ACTIVE"

    def test_duplicate_times_rejected(self, alice_client):
        response = alice_client.post(
            "/api/v1/medications/",
            {
                "name": "X",
                "dosage": "1",
                "start_date": TODAY.isoformat(),
                "schedules": [{"time_of_day": "08:00"}, {"time_of_day": "08:00"}],
            },
            format="json",
        )
        assert response.status_code == 400

    def test_end_before_start_rejected(self, alice_client):
        response = alice_client.post(
            "/api/v1/medications/",
            {
                "name": "X",
                "dosage": "1",
                "start_date": "2026-10-10",
                "end_date": "2026-10-01",
            },
            format="json",
        )
        assert response.status_code == 400
        assert "end_date" in response.json()["error"]["fields"]

    def test_update_replaces_schedules(self, alice_client, medication):
        response = alice_client.patch(
            f"/api/v1/medications/{medication['id']}/",
            {"schedules": [{"time_of_day": "09:30"}]},
            format="json",
        )
        assert [s["time_of_day"] for s in response.json()["schedules"]] == ["09:30:00"]

    def test_status_cannot_be_mass_assigned(self, alice_client, medication):
        alice_client.patch(
            f"/api/v1/medications/{medication['id']}/", {"status": "STOPPED"}, format="json"
        )
        detail = alice_client.get(f"/api/v1/medications/{medication['id']}/").json()
        assert detail["status"] == "ACTIVE"

    def test_pause_and_resume(self, alice_client, medication):
        url = f"/api/v1/medications/{medication['id']}"
        paused = alice_client.post(f"{url}/pause/").json()
        assert paused["status"] == "PAUSED" and paused["paused_at"]
        assert alice_client.post(f"{url}/pause/").status_code == 400
        assert alice_client.post(f"{url}/resume/").json()["status"] == "ACTIVE"


class TestDoses:
    def test_today_lists_doses_and_logging_updates_status(self, alice_client, medication):
        today = alice_client.get("/api/v1/medications/today/").json()
        assert len(today["doses"]) == 2
        dose = today["doses"][0]
        response = alice_client.post(
            f"/api/v1/medications/{medication['id']}/log/",
            {
                "schedule": dose["schedule_id"],
                "scheduled_for": dose["scheduled_for"],
                "status": "TAKEN",
            },
            format="json",
        )
        assert response.status_code == 201
        today = alice_client.get("/api/v1/medications/today/").json()
        assert today["doses"][0]["status"] == "TAKEN"

    def test_relogging_same_dose_updates_not_duplicates(self, alice_client, medication):
        dose = alice_client.get("/api/v1/medications/today/").json()["doses"][0]
        url = f"/api/v1/medications/{medication['id']}/log/"
        for status in ("TAKEN", "SKIPPED"):
            alice_client.post(
                url,
                {
                    "schedule": dose["schedule_id"],
                    "scheduled_for": dose["scheduled_for"],
                    "status": status,
                },
                format="json",
            )
        assert MedicationLog.objects.count() == 1
        assert MedicationLog.objects.get().status == "SKIPPED"

    def test_paused_medication_has_no_doses(self, alice_client, medication):
        alice_client.post(f"/api/v1/medications/{medication['id']}/pause/")
        assert alice_client.get("/api/v1/medications/today/").json()["doses"] == []

    def test_as_needed_dose_logging(self, alice_client):
        med = alice_client.post(
            "/api/v1/medications/",
            {
                "name": "Paracetamol",
                "dosage": "500 mg",
                "frequency": "AS_NEEDED",
                "start_date": TODAY.isoformat(),
            },
            format="json",
        ).json()
        response = alice_client.post(
            f"/api/v1/medications/{med['id']}/log/", {"status": "TAKEN"}, format="json"
        )
        assert response.status_code == 201
        logs = alice_client.get(f"/api/v1/medications/{med['id']}/logs/").json()
        assert logs["count"] == 1

    def test_future_dose_log_rejected(self, alice_client, medication):
        response = alice_client.post(
            f"/api/v1/medications/{medication['id']}/log/",
            {
                "status": "TAKEN",
                "taken_at": (timezone.now() + timedelta(hours=2)).isoformat(),
            },
            format="json",
        )
        assert response.status_code == 400

    def test_foreign_schedule_rejected(self, alice_client, medication):
        other = alice_client.post(
            "/api/v1/medications/",
            {
                "name": "Other",
                "dosage": "1",
                "start_date": TODAY.isoformat(),
                "schedules": [{"time_of_day": "10:00"}],
            },
            format="json",
        ).json()
        response = alice_client.post(
            f"/api/v1/medications/{medication['id']}/log/",
            {
                "schedule": other["schedules"][0]["id"],
                "scheduled_for": timezone.now().isoformat(),
                "status": "TAKEN",
            },
            format="json",
        )
        assert response.status_code == 400


class TestAdherence:
    def test_adherence_counts_taken_and_missed(self, alice_client, alice, medication):
        from apps.medications.models import Medication

        med = Medication.objects.get(id=medication["id"])
        schedule = med.schedules.get(time_of_day=time(8, 0))
        tz = ZoneInfo(alice.timezone)
        yesterday = TODAY - timedelta(days=1)
        MedicationLog.objects.create(
            medication=med,
            schedule=schedule,
            status="TAKEN",
            scheduled_for=datetime.combine(yesterday, time(8, 0), tzinfo=tz),
        )
        data = alice_client.get(f"/api/v1/medications/{med.id}/adherence/?days=2").json()
        assert data["days"] == 2
        yesterday_row = next(r for r in data["history"] if r["date"] == yesterday.isoformat())
        assert yesterday_row == {
            "date": yesterday.isoformat(),
            "scheduled": 2,
            "taken": 1,
            "skipped": 0,
            "missed": 1,
        }
        assert data["adherence_percent"] is not None

    def test_adherence_days_bounded(self, alice_client, medication):
        data = alice_client.get(f"/api/v1/medications/{medication['id']}/adherence/?days=500")
        assert data.json()["days"] == 90
        bad = alice_client.get(f"/api/v1/medications/{medication['id']}/adherence/?days=abc")
        assert bad.status_code == 400


def test_is_scheduled_on_respects_dates():
    from apps.medications.models import Medication

    med = Medication(
        start_date=date(2026, 1, 10),
        end_date=date(2026, 1, 20),
        status=Medication.Status.ACTIVE,
        frequency="ONCE_DAILY",
    )
    assert not med.is_scheduled_on(date(2026, 1, 9))
    assert med.is_scheduled_on(date(2026, 1, 15))
    assert not med.is_scheduled_on(date(2026, 1, 21))
