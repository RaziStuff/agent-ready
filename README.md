# agent-ready

`agent-ready` generates a repo-native operating guide for AI coding agents.

The first output is `AGENTS.md`, plus structured metadata under `.agents/`.
It is local-first, dependency-light, and conservative: it scans files, detects
repo facts, labels risk areas, and avoids reading secret-like files.

## Quick Start

Run directly in any repository:

```bash
npx -y @ahmedshaikh/agent-ready@latest config init
npx -y @ahmedshaikh/agent-ready@latest init
npx -y @ahmedshaikh/agent-ready@latest doctor
```

Or install the CLI:

```bash
npm install -g @ahmedshaikh/agent-ready
agent-ready config init
agent-ready init
```

During local development from this repo:

```bash
node src/cli/main.js scan --json
node src/cli/main.js config init --dry-run
node src/cli/main.js init
node src/cli/main.js context
node src/cli/main.js doctor
node src/cli/main.js status --json
node src/cli/main.js workspaces
node src/cli/main.js affected --json
node src/cli/main.js impact src/cli/main.js
node src/cli/main.js impact --changed
node src/cli/main.js handoff --changed
node src/cli/main.js preflight
node src/cli/main.js run test --json
node src/cli/main.js recipes
node src/cli/main.js recipes --json
node src/cli/main.js schemas --json
node src/cli/main.js schemas status --json
node src/cli/main.js verify-contract status.json --schema status --json
node src/cli/main.js ci-status --status-file agent-ready-status.json --contract-file agent-ready-contract.json
node src/cli/main.js add-to-ci --json
node src/cli/main.js validate
node src/cli/main.js validate --strict
npm test
npm run snapshots:check
npm run mcp:compat
npm run package:check
npm run package:install-smoke
npm run release:notes:check
npm run ci
```

## Agent Adoption Recipes

Maintainer adoption from zero to CI receipts is documented in
`docs/adoption-playbook.md`.

Copy-paste workflows for Codex, Claude, Cursor, and other local agents live in
`docs/agent-recipes.md`. A machine-readable version lives in
`docs/agent-recipes.json` for agents that want command sequences as data. The
same content is available through `agent-ready recipes`, `agent-ready recipes
--json`, `agent-ready://recipes`, and `agent-ready://recipes-json`.

## Commands

