# @ahmedshaikh/agent-ready v0.2.3

Generate AGENTS.md, repo metadata, and MCP context so AI coding agents can onboard quickly.

## Highlights

- Generates `AGENTS.md` as the canonical repo operating guide for AI coding agents.
- Writes structured `.agents` metadata for repo maps, commands, risk policy, and handoffs.
- Prints compact onboarding packets with `agent-ready context` for agents that need one high-signal starting brief.
- Diagnoses agent readiness with `agent-ready doctor`, including generated docs, commands, CI, safety, and MCP setup.
- Prints compact status dashboards with `agent-ready status`, combining readiness, current git changes, preflight summary, validation receipts, recipes, and CI adoption hints.
- Prints first-class workspace package summaries with `agent-ready workspaces`, including root workspace commands and package-scoped command suggestions.
- Prints direct affected package lookups with `agent-ready affected` and `agent-ready workspaces --changed`.
- Explains planned-path and current-worktree risk guidance with `agent-ready impact <path...>` and `agent-ready impact --changed`, including affected workspace package mapping.
- Produces paste-ready transfer notes with `agent-ready handoff` and `agent-ready handoff --changed`.
- Runs one-shot handoff readiness checks with `agent-ready preflight`, combining doctor status, impact guidance, affected workspace packages, validation recommendations, and transfer guidance.
- Records structured validation receipts with `agent-ready run <command-name>` for commands discovered or configured in the repo.
- Prints built-in adoption recipes with `agent-ready recipes` and `agent-ready recipes --json`.
- Prints JSON Schema contracts with `agent-ready schemas`, `agent-ready schemas --json`, and `agent-ready schemas <schema-id> --json`.
- Validates saved JSON reports with `agent-ready verify-contract <report-file> --schema <schema-id>`.
- Summarizes downloaded CI receipt artifacts with `agent-ready ci-status`.
- Generates GitHub Actions validation workflows with `agent-ready add-to-ci`, including safe preview, explicit write mode, and receipt artifacts for status plus contract verification.
- Defaults generated GitHub Actions workflows to the public `RaziStuff/agent-ready` release ref while still allowing `--uses` overrides.
- Exposes `AGENTS.md`, `.agents` metadata, workspace catalogs, schema contracts, status dashboards, context packets, doctor readiness, explicit-path and git-changed impact guidance, handoff packets, preflight guidance, resource templates, prompts, summaries, and validation through a read-only stdio MCP server.
- Exposes built-in adoption recipes through `agent-ready://recipes` and `agent-ready://recipes-json` MCP resources.
- Exposes JSON Schema contracts through `agent-ready://schemas` and `agent-ready://schema/{id}` MCP resources.
- Includes MCP client recipes for installed-package, source-checkout, multi-repo, and command/args host setups.
- Includes a maintainer adoption playbook from first scan through CI receipt summaries.
- Includes copy-paste and machine-readable adoption recipes for Codex, Claude, Cursor, MCP-capable hosts, and terminal agents.
- Provides deterministic scanners for common repo facts without requiring network access or an API key.
- Detects npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.
- Detects Composer, Laravel, Symfony, and Pest projects, including Composer script aliases, Artisan, Symfony console, Pint, PHPUnit, PHP-CS-Fixer, PHPStan, framework directory roles, and migration risk areas.
- Detects Ruby gems and Rails apps, including RSpec, RuboCop, gemspecs, Rake tasks, executable entrypoints, and Ruby directory roles.
- Detects Makefile, justfile, Taskfile, and common CI provider commands.
- Covers Laravel, Symfony, Pest Composer package, Rails, Ruby gem, Django, Spring Boot, and ASP.NET Core fixture repos with snapshots.
- Snapshot-tests `AGENTS.md`, `repo-map.json`, and `commands.json` for every fixture.
- Warns when `AGENTS.md` references stale local files, with strict mode support for CI.
- Supports strict validation, metadata and runtime report schemas, fixture snapshots, MCP compatibility checks, package smoke checks, and a GitHub Action.

## CLI Surface

