# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
Compatibility Standard provides PHP_CodeSniffer sniffs for cross-version PHP compatibility checks.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `Compatibility/`: project directory.
- `tests/`: tests.
- `tools/`: project directory.
- `composer.json`: Composer package manifest.
- `phpunit.xml.dist`: PHPUnit config.
- `phpcs.xml.dist`: PHP_CodeSniffer config.
- `tools/standard-check`: Composer bin executable.
- `tools/standard-language-server`: Composer bin executable.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager (likely): composer.
- Install dependencies with `composer install`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Format: `composer fixcs`.
- Install: `composer install`.
- Lint: `composer checkcs`.
- Standard-check: `bash tools/standard-check`.
- Standard-language-server: `node tools/standard-language-server` (long-running).
- Test: `composer test`.
- Verify: `composer check-complete`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `composer test`.
- Lint: `composer checkcs`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be PHP.
- Detected frameworks: PHP_CodeSniffer, PHP_CodeSniffer standard.
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