- `agent-ready scan`: print a human-readable repo scan.
- `agent-ready scan --json`: print the full structured scan.
- `agent-ready init`: create `AGENTS.md` and `.agents/` metadata.
- `agent-ready update`: refresh generated sections while preserving human edits.
- `agent-ready context`: print a compact agent onboarding packet.
- `agent-ready context --json`: print the packet as structured JSON.
- `agent-ready doctor`: diagnose whether a repo is ready for coding agents.
- `agent-ready doctor --strict`: fail when readiness warnings remain.
- `agent-ready status`: print a compact dashboard for readiness, current changes, validation, recipes, and CI adoption.
- `agent-ready status --json`: print the dashboard as structured JSON.
- `agent-ready workspaces`: print workspace package summaries and package-scoped commands.
- `agent-ready workspaces --json`: print workspace package guidance as structured JSON.
- `agent-ready workspaces --changed`: print packages affected by current git changed paths.
- `agent-ready affected [path...]`: print workspace packages affected by planned paths.
- `agent-ready affected --json`: print affected workspace packages as structured JSON.
- `agent-ready impact <path...>`: explain risk, affected workspace packages, and validation guidance for planned changed paths.
- `agent-ready impact --changed`: explain risk, affected workspace packages, and validation guidance for current git changed paths.
- `agent-ready impact <path...> --json`: print impact guidance as structured JSON.
- `agent-ready handoff [path...]`: print a handoff packet with changed paths, risks, and validation guidance.
- `agent-ready handoff --changed`: print a handoff packet for current git changed paths.
- `agent-ready handoff --json`: print the handoff packet as structured JSON.
- `agent-ready preflight [path...]`: check readiness, changed-path impact, affected workspaces, validation, and handoff guidance.
- `agent-ready preflight`: preflight current git changed paths.
- `agent-ready preflight --json`: print preflight guidance as structured JSON.
- `agent-ready run <command-name>`: execute a discovered command by name and print a structured receipt.
- `agent-ready run <command-name> --json`: print the command receipt as structured JSON.
- `agent-ready recipes`: print built-in copy-paste adoption recipes for agents.
- `agent-ready recipes --json`: print built-in adoption recipes as structured JSON.
- `agent-ready recipes <recipe-id>`: print one adoption recipe by id.
- `agent-ready schemas`: print published JSON Schema contracts for metadata and runtime reports.
- `agent-ready schemas --json`: print the schema catalog as structured JSON.
- `agent-ready schemas <schema-id> --json`: print one raw JSON Schema document.
- `agent-ready verify-contract <report-file> --schema <schema-id>`: validate saved JSON against a published schema.
- `agent-ready verify-contract <report-file> --schema <schema-id> --json`: print a machine-readable validation receipt.
- `agent-ready ci-status`: summarize `agent-ready-status.json` and `agent-ready-contract.json` receipt artifacts.
- `agent-ready ci-status --json`: print the CI receipt summary as structured JSON.
- `agent-ready add-to-ci`: preview a GitHub Actions workflow for agent-ready validation.
- `agent-ready add-to-ci --json`: preview the workflow as structured JSON with YAML content.
- `agent-ready add-to-ci --write`: write `.github/workflows/agent-ready.yml`.
- `agent-ready validate`: check that agent docs and metadata exist and are current.
- `agent-ready validate --strict`: fail on warnings as well as errors.
- `agent-ready explain`: show why the scanner inferred key facts.
- `agent-ready config init`: create a starter `agent-ready.config.json`.
- `agent-ready mcp`: start a stdio MCP server exposing agent docs and metadata.

Common flags:

- `--root <path>`: scan a different repo root.
- `--config <path>`: use a config file other than `agent-ready.config.json`.
- `--dry-run`: print generated content without writing files.
- `--force`: replace existing generated files or profile pointers.
- `--profile <name>`: write thin pointer files for agent-specific tools.
- `--write`: write generated CI workflow files for `agent-ready add-to-ci`.
- `--mode <required|advisory>`: set whether the generated CI workflow fails or reports.
- `--uses <action-ref>`: set the generated GitHub Action reference. Defaults to `RaziStuff/agent-ready@v0.2.5`.
- `--workflow <path>`: set the generated workflow path inside the repo.
- `--no-artifacts`: omit CI receipt artifact steps from `agent-ready add-to-ci`.
- `--allow-network`: allow `agent-ready run` to execute a command marked as requiring network.
- `--allow-writes`: allow `agent-ready run` to execute a command marked as writing files.
- `--timeout-ms <ms>`: set the `agent-ready run` command timeout in milliseconds.

Profiles currently recognized:

- `generic`
- `codex`
- `claude`
- `cursor`
- `aider`
- `openhands`

`AGENTS.md` remains the canonical file. Profile files only point agents back to
it so instructions do not drift.

## Safety Model

- No network access is required.
- No project commands are executed during scanning.
- Secret-like files are never read by content.
- Large files are skipped by default.
- Generated sections are wrapped in markers so updates can preserve human edits.

## Configuration

Create `agent-ready.config.json` when maintainers know better than the scanner.

```bash
agent-ready config init
```

```json
{
  "schemaVersion": "0.1.0",
  "profiles": ["generic", "claude"],
  "ignore": ["examples/legacy/**"],
  "riskPaths": ["billing/**", "infra/**"],
  "generatedPaths": ["src/generated/**"],
  "directoryRoles": {
    "billing": "billing domain code"
  },
  "commands": {
    "test": "pnpm test",
    "verify": {
      "command": "pnpm lint && pnpm test",
      "requiresNetwork": false,
      "writesFiles": false,
      "risk": "low"
    }
  },
  "sections": {
    "purpose": "Short repo purpose written by a maintainer.",
    "conventions": [
      "Prefer existing service APIs before adding new cross-module imports."
    ]
  }
}
```