- `agent-ready scan`: print detected repo facts.
- `agent-ready init`: create AGENTS.md and .agents metadata.
- `agent-ready update`: refresh generated sections while preserving human edits.
- `agent-ready context`: print a compact agent onboarding packet.
- `agent-ready doctor`: diagnose whether a repo is ready for coding agents.
- `agent-ready status`: print a compact dashboard for readiness, current changes, validation, recipes, and CI adoption.
- `agent-ready workspaces`: print workspace package summaries and package-scoped commands.
- `agent-ready affected [path...]`: print workspace packages affected by planned or current git-changed paths.
- `agent-ready impact <path...>`: explain risk, affected workspace packages, and validation guidance for planned changed paths.
- `agent-ready impact --changed`: explain risk, affected workspace packages, and validation guidance for current git changed paths.
- `agent-ready handoff [path...]`: print a handoff packet with changed paths, risks, and validation guidance.
- `agent-ready handoff --changed`: print a handoff packet for current git changed paths.
- `agent-ready preflight [path...]`: check readiness, changed-path impact, affected workspaces, validation, and handoff guidance.
- `agent-ready preflight`: preflight current git changed paths by default.
- `agent-ready run <command-name>`: execute a discovered command by name and print a structured receipt.
- `agent-ready recipes`: print built-in adoption recipes for agents.
- `agent-ready recipes --json`: print built-in adoption recipes as structured JSON.
- `agent-ready schemas`: print published JSON Schema contracts for metadata and runtime reports.
- `agent-ready schemas --json`: print the JSON Schema catalog as structured JSON.
- `agent-ready schemas <schema-id> --json`: print one raw JSON Schema document.
- `agent-ready verify-contract <report-file> --schema <schema-id>`: validate a saved JSON file against a published agent-ready schema.
- `agent-ready ci-status`: summarize status and contract receipt artifacts from an agent-ready CI run.
- `agent-ready add-to-ci`: preview or write a GitHub Actions workflow for agent-ready validation.
- `agent-ready validate`: check that agent docs and metadata exist and are current.
- `agent-ready validate --strict`: fail on warnings as well as errors.
- `agent-ready explain`: show evidence behind scanner decisions.
- `agent-ready config init`: create a starter agent-ready.config.json.
- `agent-ready mcp`: start a read-only stdio MCP server for agent docs and metadata.

## Example Coverage

- `django-service`: Django service for support ticket workflows and account lookup.
- `dotnet-web-api`: ASP.NET Core service for order intake and status APIs.
- `go-service`: Go service that consumes queue events and writes normalized audit records.
- `laravel-app`: Laravel application for support request intake, queueing, and account lookup.
- `node-next-pnpm`: Customer portal built with Next.js for account and billing workflows.
- `php-pest-package`: Tiny Composer package for expressive Pest assertions and matcher helpers.
- `python-fastapi-uv`: FastAPI service for support ticket triage and account lookup.
- `rails-api`: Rails API for billing operations and account lifecycle workflows.
- `ruby-gem-rspec`: String Tools is a Ruby gem for normalizing customer-facing strings.
- `rust-cli`: Rust command-line tools for summarizing local log files.
- `spring-boot-api`: Spring Boot service for order lifecycle APIs and fulfillment events.
- `symfony-app`: Reference Symfony application for support operations and moderation workflows.

## JSON Schemas

- `schemas/affected.schema.json`: agent-ready affected workspaces report.
- `schemas/commands.schema.json`: agent-ready command catalog.
- `schemas/config.schema.json`: agent-ready config.
- `schemas/handoff.schema.json`: agent-ready handoff report.
- `schemas/impact.schema.json`: agent-ready impact report.
- `schemas/preflight.schema.json`: agent-ready preflight report.
- `schemas/repo-map.schema.json`: agent-ready repo map.
- `schemas/run-receipt.schema.json`: agent-ready command receipt.
- `schemas/status.schema.json`: agent-ready status report.
- `schemas/workspaces.schema.json`: agent-ready workspace catalog.

## Package Surface

- Package name: `@ahmedshaikh/agent-ready`.
- CLI bin: `agent-ready` -> `src/cli/main.js`.
- Node engine: `>=18.17`.
- Repository: `git+https://github.com/RaziStuff/agent-ready.git`.
- Homepage: `https://github.com/RaziStuff/agent-ready#readme`.
- Publish access: `public`.
- Published file allowlist: `src`, `schemas`, `docs`, `action.yml`, `agent-ready.config.example.json`, `AGENTS.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `RELEASE_NOTES.md`, `SECURITY.md`, `README.md`, `LICENSE`.

## Verification

- `npm run ci`: full local release gate.
- `npm run test`: unit and snapshot tests.
- `npm run snapshots:check`: generated AGENTS.md and metadata snapshot drift check.
- `npm run validate:strict`: strict generated metadata validation.
- `npm run doctor:strict`: strict agent readiness diagnostics.
- `npm run mcp:compat`: MCP schema discovery, status, workspaces, affected packages, context, doctor, explicit-path and git-changed impact, handoff, preflight, stdio compatibility, and multi-repo isolation smoke check.
- `npm run package:check`: package manifest, bin, schema, and temp-repo smoke check with status, workspaces, affected packages, impact, handoff, preflight, run, recipes, schemas, contract verification, CI status summaries, and CI workflow coverage.
- `npm run package:install-smoke`: local tarball install and installed-bin smoke check with status, workspaces, affected packages, impact, handoff, preflight, run, recipes, schemas, contract verification, CI status summaries, and CI workflow coverage.
- `pnpm pack --dry-run`: inspect the publish tarball contents before release.

## Known Limitations

- No LLM-assisted summarization yet; deterministic scanning is the default.
- MCP support is read-only and scoped to local repository context; templates expose only discovered docs, commands, workspaces, risk paths, and package-level schemas.
- No Homebrew, Docker, or standalone binary distribution yet.
- Language and framework detection is intentionally conservative and fixture-driven.

## Publish Checklist

- Run `npm run ci`.
- Run `pnpm pack --dry-run` or `npm pack --dry-run` and review the tarball contents.
- Confirm `agent-ready --version` matches `package.json`.
- Publish only from a clean working tree.
- Tag the release after the registry accepts it.

_Generated by `npm run release:notes:write`._
