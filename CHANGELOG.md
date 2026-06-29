# Changelog

All notable changes to `agent-ready` will be documented here.

## 0.2.2 - Pest Coverage

### Added

- Added Pest framework detection from Composer package names, dependencies,
  plugin dependencies, `bin/pest`, `tests/Pest.php`, and `pest.php`.
- Added common Composer script aliases for unit, integration, parallel,
  end-to-end, lint, typecheck, format, analyse/analyze, and PHPStan-style
  scripts.
- Added a generic Composer/Pest package fixture with AGENTS.md, repo-map, and
  command snapshots.
- Added an external dogfood report for the published CLI against `pestphp/pest`.

### Fixed

- Prefer declared Composer scripts such as `composer test` and
  `composer test:type:check` before falling back to raw PHPUnit/PHPStan commands.
- Skip README blockquote announcements and strip simple Markdown emphasis when
  extracting repo purpose summaries.

## 0.2.1 - Symfony Coverage

### Added

- Added Symfony framework detection from Composer dependencies and Symfony
  project files.
- Added Symfony entrypoints for `bin/console`, `config/bundles.php`,
  `config/routes.yaml`, and `public/index.php`.
- Added Symfony-oriented command guidance for console access, PHPUnit,
  PHP-CS-Fixer, PHPStan, and a dependency-free local PHP server.
- Added directory roles for server-rendered templates, translations, and local
  data fixtures.
- Added a Symfony fixture with AGENTS.md, repo-map, and command snapshots.
- Added an external dogfood report for the published CLI against
  `symfony/demo`.

### Fixed

- Build README purpose summaries from complete Markdown paragraphs so wrapped
  README descriptions are not truncated after the first line.

## 0.2.0 - Laravel Coverage

### Added

- Added Composer detection from `composer.json`, including Composer install and
  common script commands.
- Added Laravel framework detection with Artisan command guidance for tests,
  serving, and migrations.
- Added Laravel Pint and PHPUnit hints for lint/test guidance.
- Added Laravel-oriented directory roles, entrypoints, and a Laravel fixture
  with AGENTS.md, repo-map, and commands snapshots.
- Added an external dogfood report for the published CLI against
  `laravel/laravel`.

### Fixed

- Clean HTML-heavy README lines before choosing the detected repository
  purpose so logo and badge markup is not used as the summary.
- Mark `composer.lock` as a lockfile risk path.

## 0.1.2 - Public CI Default

### Fixed

- Default generated GitHub Actions workflows to the public
  `RaziStuff/agent-ready@v0.1.2` action ref so `agent-ready add-to-ci --json`
  is immediately usable after install.

### Added

- Added a dogfood report documenting the published-package first-use check and
  the friction it uncovered.

## 0.1.1 - Npm Metadata Patch

### Fixed

- Published under the npm user scope as `@ahmedshaikh/agent-ready` while keeping
  the executable command as `agent-ready`.
- Use the npm CLI publish path for patch releases so npm package pages receive
  README metadata.

## 0.1.0 - Initial Release

### Added

- CLI commands: `scan`, `init`, `update`, `context`, `doctor`, `status`, `workspaces`, `affected`, `impact`, `handoff`, `preflight`, `run`, `recipes`, `schemas`, `verify-contract`, `ci-status`, `add-to-ci`, `validate`, `explain`, `config init`, and `mcp`.
- `AGENTS.md` generation with marked sections that preserve human edits on update.
- `.agents` metadata output:
  - `repo-map.json`
  - `commands.json`
  - `workspaces.json`
  - `risk-policy.md`
  - `handoff-template.md`
  - `agent-index.md`
- Deterministic scanners for:
  - Node.js, JavaScript, TypeScript, package scripts, and common frameworks.
  - Python, uv, Poetry, pip, pytest, ruff, mypy, and framework signals.
  - Go modules.
  - Rust Cargo projects.
  - Ruby on Rails, Django, Java/Spring Boot, and .NET/ASP.NET Core projects.
  - Makefile, justfile, and Taskfile targets.
  - GitHub Actions, GitLab CI, CircleCI, Buildkite, Azure Pipelines, Bitbucket Pipelines, Drone CI, and Jenkins workflows.
  - npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.
  - Risk paths, generated paths, lockfiles, migrations, infra, and secret-like files.