See `agent-ready.config.example.json` and `schemas/config.schema.json`.

## JSON Schemas

Generated JSON metadata is documented by:

- `schemas/repo-map.schema.json`
- `schemas/commands.schema.json`
- `schemas/config.schema.json`

Runtime JSON reports are documented by:

- `schemas/workspaces.schema.json`
- `schemas/affected.schema.json`
- `schemas/impact.schema.json`
- `schemas/handoff.schema.json`
- `schemas/preflight.schema.json`
- `schemas/run-receipt.schema.json`
- `schemas/status.schema.json`

Agents can discover the same contracts through `agent-ready schemas --json`,
fetch a raw schema with `agent-ready schemas <schema-id> --json`, read the MCP
catalog at `agent-ready://schemas`, or read one schema at
`agent-ready://schema/{id}`.

Validate saved JSON locally with:

```bash
agent-ready status --json > status.json
agent-ready verify-contract status.json --schema status --json
```

Summarize downloaded CI receipt artifacts with:

```bash
agent-ready ci-status --status-file agent-ready-status.json --contract-file agent-ready-contract.json
```

`agent-ready validate` warns when generated metadata does not match the expected
shape or when `AGENTS.md` references local files that no longer exist.
`agent-ready validate --strict` fails on those warnings, which makes it useful
for CI once a repo has adopted `AGENTS.md`.

## MCP Server

Start the read-only stdio MCP server from a repo:

```bash
agent-ready mcp --root /path/to/repo
```

Resources exposed:

- `agent-ready://agents-md`
- `agent-ready://repo-map`
- `agent-ready://commands`
- `agent-ready://workspaces`
- `agent-ready://risk-policy`
- `agent-ready://handoff-template`
- `agent-ready://agent-index`
- `agent-ready://doctor`
- `agent-ready://status`
- `agent-ready://context`
- `agent-ready://recipes`
- `agent-ready://recipes-json`
- `agent-ready://schemas`

Tools exposed:

- `agent_ready_status`: compact dashboard for readiness, current changes, validation receipts, recipes, and CI adoption.
- `agent_ready_summary`: compact JSON repo summary for agents.
- `agent_ready_workspaces`: workspace package summaries and package-scoped command suggestions.
- `agent_ready_affected`: affected workspace packages for planned paths or current git changes.
- `agent_ready_validate`: validation errors and warnings, with optional strict mode.
- `agent_ready_doctor`: readiness report for agents, with optional strict mode.
- `agent_ready_impact`: risk and validation guidance for planned paths or current git changed paths.
- `agent_ready_handoff`: structured handoff packet with Markdown, impact, and validation guidance.
- `agent_ready_preflight`: one-shot readiness, impact, validation, and handoff guidance.

Resource templates exposed:

- `agent-ready://docs/{path}`: read a scanner-discovered documentation file.
- `agent-ready://command/{name}`: read metadata for a discovered command name.
- `agent-ready://risk/{path}`: read metadata for a discovered risk path.
- `agent-ready://schema/{id}`: read a published JSON Schema contract by id.

Template values are repo-relative names or paths and should be URL-encoded when
they contain `/`, spaces, or other reserved characters. For example:
`agent-ready://docs/docs%2Farchitecture.md`.

Prompts exposed:

- `agent-ready-orient`: read the context packet, doctor report, guide, map, commands, and validation state before editing.
- `agent-ready-handoff`: prepare a compact handoff from the generated template and metadata.
- `agent-ready-risk-review`: check planned paths against risks and relevant validation.

Example MCP client configuration with the published package:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "npx",
      "args": ["-y", "@ahmedshaikh/agent-ready@latest", "mcp", "--root", "/path/to/repo"]
    }
  }
}
```

Example MCP client configuration with a global install:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "agent-ready",
      "args": ["mcp", "--root", "/path/to/repo"]
    }
  }
}
```

