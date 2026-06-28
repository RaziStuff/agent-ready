# AGENTS.md

## Purpose

<!-- agent-ready:start purpose -->
`agent-ready` generates repo-native operating guides for AI coding agents.
<!-- agent-ready:end purpose -->

## Repo Map

<!-- agent-ready:start repo-map -->
- `.agents/`: agent metadata and handoff files.
- `.github/`: GitHub workflows and repository automation.
- `docs/`: documentation.
- `examples/`: example projects and fixtures.
- `schemas/`: JSON schemas and structured contracts.
- `scripts/`: developer scripts.
- `src/`: application source.
- `tests/`: tests.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager (likely): npm.
- Install dependencies with `npm install`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Install: `npm install`.
- Test: `node --test tests/*.test.js`.
- Verify: `npm run ci`.
<!-- agent-ready:end commands -->

## Validation

<!-- agent-ready:start validation -->
- Tests: `node --test tests/*.test.js`.

Before handing off, run the smallest validation command that covers your change and report what passed or failed.
<!-- agent-ready:end validation -->

## Conventions

<!-- agent-ready:start conventions -->
- Primary language appears to be JavaScript.
- Read local docs before large changes: `README.md`, `CONTRIBUTING.md`, `docs/agent-recipes.md`, `docs/mcp-clients.md`, `docs/release-checklist.md`, `docs/roadmap.md`.
- Example fixture repos live under `examples/` and are ignored for this repo's own command detection.
- Generated `AGENTS.md` output is covered by snapshots in `tests/snapshots/`.
- Follow nearby code style and existing helper APIs before introducing new abstractions.
- Keep generated outputs and lockfiles scoped to dependency or generator changes.
<!-- agent-ready:end conventions -->

## Risky Areas

<!-- agent-ready:start risks -->
- `.github/workflows`: CI changes can affect validation and release behavior.
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
- Generated at: 2026-06-27T22:06:01.101Z.
- Structured repo map: `.agents/repo-map.json`.
- Command catalog: `.agents/commands.json`.
- Risk policy: `.agents/risk-policy.md`.
- Handoff template: `.agents/handoff-template.md`.
<!-- agent-ready:end metadata -->