- Maintainer config through `agent-ready.config.json`.
- Starter config generation through `agent-ready config init`.
- Compact onboarding packets through `agent-ready context` and `agent-ready context --json`.
- Readiness diagnostics through `agent-ready doctor` and `agent-ready doctor --strict`.
- Compact status dashboards through `agent-ready status` and `agent-ready status --json`, combining readiness, current git changes, preflight summary, validation receipts, recipes, and CI adoption hints.
- First-class workspace package summaries through `agent-ready workspaces`, `.agents/workspaces.json`, `agent-ready://workspaces`, and `agent_ready_workspaces`.
- Direct affected package lookup through `agent-ready affected`, `agent-ready workspaces --changed`, and `agent_ready_affected`.
- Planned-path and current-worktree impact guidance through `agent-ready impact <path...>`, `agent-ready impact --changed`, and JSON output, including affected workspace package mapping.
- Handoff packet generation through `agent-ready handoff`, `agent-ready handoff --changed`, and JSON output.
- One-shot preflight guidance through `agent-ready preflight`, combining readiness, changed-path impact, affected workspace packages, validation recommendations, and handoff guidance.
- Structured command receipts through `agent-ready run <command-name>`, with explicit approval flags for networked or file-writing commands.
- Built-in adoption recipe discovery through `agent-ready recipes`, `agent-ready recipes --json`, `agent-ready://recipes`, and `agent-ready://recipes-json`.
- JSON Schema discovery through `agent-ready schemas`, `agent-ready schemas --json`, `agent-ready schemas <schema-id> --json`, `agent-ready://schemas`, and `agent-ready://schema/{id}`.
- Local JSON contract verification through `agent-ready verify-contract <report-file> --schema <schema-id>`.
- CI receipt summaries through `agent-ready ci-status`, reading status and contract artifacts generated by `agent-ready add-to-ci`.
- GitHub Actions workflow generation through `agent-ready add-to-ci`, including preview, JSON output, explicit write mode, advisory/required modes, strict toggles, receipt artifacts, custom action refs, and overwrite protection.
- Agent profile pointer support for Claude, Cursor, Aider, and OpenHands-style files.
- Read-only stdio MCP server exposing `AGENTS.md`, `.agents` metadata, schema contracts, status dashboards, context packets, doctor readiness, impact guidance, handoff packets, preflight guidance, resource templates, prompts, repo summaries, and validation results.
- MCP client recipes for installed-package, source-checkout, multi-repo, and command/args host setups.
- Maintainer adoption playbook covering first scan, config, generated docs, CI receipts, artifact summaries, maintenance, troubleshooting, and rollback.
- Copy-paste and machine-readable adoption recipes for Codex, Claude, Cursor, MCP-capable hosts, and terminal agents.
- Strict validation mode with metadata shape checks and stale local reference warnings for `AGENTS.md`.
- JSON schemas for config, repo maps, command catalogs, workspace catalogs, affected workspace reports, impact reports, handoff packets, preflight reports, run receipts, and status dashboards.
- Example fixture repos plus generated `AGENTS.md`, `repo-map.json`, and `commands.json` snapshots for Node, Python, Go, Rust, Rails, Django, Spring Boot, and .NET.
- GitHub composite Action.
- CI workflow.
- Package smoke check and local tarball install smoke check, including installed status, explicit-path and git-changed impact, handoff, preflight, recipe, CI workflow receipt artifacts, schema, contract verification, CI status summaries, and run receipt checks.
- MCP compatibility smoke check for schema discovery, status dashboards, context packets, doctor readiness, explicit-path and git-changed impact guidance, handoff guidance, preflight guidance, common stdio launch patterns, and multi-repo isolation.
- Release notes generator and release checklist.

### Known Limitations

- No LLM-assisted summarization yet.
- MCP server is read-only and intentionally limited to local repo context; resources expose scanner-discovered docs, commands, workspaces, risk paths, and package-level schemas.
- No Homebrew, Docker, or standalone binary distribution yet.
- Detection remains conservative and fixture-driven.
