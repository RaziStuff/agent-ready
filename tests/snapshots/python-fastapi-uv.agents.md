# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
FastAPI service for support ticket triage and account lookup.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `alembic/`: database migrations.
- `app/`: application routes or app source.
- `tests/`: tests.
- `app/main.py`: Python application entrypoint.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager: uv.
- Install dependencies with `uv sync`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Install: `uv sync`.
- Lint: `ruff check .`.
- Test: `python -m pytest`.
- Typecheck: `mypy .`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `python -m pytest`.
- Lint: `ruff check .`.
- Typecheck: `mypy .`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be Python.
- Detected frameworks: FastAPI.
- Read local docs before large changes: `README.md`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
- `alembic/versions`: database migrations can affect persisted data.
<!-- agent-ready:end risks -->

## Environment

<!-- agent-ready:start environment -->
- Environment examples: `.env.sample`.
- No secret-like env files were detected by path.
<!-- agent-ready:end environment -->

## Agent Workflow

1. Read this file before editing.
2. Inspect nearby code and tests before changing behavior.
3. Prefer the smallest relevant validation command while iterating.
4. Do not read secret-like files unless the user explicitly provides them.
5. Summarize changed files, validation, and remaining risks in the final handoff.

## Generated Metadata

<!-- agent-ready:start metadata -->
- Generated at: 2026-01-01T00:00:00.000Z.
- Structured repo map: `.agents/repo-map.json`.
- Command catalog: `.agents/commands.json`.
- Workspace catalog: `.agents/workspaces.json`.
- Risk policy: `.agents/risk-policy.md`.
- Handoff template: `.agents/handoff-template.md`.
<!-- agent-ready:end metadata -->
