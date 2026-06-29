# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
Laravel application for support request intake, queueing, and account lookup.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `app/`: application routes or app source.
- `bootstrap/`: framework bootstrapping.
- `config/`: configuration.
- `database/`: database schema, factories, seeders, and migrations.
- `public/`: static assets.
- `resources/`: views, frontend assets, and localization resources.
- `routes/`: application route definitions.
- `tests/`: tests.
- `artisan`: Laravel Artisan command entrypoint.
- `public/index.php`: PHP web front controller.
- `routes/web.php`: Laravel web routes.
- `composer.json`: Composer package manifest.
- `phpunit.xml`: PHPUnit config.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager (likely): composer.
- Package manager (likely): npm.
- Install dependencies with `composer install`.
- Multiple package manager signals were detected; confirm the intended install path before changing dependencies.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Build: `npm run build`.
- Dev server: `npm run dev`.
- Format: `composer format`.
- Install: `composer install`.
- Lint: `vendor/bin/pint --test`.
- Migrate: `php artisan migrate`.
- Serve: `php artisan serve`.
- Test: `php artisan test`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `php artisan test`.
- Lint: `vendor/bin/pint --test`.
- Build: `npm run build`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be PHP.
- Detected frameworks: Laravel, Vite.
- Read local docs before large changes: `README.md`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
- `database/migrations`: database migrations can affect persisted data.
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
