.DEFAULT_GOAL := help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-9s %s\n", $$1, $$2}'

up: ## Build and run in Docker, then open http://localhost:8420
	docker compose up --build --wait

down: ## Stop the container (add -v yourself to drop the database)
	docker compose down

install: ## Install native dependencies (uv sync, npm ci)
	cd api && uv sync
	cd web && npm ci

dev: ## Run the API (8420, reload) and Vite (5180, proxied) natively
	(cd api && uv run uvicorn app.main:app --reload --port 8420) & (cd web && npm run dev); wait

test: ## Run both test suites
	cd api && uv run pytest -q
	cd web && npm test

check: ## Lint, types and tests, the same as CI
	cd api && uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest -q
	cd web && npm run check

e2e: ## Playwright against a stack running on 8420
	cd web && npx playwright install chromium && npm run e2e

.PHONY: help up down install dev test check e2e
