"""Vercel hosting support: cron endpoint, proxy-aware client IPs, Blob storage, settings."""

import io
import json
import os
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from types import SimpleNamespace

import pytest
from django.test import RequestFactory, override_settings

from apps.common import storage_vercel
from apps.common.security import client_ip

BACKEND = Path(__file__).resolve().parent.parent


class TestCronEndpoint:
    URL = "/api/v1/internal/cron/appointment-reminders/"

    def test_disabled_without_secret(self, api, db):
        with override_settings(CRON_SECRET=""):
            assert api.get(self.URL, HTTP_AUTHORIZATION="Bearer ").status_code == 404

    @override_settings(CRON_SECRET="s3cret-cron-value-123")
    def test_rejects_wrong_or_missing_secret(self, api, db):
        assert api.get(self.URL).status_code == 401
        assert api.get(self.URL, HTTP_AUTHORIZATION="Bearer nope").status_code == 401

    @override_settings(CRON_SECRET="s3cret-cron-value-123")
    def test_unknown_job_is_404(self, api, db):
        response = api.get(
            "/api/v1/internal/cron/drop-tables/", HTTP_AUTHORIZATION="Bearer s3cret-cron-value-123"
        )
        assert response.status_code == 404

    @override_settings(CRON_SECRET="s3cret-cron-value-123")
    def test_enqueues_job(self, api, alice):
        from datetime import timedelta

        from django.utils import timezone

        from apps.appointments.models import Appointment
        from apps.notifications.models import Notification

        Appointment.objects.create(
            profile=alice.owned_profiles.get(is_self=True),
            title="Soon",
            scheduled_at=timezone.now() + timedelta(minutes=20),
            reminder_minutes_before=60,
        )
        response = api.get(self.URL, HTTP_AUTHORIZATION="Bearer s3cret-cron-value-123")
        assert response.status_code == 202
        assert response.json()["job"] == "appointment-reminders"
        # Tests run Celery eagerly, so the enqueued task has already executed.
        assert Notification.objects.filter(user=alice, category="APPOINTMENT_REMINDER").exists()

    def test_crons_in_vercel_json_match_jobs(self):
        from apps.common.cron import JOBS

        config = json.loads((BACKEND.parent / "vercel.json").read_text())
        paths = {cron["path"] for cron in config["crons"]}
        assert paths == {f"/api/v1/internal/cron/{job}/" for job in JOBS}


class TestClientIp:
    factory = RequestFactory()

    def _request(self, xff=None):
        extra = {"REMOTE_ADDR": "10.0.0.1"}
        if xff:
            extra["HTTP_X_FORWARDED_FOR"] = xff
        return self.factory.get("/", **extra)

    def test_ignores_forwarded_header_without_trusted_proxies(self, settings):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 0}
        assert client_ip(self._request("1.2.3.4")) == "10.0.0.1"

    def test_uses_proxy_supplied_address(self, settings):
        settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}
        # A client-forged first entry is ignored; the proxy appends the real address.
        assert client_ip(self._request("6.6.6.6, 1.2.3.4")) == "1.2.3.4"
        assert client_ip(self._request()) == "10.0.0.1"


class FakeBlob:
    """In-memory stand-in for the ``vercel.blob`` module."""

    class BlobNotFoundError(Exception):
        pass

    def __init__(self):
        self.objects: dict[str, bytes] = {}
        self.calls: list[tuple] = []

    def put(self, path, body, *, access, add_random_suffix, overwrite):
        self.calls.append(("put", path, access, add_random_suffix))
        self.objects[path] = body
        return SimpleNamespace(url=f"https://store.private.blob/{path}", pathname=path)

    def get(self, path, *, access, use_cache):
        self.calls.append(("get", path, access))
        if path not in self.objects:
            raise self.BlobNotFoundError(path)
        return SimpleNamespace(content=self.objects[path])

    def head(self, path):
        if path not in self.objects:
            raise self.BlobNotFoundError(path)
        return SimpleNamespace(url=f"https://store.private.blob/{path}")

    def delete(self, url):
        self.objects.pop(url.removeprefix("https://store.private.blob/"), None)


class TestVercelBlobStorage:
    @pytest.fixture
    def fake(self, monkeypatch):
        fake = FakeBlob()
        monkeypatch.setattr(storage_vercel, "blob", fake)
        return fake

    def test_round_trip_is_private(self, fake):
        storage = storage_vercel.VercelBlobPrivateStorage()
        key = storage.save(io.BytesIO(b"%PDF-1.4 data"), extension=".pdf")
        assert re.fullmatch(r"[0-9a-f]{2}/[0-9a-f]{32}\.pdf", key)
        assert storage.exists(key)
        assert storage.open(key).read() == b"%PDF-1.4 data"
        assert all(call[2] == "private" for call in fake.calls if call[0] in ("put", "get"))
        assert fake.calls[0][3] is False  # deterministic pathname, no random suffix
        storage.delete(key)
        assert not storage.exists(key)
        storage.delete(key)  # deleting twice is a no-op

    def test_missing_object_raises_file_not_found(self, fake):
        with pytest.raises(FileNotFoundError):
            storage_vercel.VercelBlobPrivateStorage().open("ab/missing.pdf")

    @pytest.mark.parametrize("key", ["../etc/passwd", "/abs.pdf", ""])
    def test_rejects_unsafe_keys(self, fake, key):
        with pytest.raises(ValueError):
            storage_vercel.VercelBlobPrivateStorage().open(key)


def test_vercel_settings_module():
    env = {
        **os.environ,
        "VERCEL": "1",
        "VERCEL_PROJECT_PRODUCTION_URL": "healthos.example.app",
        "VERCEL_URL": "healthos-abc.vercel.app",
        "DJANGO_SECRET_KEY": "x" * 60,
        "DJANGO_SETTINGS_MODULE": "config.settings.vercel",
    }
    env.pop("REDIS_URL", None)
    code = (
        "import django, json; django.setup(); from django.conf import settings as s; "
        "print(json.dumps({'debug': s.DEBUG, 'hosts': s.ALLOWED_HOSTS, "
        "'frontend': s.FRONTEND_URL, 'cache': s.CACHES['default']['BACKEND'], "
        "'broker': s.CELERY_BROKER_URL, 'storage': s.PRIVATE_STORAGE_BACKEND, "
        "'upload': s.MAX_UPLOAD_SIZE_BYTES, 'proxies': s.REST_FRAMEWORK['NUM_PROXIES'], "
        "'cookie_secure': s.AUTH_REFRESH_COOKIE_SECURE, 'beat': s.CELERY_BEAT_SCHEDULE}))"
    )
    out = subprocess.run(  # noqa: S603 - fixed interpreter and code
        [sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True,
        check=True,
    ).stdout
    config = json.loads(out.strip().splitlines()[-1])
    assert config == {
        "debug": False,
        "hosts": ["healthos.example.app", "healthos-abc.vercel.app"],
        "frontend": "https://healthos.example.app",
        "cache": "django.core.cache.backends.db.DatabaseCache",
        "broker": "vercel://",
        "storage": "apps.common.storage_vercel.VercelBlobPrivateStorage",
        "upload": 4 * 1024 * 1024,
        "proxies": 1,
        "cookie_secure": True,
        "beat": {},
    }


def test_requirements_match_pyproject_dependencies():
    declared = tomllib.loads((BACKEND / "pyproject.toml").read_text())["project"]["dependencies"]
    lines = (BACKEND / "requirements" / "base.txt").read_text().splitlines()
    required = [line.strip() for line in lines if line.strip() and not line.startswith("#")]
    assert sorted(declared) == sorted(required)