See `docs/mcp-clients.md` for source-checkout configs, multi-repo setups, host
setup patterns, troubleshooting, `docs/adoption-playbook.md` for maintainer
adoption, and `docs/agent-recipes.md` for complete agent task loops.

The server reads existing `AGENTS.md` and `.agents/` files when present and falls
back to deterministic scanner output without executing project commands.

## GitHub Action

Use the bundled composite action to keep agent docs current in CI:

```bash
agent-ready add-to-ci --uses RaziStuff/agent-ready@v0.2.5
agent-ready add-to-ci --write --uses RaziStuff/agent-ready@v0.2.5
```

`add-to-ci` previews by default. Pass `--write` to create
`.github/workflows/agent-ready.yml`, `--mode advisory` for non-blocking early
adoption, and `--no-strict` when warnings should not fail CI. Generated
workflows save `agent-ready-status.json` and `agent-ready-contract.json` as
artifacts by default; pass `--no-artifacts` to omit those receipt steps.

```yaml
name: Agent Ready

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate agent metadata
        uses: RaziStuff/agent-ready@v0.2.5
        with:
          command: validate
          mode: required
          strict: "true"
      - name: Write agent-ready status receipt
        if: always()
        uses: RaziStuff/agent-ready@v0.2.5
        with:
          command: status
          mode: advisory
          strict: "true"
          json: "true"
          output-file: agent-ready-status.json
      - name: Verify status receipt contract
        if: always()
        uses: RaziStuff/agent-ready@v0.2.5
        with:
          command: verify-contract
          mode: required
          args: agent-ready-status.json --schema status
          json: "true"
          output-file: agent-ready-contract.json
      - name: Upload agent-ready receipts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: agent-ready-receipts
          path: |
            agent-ready-status.json
            agent-ready-contract.json
          if-no-files-found: warn
```

For early adoption, use `mode: advisory` to report issues without failing the job.
Set `strict: "true"` when CI should fail on warnings as well as errors.

## MVP Support

Current detectors cover:

- Node.js, JavaScript, TypeScript, common frontend/backend frameworks.
- npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.
- First-class workspace package summaries through `agent-ready workspaces`, `.agents/workspaces.json`, JSON Schema, and MCP.
- Direct affected package lookup through `agent-ready affected`, `agent-ready workspaces --changed`, and `agent_ready_affected`.
- Python, including uv, Poetry, pip, pytest, ruff, mypy, and black hints.
- PHP, Composer libraries, Laravel, Symfony, Pest, Artisan, Symfony console, Pint, PHPUnit, PHP-CS-Fixer, and PHPStan hints.
- Go.
- Rust.
- Ruby, including Rails, gems, RSpec, Minitest, RuboCop, gemspecs, Rake tasks, and executable entrypoints.
- Django.
- Java/Spring Boot.
- .NET and ASP.NET Core.
- Makefile, justfile, and Taskfile targets.
- GitHub Actions, GitLab CI, CircleCI, Buildkite, Azure Pipelines, Bitbucket Pipelines, Drone CI, and Jenkins workflows.
- Risk paths such as migrations, infra, generated files, lockfiles, and secrets.
- Compact context packets for agent onboarding.
- Compact status dashboards for readiness, current changes, validation receipts, recipes, and CI adoption.
- Change impact guidance for planned paths or current git changes before agents hand off.
- Affected workspace package mapping in `impact` and `preflight`, with package-scoped validation suggestions.
- Handoff packet generation for agent-to-agent or agent-to-human transfer.
- Preflight checks that combine readiness, changed-path impact, validation recommendations, and handoff guidance.
- Structured validation receipts through explicit command execution by discovered command name.
- Built-in copy-paste and machine-readable adoption recipes for common agent loops through CLI, docs, and MCP resources.
- Discoverable JSON Schema contracts for config, metadata, and runtime reports through CLI and MCP resources.
- Local contract verification for saved JSON reports.
- GitHub Actions workflow generation for adopting strict agent metadata validation in CI.
- CI receipt artifacts for agent readiness status and contract verification.
- CI receipt summaries for downloaded status and contract artifacts.
- Read-only stdio MCP resources, resource templates, prompts, and tools for agent clients.

