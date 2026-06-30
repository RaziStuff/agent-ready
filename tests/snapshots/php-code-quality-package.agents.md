# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
Quality Kit provides Composer-ready PHP_CodeSniffer rules and local QA commands.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `bin/`: developer and framework command wrappers.
- `src/`: application source.
- `tests/`: tests.
- `composer.json`: Composer package manifest.
- `phpunit.xml.dist`: PHPUnit config.
- `phpcs.xml.dist`: PHP_CodeSniffer config.
- `ruleset.xml`: PHP_CodeSniffer ruleset.
- `bin/quality-check`: Composer bin executable.
- `bin/quality-fix`: Composer bin executable.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager (likely): composer.
- Install dependencies with `composer install`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Build: `composer build`. Build local PHPCS helper artifacts.
- Format: `composer phpcbf`. Fix coding standard violations.
- Install: `composer install`.
- Lint: `composer phpcs`. Check coding standard violations.
- Quality-check: `php bin/quality-check`.
- Quality-fix: `php bin/quality-fix`.
- Test: `composer test`. Run the unit test suite.
- Verify: `composer check-all`. Run all quality checks.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `composer test`.
- Lint: `composer phpcs`.
- Build: `composer build`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be PHP.
- Detected frameworks: Composer library, PHP_CodeSniffer.
- Composer plugins are explicitly allowed for `dealerdirect/phpcodesniffer-composer-installer`; review this list before changing Composer plugin dependencies.
- Read local docs before large changes: `README.md`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
_No high-confidence data detected yet._
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
