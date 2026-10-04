"""Vercel build step for the Django service (see ``[tool.vercel.scripts]`` in pyproject.toml).

Runs after dependencies are installed, with the project's environment variables:

1. ``manage.py check --deploy`` — fail the build on insecure production settings.
2. ``migrate`` — apply migrations (set ``SKIP_MIGRATIONS=1`` to skip, e.g. for
   preview deployments sharing the production database).
3. ``createcachetable`` — when the Postgres-backed cache is in use.
4. ``seed_demo`` — only when ``HEALTHOS_SEED_DEMO=1`` (idempotent).
"""

from __future__ import annotations

import os
import subprocess
import sys


def manage(*args: str) -> None:
    print(f"$ python manage.py {' '.join(args)}", flush=True)
    subprocess.run([sys.executable, "manage.py", *args], check=True)  # noqa: S603 - fixed args


def main() -> None:
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.vercel")
    manage("check", "--deploy", "--fail-level", "ERROR")
    if os.environ.get("SKIP_MIGRATIONS") == "1":
        print("SKIP_MIGRATIONS=1 — not migrating.", flush=True)
    else:
        manage("migrate", "--noinput")
        if not os.environ.get("REDIS_URL"):
            manage("createcachetable")
    if os.environ.get("HEALTHOS_SEED_DEMO") == "1":
        manage("seed_demo")


if __name__ == "__main__":
    main()
