import pytest

from apps.labs.models import LabResult


@pytest.fixture
def make_report(alice_client):
    def _make(date, value, title="CBC"):
        response = alice_client.post(
            "/api/v1/lab-reports/",
            {
                "title": title,
                "report_date": date,
                "lab_name": "City Lab",
                "results": [
                    {
                        "test_name": "Hemoglobin",
                        "value": value,
                        "unit": "g/dL",
                        "reference_low": "12.0",
                        "reference_high": "16.0",
                    },
                    {"test_name": "HIV", "value_text": "Negative"},
                ],
            },
            format="json",
        )
        assert response.status_code == 201, response.content
        return response.json()

    return _make


def test_report_with_results_and_range_position(make_report):
    report = make_report("2026-09-01", "11.0")
    hb = next(r for r in report["results"] if r["test_name"] == "Hemoglobin")
    assert hb["range_position"] == "BELOW"
    assert hb["test_key"] == "hemoglobin"
    assert hb["source"] == "MANUAL"
    hiv = next(r for r in report["results"] if r["test_name"] == "HIV")
    assert hiv["range_position"] is None


def test_result_requires_value(alice_client):
    response = alice_client.post(
        "/api/v1/lab-reports/",
        {"title": "X", "report_date": "2026-09-01", "results": [{"test_name": "A"}]},
        format="json",
    )
    assert response.status_code == 400


def test_reference_range_ordering_validated(alice_client):
    response = alice_client.post(
        "/api/v1/lab-reports/",
        {
            "title": "X",
            "report_date": "2026-09-01",
            "results": [
                {"test_name": "A", "value": "1", "reference_low": "5", "reference_high": "2"}
            ],
        },
        format="json",
    )
    assert response.status_code == 400


def test_trends_sorted_by_date(alice_client, make_report):
    make_report("2026-09-10", "13.5")
    make_report("2026-08-01", "12.4")
    data = alice_client.get("/api/v1/lab-reports/trends/?test=Hemoglobin").json()
    assert [p["value"] for p in data["points"]] == ["12.4000", "13.5000"]
    tests = alice_client.get("/api/v1/lab-reports/tests/").json()
    assert tests[0]["test_key"] == "hemoglobin" and tests[0]["count"] == 2


def test_update_replaces_results(alice_client, make_report):
    report = make_report("2026-09-10", "13.5")
    alice_client.patch(
        f"/api/v1/lab-reports/{report['id']}/",
        {"results": [{"test_name": "Glucose", "value": "90", "unit": "mg/dL"}]},
        format="json",
    )
    assert list(LabResult.objects.values_list("test_name", flat=True)) == ["Glucose"]


def test_trends_require_test_param(alice_client):
    assert alice_client.get("/api/v1/lab-reports/trends/").status_code == 400


def test_other_user_trends_isolated(alice, bob_client, make_report):
    make_report("2026-09-10", "13.5")
    profile = alice.owned_profiles.get(is_self=True)
    response = bob_client.get(f"/api/v1/lab-reports/trends/?test=hemoglobin&profile={profile.id}")
    assert response.status_code == 404
