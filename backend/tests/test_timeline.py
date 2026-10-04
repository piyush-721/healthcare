from datetime import timedelta

import pytest
from django.utils import timezone

from apps.profiles.access import Perm

from .conftest import grant_caregiver, self_profile


@pytest.fixture
def history(alice_client):
    alice_client.post(
        "/api/v1/appointments/",
        {"title": "Doctor consultation", "scheduled_at": "2026-10-04T09:00:00Z"},
        format="json",
    )
    alice_client.post(
        "/api/v1/records/",
        {"title": "Prescription", "record_type": "PRESCRIPTION", "record_date": "2026-10-04"},
    )
    alice_client.post(
        "/api/v1/lab-reports/",
        {
            "title": "Blood report",
            "report_date": "2026-10-07",
            "results": [{"test_name": "Hb", "value": "13"}],
        },
        format="json",
    )
    alice_client.post(
        "/api/v1/medications/",
        {"name": "Metformin", "dosage": "500 mg", "start_date": "2026-10-05"},
        format="json",
    )
    alice_client.post(
        "/api/v1/appointments/",
        {"title": "Follow-up appointment", "scheduled_at": "2026-10-14T09:00:00Z"},
        format="json",
    )


def test_timeline_is_chronological_across_sources(alice_client, history):
    events = alice_client.get("/api/v1/timeline/").json()["results"]
    titles = [e["title"] for e in events]
    assert titles == [
        "Follow-up appointment",
        "Blood report",
        "Started Metformin",
        "Doctor consultation",
        "Prescription",
    ]
    assert {e["resource"] for e in events} >= {"appointment", "lab_report", "medication", "record"}


def test_type_date_and_search_filters(alice_client, history):
    only_appts = alice_client.get("/api/v1/timeline/?types=APPOINTMENT").json()["results"]
    assert {e["type"] for e in only_appts} == {"APPOINTMENT"}
    ranged = alice_client.get("/api/v1/timeline/?from=2026-10-05&to=2026-10-10").json()
    assert [e["title"] for e in ranged["results"]] == ["Blood report", "Started Metformin"]
    searched = alice_client.get("/api/v1/timeline/?q=follow").json()["results"]
    assert [e["title"] for e in searched] == ["Follow-up appointment"]


def test_cursor_pagination(alice_client, history):
    first = alice_client.get("/api/v1/timeline/?limit=2").json()
    assert len(first["results"]) == 2 and first["next_cursor"]
    second = alice_client.get(
        "/api/v1/timeline/", {"limit": 2, "cursor": first["next_cursor"]}
    ).json()
    seen = [e["id"] for e in first["results"]] + [e["id"] for e in second["results"]]
    assert len(seen) == len(set(seen)) == 4


def test_caregiver_only_sees_permitted_event_types(alice, bob, bob_client, history):
    grant_caregiver(alice, bob, [Perm.VIEW_APPOINTMENTS])
    data = bob_client.get(f"/api/v1/timeline/?profile={self_profile(alice).id}").json()
    assert {e["type"] for e in data["results"]} == {"APPOINTMENT"}
    assert data["available_types"] == ["APPOINTMENT"]


def test_stranger_gets_404(alice, bob_client, history):
    assert bob_client.get(f"/api/v1/timeline/?profile={self_profile(alice).id}").status_code == 404


def test_invalid_params(alice_client):
    assert alice_client.get("/api/v1/timeline/?from=bad").status_code == 400
    assert alice_client.get("/api/v1/timeline/?cursor=bad").status_code == 400
    assert alice_client.get("/api/v1/timeline/?from=2026-10-10&to=2026-10-01").status_code == 400


def test_dashboard_sections_follow_permissions(alice, bob, alice_client, bob_client):
    alice_client.post(
        "/api/v1/appointments/",
        {"title": "Soon", "scheduled_at": (timezone.now() + timedelta(days=1)).isoformat()},
        format="json",
    )
    own = alice_client.get("/api/v1/dashboard/").json()
    assert own["upcoming_appointments"][0]["title"] == "Soon"
    assert own["todays_doses"] == []
    grant_caregiver(alice, bob, [Perm.VIEW_APPOINTMENTS])
    shared = bob_client.get(f"/api/v1/dashboard/?profile={self_profile(alice).id}").json()
    assert shared["upcoming_appointments"][0]["title"] == "Soon"
    assert shared["todays_doses"] is None
    assert shared["pending_tasks"] is None
