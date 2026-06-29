# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
Reference Symfony application for support operations and moderation workflows.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `bin/`: developer and framework command wrappers.
- `config/`: configuration.
- `public/`: static assets.
- `src/`: application source.
- `templates/`: server-rendered templates.
- `tests/`: tests.
- `translations/`: localization messages.
- `bin/console`: Symfony console entrypoint.
- `config/bundles.php`: Symfony bundle registry.
- `config/routes.yaml`: Symfony routes config.
- `public/index.php`: PHP web front controller.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager: composer.
- Install dependencies with `composer install`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Console: `./bin/console`.
- Install: `composer install`.
- Lint: `vendor/bin/php-cs-fixer fix --dry-run --diff`.
- Serve: `php -S localhost:8000 -t public/`.
- Test: `./bin/phpunit`.
- Typecheck: `vendor/bin/phpstan analyse`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `./bin/phpunit`.
- Lint: `vendor/bin/php-cs-fixer fix --dry-run --diff`.
- Typecheck: `vendor/bin/phpstan analyse`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be PHP.
- Detected frameworks: Symfony.
- Read local docs before large changes: `README.md`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
- `composer.lock`: lockfiles should change only when dependencies change.
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
