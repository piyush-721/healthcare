def test_health_endpoint_reports_components_without_details(api, db):
    response = api.get("/api/v1/health/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "checks": {"database": "ok", "cache": "ok"}}
    assert "X-Request-ID" in response


def test_request_id_is_propagated_when_well_formed(api, db):
    response = api.get("/api/v1/health/", HTTP_X_REQUEST_ID="abcdef12-3456")
    assert response["X-Request-ID"] == "abcdef12-3456"


def test_malformed_request_id_is_replaced(api, db):
    response = api.get("/api/v1/health/", HTTP_X_REQUEST_ID="bad id <script>")
    assert response["X-Request-ID"] != "bad id <script>"


def test_errors_use_consistent_envelope(api, db):
    response = api.get("/api/v1/medications/")
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "NOT_AUTHENTICATED", "message": "Authentication is required."}
    }


def test_security_headers_present(api, db):
    response = api.get("/api/v1/health/")
    assert response["X-Content-Type-Options"] == "nosniff"
    assert response["X-Frame-Options"] == "DENY"
    assert response["Cache-Control"] == "no-store"
    assert "frame-ancestors 'none'" in response["Content-Security-Policy"]


def test_openapi_schema_is_served(api, db):
    response = api.get("/api/v1/schema/")
    assert response.status_code == 200
