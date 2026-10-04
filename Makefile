# HealthOS developer commands. Run `make help` for a list.
BACKEND := backend
FRONTEND := frontend
PY := $(BACKEND)/.venv/bin/python

.DEFAULT_GOAL := help

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# --- Setup ------------------------------------------------------------------
install: install-backend install-frontend ## Install backend and frontend dependencies

install-backend: ## Create the Python venv and install backend deps
	cd $(BACKEND) && uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements/dev.txt

install-frontend: ## Install frontend deps
	cd $(FRONTEND) && npm ci

services: ## Start Postgres, Redis and Mailpit in Docker
	docker compose up -d postgres redis mailpit

# --- Run --------------------------------------------------------------------
migrate: ## Apply database migrations
	cd $(BACKEND) && .venv/bin/python manage.py migrate

seed: ## Load demo data (demo@healthos.local / Demo-Password-2026)
	cd $(BACKEND) && .venv/bin/python manage.py seed_demo

backend: ## Run the Django dev server on :8000
	cd $(BACKEND) && .venv/bin/python manage.py runserver 0.0.0.0:8000

worker: ## Run the Celery worker with the beat scheduler
	cd $(BACKEND) && .venv/bin/celery -A config worker --beat --schedule /tmp/healthos-celerybeat-schedule --loglevel=INFO

frontend: ## Run the Next.js dev server on :3000
	cd $(FRONTEND) && npm run dev

up: ## Run the whole stack in Docker
	docker compose up --build

down: ## Stop the Docker stack
	docker compose down

# --- Quality ----------------------------------------------------------------
test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests with coverage
	cd $(BACKEND) && .venv/bin/pytest --cov --cov-report=term-missing:skip-covered

test-frontend: ## Run frontend unit/component tests
	cd $(FRONTEND) && npm test

test-e2e: ## Run Playwright end-to-end tests (needs the stack running)
	cd $(FRONTEND) && npm run test:e2e

lint: ## Lint and format-check everything
	cd $(BACKEND) && .venv/bin/ruff check . && .venv/bin/black --check .
	cd $(FRONTEND) && npm run lint && npm run typecheck && npm run format:check

format: ## Auto-format everything
	cd $(BACKEND) && .venv/bin/ruff check --fix . && .venv/bin/black .
	cd $(FRONTEND) && npm run format

schema: ## Regenerate OpenAPI schema and frontend API types
	cd $(BACKEND) && .venv/bin/python manage.py spectacular --file ../docs/api/openapi.yaml
	cd $(FRONTEND) && npm run gen:api

check: lint test ## Everything CI runs

.PHONY: help install install-backend install-frontend services migrate seed backend worker frontend up down test test-backend test-frontend test-e2e lint format schema check
