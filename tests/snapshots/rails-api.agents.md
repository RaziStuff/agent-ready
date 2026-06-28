# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
Rails API for billing operations and account lifecycle workflows.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `app/`: application routes or app source.
- `bin/`: developer and framework command wrappers.
- `config/`: configuration.
- `db/`: database schema and migrations.
- `spec/`: tests.
- `config/application.rb`: Rails application config.
- `bin/rails`: Rails command entrypoint.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager: bundler.
- Install dependencies with `bundle install`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Install: `bundle install`.
- Lint: `bundle exec rubocop`.
- Test: `bundle exec rspec`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `bundle exec rspec`.
- Lint: `bundle exec rubocop`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be Ruby.
- Detected frameworks: Rails.
- Read local docs before large changes: `README.md`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
- `db/migrate`: database migrations can affect persisted data.
- `Gemfile.lock`: lockfiles should change only when dependencies change.
<!-- agent-ready:end risks -->

## Environment

<!-- agent-ready:start environment -->
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
