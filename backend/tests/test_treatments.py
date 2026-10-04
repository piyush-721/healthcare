import pytest


@pytest.fixture
def plan(alice_client):
    response = alice_client.post(
        "/api/v1/treatment-plans/",
        {
            "title": "Post-consultation follow-up",
            "start_date": "2026-10-04",
            "next_review_date": "2026-10-14",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_tasks_and_progress(alice_client, plan):
    url = f"/api/v1/treatment-plans/{plan['id']}"
    ids = [
        alice_client.post(f"{url}/tasks/", {"title": t, "kind": k}).json()["id"]
        for t, k in [
            ("Blood test", "TEST"),
            ("Upload report", "UPLOAD"),
            ("Follow-up consultation", "FOLLOW_UP"),
        ]
    ]
    for task_id in ids[:2]:
        response = alice_client.patch(f"{url}/tasks/{task_id}/", {"status": "DONE"})
        assert response.json()["completed_at"]
    detail = alice_client.get(f"{url}/").json()
    assert detail["progress"] == {"total": 3, "done": 2, "percent": 67}
    assert [t["position"] for t in detail["tasks"]] == [0, 1, 2]
    reopened = alice_client.patch(f"{url}/tasks/{ids[0]}/", {"status": "PENDING"}).json()
    assert reopened["completed_at"] is None
    assert alice_client.delete(f"{url}/tasks/{ids[2]}/").status_code == 204


def test_review_date_validation(alice_client):
    response = alice_client.post(
        "/api/v1/treatment-plans/",
        {"title": "X", "start_date": "2026-10-10", "next_review_date": "2026-10-01"},
    )
    assert response.status_code == 400


def test_task_of_other_plan_not_reachable(alice_client, bob_client, plan):
    task = alice_client.post(f"/api/v1/treatment-plans/{plan['id']}/tasks/", {"title": "A"}).json()
    other = bob_client.post(
        "/api/v1/treatment-plans/", {"title": "B", "start_date": "2026-10-01"}
    ).json()
    response = bob_client.patch(
        f"/api/v1/treatment-plans/{other['id']}/tasks/{task['id']}/", {"status": "DONE"}
    )
    assert response.status_code == 404


def test_task_cannot_link_foreign_appointment(alice_client, bob_client, plan):
    appt = bob_client.post(
        "/api/v1/appointments/",
        {"title": "Bob", "scheduled_at": "2030-01-01T10:00:00Z"},
        format="json",
    ).json()
    response = alice_client.post(
        f"/api/v1/treatment-plans/{plan['id']}/tasks/", {"title": "Link", "appointment": appt["id"]}
    )
    assert response.status_code == 400