## Examples and Snapshot Tests

Example repos live under `examples/`:

- `examples/node-next-pnpm`: Next.js, pnpm, TypeScript, env example, Prisma migration.
- `examples/python-fastapi-uv`: FastAPI, uv, pytest, ruff, mypy, Alembic migration.
- `examples/go-service`: Go module, `cmd/` entrypoint, internal package, GitHub Actions.
- `examples/rust-cli`: Cargo CLI project with tests and lockfile.
- `examples/rails-api`: Rails API with Bundler, RSpec, RuboCop, and database migration.
- `examples/ruby-gem-rspec`: Ruby gem with Bundler, gemspec, RSpec, RuboCop, Rake, and an `exe/` entrypoint.
- `examples/ruby-gem-minitest`: Ruby gem with Bundler, gemspec, Minitest, RuboCop, and Rake test/CI tasks.
- `examples/laravel-app`: Laravel app with Composer, Artisan, Pint, PHPUnit, Vite, and database migration.
- `examples/symfony-app`: Symfony app with Composer, console, PHPUnit, PHP-CS-Fixer, PHPStan, Twig templates, and translations.
- `examples/php-pest-package`: Composer package with Pest tests, PHPStan, and Composer script aliases.
- `examples/php-composer-library`: Composer library with PHPUnit, PHPStan, PHP-CS-Fixer, and no PHP framework.
- `examples/django-service`: Django service with `manage.py` and pip requirements.
- `examples/spring-boot-api`: Spring Boot service with Maven wrapper.
- `examples/dotnet-web-api`: ASP.NET Core service with solution and test project.

The snapshot tests generate `AGENTS.md`, `.agents/repo-map.json`, and
`.agents/commands.json` for each example and compare them to
`tests/snapshots/*.agents.md`, `*.repo-map.json`, and `*.commands.json`. When
writer or metadata output changes intentionally, update the matching snapshot in
the same commit.

Snapshot commands:

```bash
npm run snapshots:check
npm run snapshots:update
```

Use `snapshots:check` in CI and before handoff. Use `snapshots:update` only when
generated Markdown or JSON metadata output changed intentionally and the new
output has been reviewed.

## CI

This repo uses `.github/workflows/ci.yml` to run:

```bash
npm test
npm run snapshots:check
npm run validate:strict
npm run doctor:strict
npm run mcp:compat
npm run package:check
npm run package:install-smoke
npm run release:notes:check
npm pack --dry-run
```

Strict validation checks that agent docs exist, generated command metadata is
current, and `.agents/repo-map.json` plus `.agents/commands.json` match the
expected metadata shape.

## Release

Run `npm run package:check` before publishing. It validates the manifest, public
repository metadata, package allowlist, CLI bin, schemas, and a temp-repo `init`
plus strict validation smoke test without touching the network.

Run `npm run package:install-smoke` to create a real local tarball, install it
into a temporary project, and run the installed `agent-ready` bin against a
temporary target repo.

Run `npm run release:notes:write` to generate `RELEASE_NOTES.md`, and
`npm run release:notes:check` to verify it is current.

After publishing, run `npm run published:smoke` to verify the package from the
public npm registry, including `latest`, README metadata, CLI version, and a
fresh temp-repo init plus strict validation.

See `SECURITY.md` for the security model, `docs/adoption-playbook.md` for the
adoption flow, `docs/roadmap.md` for planned work, and
`docs/release-checklist.md` for the publish checklist.

See `AGENT_ONBOARDING_GENERATOR_WRITEUP.md` for the fuller product plan.
