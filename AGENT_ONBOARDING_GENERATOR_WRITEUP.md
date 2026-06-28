# Agent Onboarding Generator: Build, Ship, and Adoption Plan

## 1. Executive Summary

The project is an open source, agent-friendly repo onboarding generator that scans a codebase and produces a high-signal `AGENTS.md` plus optional companion files that help AI coding agents work safely and effectively.

The core promise is simple:

> Any agent can enter any repo, run one command, and get a trustworthy operating manual for that repo.

The first product should be intentionally boring and extremely useful. It should not try to become a full AI coding platform. It should generate accurate repo context, discover commands, identify important files, describe architecture, warn about risky areas, and create a maintained agent entrypoint that works across Codex, Claude Code, Cursor, Aider, OpenHands, Devin-like agents, GitHub Copilot coding agents, and any future agent that can read a Markdown file.

The first artifact is:

```text
AGENTS.md
```

The broader product becomes:

```text
.agents/
  repo-map.json
  commands.json
  conventions.md
  risk-policy.md
  handoff-template.md
  memories.md
AGENTS.md
```

The implementation should start as a local CLI with deterministic scanners. It can optionally use LLMs later, but the MVP must work without an API key. This matters because agents need tools that are reliable inside sandboxes, CI, enterprise networks, private repos, and offline environments.

## 2. The Problem

AI agents lose time and make mistakes because every repo has hidden operational knowledge:

- Which install command actually works.
- Which test command is fast enough to run during development.
- Which generated files should never be hand-edited.
- Which migrations are risky.
- Which folders contain frontend, backend, infra, docs, generated code, or vendored code.
- Which environment variables are required.
- Which conventions matter but are only implied by existing code.
- Which CI jobs are canonical.
- Which files are the real entrypoints.
- Which package manager is in use.
- Which test framework is present.
- Which commands write outside the repo or require network access.
- Which parts of the repo are owned by humans and should not be touched casually.

Human developers learn this by osmosis. Agents do not. Each new agent session rediscovers the same facts, often by reading too much, guessing commands, or making unnecessary mistakes.

This is especially painful because many agents start with a short context window, a generic system prompt, and no durable repo memory. Even if one agent figures something out, the next agent may not inherit it.

The missing layer is a durable repo-native operating manual written in a format agents already know how to consume.

## 3. Product Goal

Build a universal repo onboarding generator that:

1. Scans a repository safely and locally.
2. Infers the repo's structure, technologies, commands, tests, and risks.
3. Generates a clear `AGENTS.md`.
4. Creates optional structured metadata under `.agents/`.
5. Can be run locally, in CI, or by an agent during its first few minutes in a repo.
6. Works with many languages and agent tools.
7. Is easy for humans to review and correct.
8. Stays useful over time through update and validation commands.

The product should make every repo more legible to agents without asking teams to adopt a heavy platform.

## 4. Non-Goals

The first version should not:

- Execute arbitrary project commands automatically without explicit flags.
- Require an LLM or paid API.
- Rewrite source code.
- Replace README files or human documentation.
- Store secrets.
- Upload code by default.
- Become a full IDE extension before the CLI is excellent.
- Infer business logic with false confidence.
- Pretend every generated statement is certain.

The tool should be humble: detect what it can, label uncertainty, and invite human correction.

## 5. Target Users

Primary users:

- AI coding agents entering unfamiliar repos.
- Developers who want their repo to be agent-ready.
- Open source maintainers who want better automated contributions.
- Platform teams standardizing AI coding workflows across many repos.
- Engineering managers adopting agents across a company.

Secondary users:

- Developer relations teams.
- Coding agent vendors.
- Devtool builders.
- Security teams reviewing agent behavior.
- CI maintainers who want consistent repo metadata.

## 6. Core Design Principle

The most important design principle is:

> Deterministic first, LLM-assisted second.

That means the tool should gather facts from files, package metadata, lockfiles, CI configs, tests, Dockerfiles, Makefiles, manifests, and conventional paths before it asks an LLM to summarize anything.

LLMs are good at synthesis. They are less reliable as the source of truth. The scanner should produce structured facts. The writer should turn those facts into readable docs. If an LLM is used, it should be constrained by the structured facts and its output should be clearly marked as generated.

## 7. The Main Artifact: AGENTS.md

The `AGENTS.md` file should be the canonical entrypoint for coding agents.

Recommended structure:

```markdown
# AGENTS.md

## Purpose

Short description of the repo.

## Repo Map

- `src/`: application code
- `tests/`: test suite
- `docs/`: documentation
- `.github/workflows/`: CI

## Setup

- Package manager: pnpm
- Install: `pnpm install`
- Node version: from `.nvmrc`

## Common Commands

- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Unit tests: `pnpm test:unit`
- Lint: `pnpm lint`
- Build: `pnpm build`

## Validation

Before finishing changes, run the smallest relevant check:

- Frontend component: `pnpm test:unit -- <component>`
- Shared package: `pnpm test --filter <package>`
- Full confidence: `pnpm lint && pnpm typecheck && pnpm test`

## Conventions

- Use existing helper APIs before adding new abstractions.
- Keep generated files unchanged.
- Follow existing formatting through the repo's formatter.

## Risky Areas

- `db/migrations/`: review carefully.
- `infra/`: may affect deployment.
- `generated/`: do not edit directly.

## Environment

- Required env examples are in `.env.example`.
- Never commit secrets.

## Agent Workflow

1. Read this file first.
2. Inspect nearby code before editing.
3. Prefer targeted tests during development.
4. Summarize changed files and validation before handoff.

## Generated Metadata

More detail is available in `.agents/repo-map.json`.
```

This format is deliberately plain. Every agent can read Markdown. Every developer can review it in a pull request.

## 8. Companion Files

The generated companion files should be optional. `AGENTS.md` is the universal interface; `.agents/` is the structured layer.

Recommended files:

```text
.agents/repo-map.json
.agents/commands.json
.agents/conventions.md
.agents/risk-policy.md
.agents/handoff-template.md
.agents/agent-index.md
```

### `.agents/repo-map.json`

Machine-readable summary of repo layout.

Example:

```json
{
  "schemaVersion": "1.0.0",
  "generatedAt": "2026-06-27T00:00:00Z",
  "root": ".",
  "languages": ["TypeScript", "CSS"],
  "packageManagers": ["pnpm"],
  "frameworks": ["Next.js"],
  "directories": [
    {
      "path": "app",
      "role": "application_routes",
      "confidence": 0.92
    },
    {
      "path": "components",
      "role": "ui_components",
      "confidence": 0.88
    }
  ],
  "entrypoints": [
    {
      "path": "app/page.tsx",
      "kind": "frontend_page",
      "confidence": 0.86
    }
  ]
}
```

### `.agents/commands.json`

Machine-readable command catalog.

Example:

```json
{
  "schemaVersion": "1.0.0",
  "commands": [
    {
      "name": "install",
      "command": "pnpm install",
      "source": "packageManager",
      "requiresNetwork": true,
      "confidence": 0.95
    },
    {
      "name": "test",
      "command": "pnpm test",
      "source": "package.json:scripts.test",
      "requiresNetwork": false,
      "confidence": 0.9
    }
  ]
}
```

### `.agents/conventions.md`

Human-readable conventions discovered from config files and existing docs.

This file should include:

- Formatter.
- Linter.
- Test framework.
- Import style.
- Naming conventions when confidently detectable.
- Local docs links.
- Notes copied from existing repo docs with attribution.

### `.agents/risk-policy.md`

Safety guide for agents.

This should include:

- Files likely to contain secrets.
- Generated paths.
- Migration paths.
- Lockfiles.
- Deployment config.
- Infra config.
- Large binary paths.
- Areas that should trigger extra caution or human review.

### `.agents/handoff-template.md`

Template for ending an agent session.

Example:

```markdown
# Agent Handoff

## Goal

## Current State

## Files Changed

## Validation

## Known Issues

## Next Step
```

### `.agents/agent-index.md`

A deeper, generated index for long-context agents.

This file can be longer than `AGENTS.md` and include:

- Important files.
- Dependency graph summary.
- CI workflows.
- Test targets.
- Framework-specific notes.
- API route summaries.
- Database schema pointers.

## 9. MVP Scope

The MVP should do five things very well:

1. Detect project type and language.
2. Detect package manager and common commands.
3. Map important directories.
4. Detect risk paths and generated files.
5. Generate `AGENTS.md` and `.agents/*.json`.

Supported ecosystems for MVP:

- Node.js and TypeScript.
- Python.
- Go.
- Rust.
- Generic Makefile-based repos.
- GitHub Actions CI.

That covers a huge share of repos while keeping implementation manageable.

## 10. CLI Design

The CLI should feel obvious.

Recommended command name:

```bash
agent-ready
```

Alternative names:

- `agent-onboard`
- `repo-agent-kit`
- `agents-md`
- `repo-context`

Core commands:

```bash
agent-ready init
agent-ready scan
agent-ready write
agent-ready validate
agent-ready update
agent-ready explain
```

### `agent-ready init`

Creates an initial `AGENTS.md` and `.agents/` folder.

Example:

```bash
agent-ready init
```

Flags:

```bash
--root <path>
--output <path>
--format markdown,json
--force
--dry-run
--no-llm
--profile codex|claude|cursor|aider|openhands|generic
```

### `agent-ready scan`

Scans the repo and prints structured facts.

Example:

```bash
agent-ready scan --json
```

Use cases:

- Debugging scanner behavior.
- CI checks.
- Integrating with other agent tools.

### `agent-ready write`

Writes docs from an existing scan result.

Example:

```bash
agent-ready scan --json > .agents/repo-scan.json
agent-ready write --input .agents/repo-scan.json
```

### `agent-ready validate`

Checks whether `AGENTS.md` is stale, missing important sections, or references commands that no longer exist.

Example:

```bash
agent-ready validate
```

Validation should detect:

- Missing `AGENTS.md`.
- Missing `.agents/repo-map.json`.
- Referenced package scripts that no longer exist.
- Stale generated timestamp.
- Files mentioned in docs that no longer exist.
- Package manager mismatch.
- Empty or low-confidence sections.

### `agent-ready update`

Updates generated content while preserving human edits.

This command is important. Humans will edit `AGENTS.md`, and the tool must not casually overwrite their work.

Approach:

- Use generated block markers.
- Preserve hand-written sections.
- Update only generated regions unless `--force` is passed.

Example markers:

```markdown
<!-- agent-ready:start repo-map -->
Generated content here.
<!-- agent-ready:end repo-map -->
```

### `agent-ready explain`

Prints a short explanation of what the tool detected and why.

Example:

```bash
agent-ready explain
```

Output:

```text
Detected pnpm because pnpm-lock.yaml exists.
Detected Next.js because package.json depends on next.
Detected test command from package.json scripts.test.
Marked prisma/migrations as risky because it matches a migration path pattern.
```

This command builds trust.

## 11. Architecture

The architecture should be modular and boring.

```text
CLI
  -> Scanner Orchestrator
      -> File Inventory
      -> Git Ignore Reader
      -> Language Detectors
      -> Package Manager Detectors
      -> Framework Detectors
      -> Command Detectors
      -> CI Detectors
      -> Risk Detectors
      -> Documentation Readers
  -> Fact Model
  -> Confidence Scorer
  -> Writers
      -> AGENTS.md writer
      -> JSON metadata writer
      -> Profile adapters
  -> Validators
```

Each detector should be small and testable.

## 12. Technology Choice

I would build the first version in TypeScript for these reasons:

- Easy to ship as an npm package.
- Familiar to many agent environments.
- Good filesystem and JSON tooling.
- Easy cross-platform CLI support.
- Works well for parsing package files, lockfiles, and config.
- Can be bundled into a single executable later.

Recommended stack:

- Runtime: Node.js 20+.
- Language: TypeScript.
- CLI framework: `commander` or `clipanion`.
- Filesystem utilities: `fs-extra` or native `node:fs/promises`.
- Glob matching: `fast-glob`.
- Git ignore parsing: `ignore`.
- JSON schema validation: `zod`.
- Markdown generation: small custom writer.
- Tests: `vitest`.
- Lint/format: `eslint` and `prettier`, or Biome if we want one tool.
- Release: Changesets.
- CI: GitHub Actions.

The tool should avoid large dependencies unless they clearly earn their keep.

## 13. Data Model

The internal model should separate raw evidence from interpreted facts.

### Evidence

Evidence is something directly observed.

Example:

```json
{
  "kind": "file_exists",
  "path": "pnpm-lock.yaml"
}
```

Example:

```json
{
  "kind": "package_script",
  "path": "package.json",
  "script": "test",
  "command": "vitest run"
}
```

### Fact

A fact is a conclusion based on evidence.

Example:

```json
{
  "kind": "package_manager",
  "value": "pnpm",
  "confidence": 0.98,
  "evidence": ["file_exists:pnpm-lock.yaml"]
}
```

This distinction matters because the tool must be explainable.

## 14. Confidence Scoring

Every inferred fact should have a confidence score.

Examples:

- `pnpm-lock.yaml` exists: pnpm confidence `0.98`.
- `package.json` has `next` dependency: Next.js confidence `0.95`.
- Directory named `components`: UI components confidence `0.7`.
- Directory named `utils`: utility code confidence `0.6`.
- README says "Run pnpm test": test command confidence `0.8`.

Generated docs should phrase facts based on confidence:

- High confidence: "Package manager: pnpm."
- Medium confidence: "Likely package manager: pnpm."
- Low confidence: omit from main `AGENTS.md`, include in JSON only.

This prevents the tool from polluting docs with guesses.

## 15. Scanner Details

### File Inventory

The scanner should first build a bounded file inventory.

Rules:

- Respect `.gitignore`.
- Ignore `.git/`.
- Ignore `node_modules/`.
- Ignore common build outputs.
- Ignore large binary files.
- Limit max files scanned by default.
- Limit max bytes read per file.
- Never read files likely to contain secrets unless reading names only.

Default ignored paths:

```text
.git/
node_modules/
vendor/
dist/
build/
coverage/
.next/
.nuxt/
.turbo/
.cache/
target/
__pycache__/
.venv/
venv/
.tox/
```

Default suspicious files:

```text
.env
.env.*
*.pem
*.key
id_rsa
id_ed25519
credentials.json
service-account*.json
```

The tool can note these files exist but should not read their contents.

### Language Detection

Use file extensions plus manifest files.

Signals:

- TypeScript: `.ts`, `.tsx`, `tsconfig.json`.
- JavaScript: `.js`, `.jsx`, `package.json`.
- Python: `.py`, `pyproject.toml`, `requirements.txt`, `setup.py`.
- Go: `.go`, `go.mod`.
- Rust: `.rs`, `Cargo.toml`.
- Java: `.java`, `pom.xml`, `build.gradle`.
- Kotlin: `.kt`, `build.gradle.kts`.
- Ruby: `.rb`, `Gemfile`.
- PHP: `.php`, `composer.json`.
- C#: `.cs`, `.csproj`, `.sln`.
- C/C++: `.c`, `.h`, `.cc`, `.cpp`, `CMakeLists.txt`.

Output should include primary and secondary languages.

### Package Manager Detection

Signals:

- `pnpm-lock.yaml`: pnpm.
- `yarn.lock`: Yarn.
- `package-lock.json`: npm.
- `bun.lock` or `bun.lockb`: Bun.
- `uv.lock`: uv.
- `poetry.lock`: Poetry.
- `Pipfile.lock`: Pipenv.
- `requirements.txt`: pip.
- `go.mod`: Go modules.
- `Cargo.lock`: Cargo.
- `Gemfile.lock`: Bundler.
- `composer.lock`: Composer.

If multiple package managers appear, flag it.

Example:

```markdown
Package manager conflict detected: `pnpm-lock.yaml` and `yarn.lock` both exist.
Prefer confirming with a maintainer before running install commands.
```

### Command Detection

For Node:

- Read `package.json` scripts.
- Identify install command from lockfile.
- Map common script names:
  - `test`
  - `test:unit`
  - `test:e2e`
  - `lint`
  - `typecheck`
  - `build`
  - `dev`
  - `format`

For Python:

- Read `pyproject.toml`.
- Detect pytest, ruff, black, mypy, tox, nox.
- Detect Makefile targets.

For Go:

- `go test ./...`
- `go test ./path/...`
- `go vet ./...`
- `go build ./...`

For Rust:

- `cargo test`
- `cargo check`
- `cargo clippy`
- `cargo fmt --check`

For generic repos:

- Parse Makefile targets.
- Parse justfile targets.
- Parse Taskfile.yml.
- Parse CI commands.

Commands should be labeled by risk:

```json
{
  "name": "test",
  "command": "pnpm test",
  "risk": "low",
  "writesFiles": false,
  "requiresNetwork": false
}
```

### Framework Detection

Node framework signals:

- Next.js: dependency `next`, `next.config.*`, `app/`, `pages/`.
- React: dependency `react`.
- Vue: dependency `vue`, `vite.config.*`.
- SvelteKit: dependency `@sveltejs/kit`, `svelte.config.*`.
- Remix: dependency `@remix-run/*`.
- Express: dependency `express`.
- Fastify: dependency `fastify`.
- NestJS: dependency `@nestjs/core`.

Python framework signals:

- Django: dependency `django`, `manage.py`.
- Flask: dependency `flask`.
- FastAPI: dependency `fastapi`.
- Celery: dependency `celery`.

Other:

- Rails: `Gemfile` includes Rails, `config/routes.rb`.
- Laravel: `artisan`, `composer.json` includes Laravel.
- Spring: `pom.xml` or Gradle includes Spring Boot.

### CI Detection

Support initially:

- GitHub Actions: `.github/workflows/*.yml`.
- GitLab CI: `.gitlab-ci.yml`.
- CircleCI: `.circleci/config.yml`.
- Buildkite: `.buildkite/`.

Extract:

- Job names.
- Trigger types.
- Commands.
- Language setup.
- Node/Python/Go/Rust versions.
- Required services.

CI commands are often the best source of canonical validation.

### Risk Detection

Risk paths:

```text
db/migrations/
database/migrations/
prisma/migrations/
supabase/migrations/
infra/
terraform/
k8s/
kubernetes/
helm/
.github/workflows/
Dockerfile
docker-compose.yml
package-lock.json
pnpm-lock.yaml
yarn.lock
Cargo.lock
go.sum
generated/
dist/
build/
```

Risk categories:

- Generated files.
- Database migrations.
- Infrastructure.
- Deployment.
- Security-sensitive config.
- Lockfiles.
- Binary assets.
- Large files.
- Vendored code.

The generator should not say "never edit" for every risky file. It should say:

- "Avoid hand-editing generated files."
- "Treat migrations as high-impact."
- "Update lockfiles only when dependency changes require it."
- "Review CI changes carefully."

### Documentation Detection

Read short, known documentation files:

```text
README.md
CONTRIBUTING.md
DEVELOPMENT.md
docs/**/*.md
.github/CONTRIBUTING.md
```

Rules:

- Do not copy large chunks.
- Extract command snippets and headings.
- Attribute source paths.
- Prefer explicit docs over guesses.

## 16. Writer Design

The writer should produce clean Markdown that agents and humans both like.

Qualities:

- Short sections.
- Commands in fenced or inline code.
- No hype.
- No unsupported claims.
- Clear uncertainty.
- Stable ordering for low-noise diffs.
- Generated markers around auto-updated blocks.

The writer should use templates with data slots, not freeform string soup.

Example template slots:

```text
purpose
repoMap
setup
commands
validation
conventions
riskAreas
environment
agentWorkflow
metadata
```

## 17. Preserving Human Edits

This is one of the most important details.

The tool must assume humans will edit `AGENTS.md`.

Recommended approach:

1. On first generation, create the whole file.
2. Mark generated sections.
3. On update, replace only marked sections.
4. Preserve unmarked sections exactly.
5. If markers are broken, fail safely and ask for `--force`.

Example:

```markdown
## Repo Map

<!-- agent-ready:start repo-map -->
- `src/`: application source.
- `tests/`: tests.
<!-- agent-ready:end repo-map -->
```

If a human edits inside generated markers, the next update may overwrite it. The docs should explain this clearly.

## 18. Agent Profiles

Different agents look for different context files. The tool should support profiles.

Generic output:

```text
AGENTS.md
.agents/
```

Codex profile:

```text
AGENTS.md
```

Claude Code profile:

```text
CLAUDE.md
AGENTS.md
```

Cursor profile:

```text
.cursorrules
AGENTS.md
```

Aider profile:

```text
CONVENTIONS.md
AGENTS.md
```

OpenHands profile:

```text
.openhands/
AGENTS.md
```

The profile system should not duplicate everything blindly. `AGENTS.md` should remain the source of truth. Profile files can be thin pointers:

```markdown
# Agent Instructions

Read `AGENTS.md` first. It is the canonical agent operating guide for this repo.
```

This avoids drift.

## 19. Making It Usable for Agents Everywhere

The project becomes universal by meeting agents where they already are:

1. Plain Markdown.
2. JSON metadata.
3. CLI command.
4. CI validation.
5. No required network.
6. No required API key.
7. Cross-platform behavior.
8. Stable schema.
9. Profile adapters.
10. Minimal installation friction.

### Distribution Channels

Ship through:

- npm package.
- GitHub Releases.
- Homebrew tap.
- Docker image.
- Standalone binaries.
- GitHub Action.
- Optional MCP server later.

### Install Examples

npm:

```bash
npm install -g agent-ready
agent-ready init
```

pnpm:

```bash
pnpm dlx agent-ready init
```

npx:

```bash
npx agent-ready init
```

Homebrew:

```bash
brew install agent-ready
agent-ready init
```

Docker:

```bash
docker run --rm -v "$PWD:/repo" agent-ready/cli init --root /repo
```

GitHub Action:

```yaml
name: Agent Readiness

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: agent-ready/action@v1
        with:
          command: validate
```

## 20. Repository Layout for the Tool

The tool's own repo should be organized like this:

```text
agent-ready/
  package.json
  tsconfig.json
  README.md
  AGENTS.md
  src/
    cli/
      main.ts
      commands/
        init.ts
        scan.ts
        write.ts
        validate.ts
        update.ts
        explain.ts
    core/
      scanner.ts
      facts.ts
      confidence.ts
      inventory.ts
    detectors/
      node.ts
      python.ts
      go.ts
      rust.ts
      ci.ts
      docs.ts
      risk.ts
      packageManagers.ts
    writers/
      agentsMd.ts
      jsonMetadata.ts
      profiles.ts
    validators/
      agentsMdValidator.ts
      commandValidator.ts
    utils/
      fs.ts
      paths.ts
      markdown.ts
      json.ts
  schemas/
    repo-map.schema.json
    commands.schema.json
  examples/
    node-next/
    python-fastapi/
    go-service/
    rust-cli/
  tests/
    fixtures/
    unit/
    integration/
  docs/
    profiles.md
    schema.md
    ci.md
    security.md
```

## 21. Implementation Plan

### Phase 0: Product Definition

Deliverables:

- Final name.
- CLI command naming.
- Initial schema.
- Example `AGENTS.md`.
- Supported MVP ecosystems.
- Repo license.
- Contribution policy.

Decisions:

- License should likely be MIT or Apache-2.0.
- Schemas should be versioned from day one.
- The generator should be deterministic by default.

### Phase 1: Scanner Foundation

Build:

- File inventory.
- Ignore handling.
- Safe file reading.
- Evidence model.
- Fact model.
- Confidence scoring helper.
- JSON output.

Acceptance criteria:

- `agent-ready scan --json` works in a repo.
- It respects ignore rules.
- It does not read secret-like files.
- It emits stable JSON.
- It is covered by unit tests.

### Phase 2: Node/TypeScript Support

Build:

- `package.json` parser.
- Lockfile detection.
- Script detection.
- Framework detection for React, Next.js, Vite, Express.
- TypeScript detection.
- Node version detection from `.nvmrc`, `.node-version`, `engines`.

Acceptance criteria:

- It correctly identifies pnpm, npm, yarn, and bun.
- It extracts scripts.
- It recommends install, test, lint, typecheck, build commands.
- It handles monorepo package managers reasonably.

### Phase 3: Python, Go, Rust Support

Build:

- Python detectors for `pyproject.toml`, `requirements.txt`, `uv.lock`, Poetry, pytest, ruff, mypy.
- Go detectors for `go.mod`, `go test`, modules.
- Rust detectors for `Cargo.toml`, `cargo test`, `cargo check`.

Acceptance criteria:

- It handles simple repos in each language.
- It handles mixed-language repos.
- It does not overstate confidence.

### Phase 4: Risk and CI Detection

Build:

- Risk path detector.
- Generated file detector.
- Secret path detector.
- GitHub Actions parser.
- Makefile target parser.
- justfile parser if easy.

Acceptance criteria:

- It identifies migrations and infra.
- It extracts CI validation commands.
- It includes risk notes in generated docs.

### Phase 5: Markdown Writer

Build:

- `AGENTS.md` writer.
- Stable section ordering.
- Generated markers.
- Human-edit preservation.
- Dry run diff output.

Acceptance criteria:

- `agent-ready init` creates a useful `AGENTS.md`.
- `agent-ready update` preserves unmarked human edits.
- Output is readable and concise.

### Phase 6: Validation

Build:

- Staleness check.
- Command existence check.
- File reference check.
- Schema validation.
- CI mode.

Acceptance criteria:

- `agent-ready validate` exits nonzero when generated files are stale.
- GitHub Action can use it.
- Validation output is clear enough for a developer to fix.

### Phase 7: Packaging

Build:

- npm package.
- GitHub Action wrapper.
- Release pipeline.
- Versioned schemas.
- Example repos.

Acceptance criteria:

- `npx agent-ready init` works.
- `pnpm dlx agent-ready init` works.
- GitHub Action validates a sample repo.
- Release notes are generated.

### Phase 8: Adoption Layer

Build:

- Docs site or simple documentation page.
- Badges.
- Examples.
- Agent profile docs.
- Contribution guide.
- Security policy.

Acceptance criteria:

- A maintainer can add agent readiness in under five minutes.
- An agent can read `AGENTS.md` and know what to do.
- Users can report detection gaps easily.

## 22. Testing Strategy

Testing is critical because false docs are worse than no docs.

### Unit Tests

Test each detector independently:

- Given files, returns expected evidence.
- Given evidence, returns expected facts.
- Confidence scores are stable.
- Secret-like files are not read.

### Fixture Tests

Create fixture repos:

```text
tests/fixtures/node-next-pnpm/
tests/fixtures/node-vite-npm/
tests/fixtures/python-fastapi-uv/
tests/fixtures/python-django-poetry/
tests/fixtures/go-service/
tests/fixtures/rust-cli/
tests/fixtures/monorepo-pnpm/
tests/fixtures/generic-makefile/
```

Each fixture should have expected snapshots:

```text
expected/repo-map.json
expected/AGENTS.md
```

Snapshot tests are useful here because stable docs matter.

### Integration Tests

Run the CLI against fixture repos:

```bash
agent-ready init --root tests/fixtures/node-next-pnpm --dry-run
agent-ready scan --root tests/fixtures/go-service --json
agent-ready validate --root tests/fixtures/rust-cli
```

### Mutation-Like Tests

Modify a fixture after generation:

- Remove a package script.
- Rename a directory.
- Add a lockfile conflict.
- Break generated markers.

Then verify `validate` catches the issue.

### Security Tests

Create fake secret files and verify contents are not read:

```text
.env
prod.pem
credentials.json
service-account.json
```

The scanner should record only safe metadata:

```json
{
  "path": ".env",
  "kind": "secret_like_file",
  "contentsRead": false
}
```

### Cross-Platform Tests

Run CI on:

- Ubuntu.
- macOS.
- Windows.

Path handling must be correct on Windows.

## 23. Security and Privacy

Security posture:

- Local-first.
- No network by default.
- No telemetry by default.
- No source upload.
- No secret reading.
- Clear file access rules.
- Optional LLM mode must require explicit opt-in.

Security details:

- The file inventory should skip secret-like files by content read.
- The scanner should cap file size.
- The scanner should avoid following symlinks by default unless `--follow-symlinks` is passed.
- The CLI should not execute detected project commands during scan.
- Validation may check whether scripts exist, but should not run them unless explicitly asked.
- Optional command probing should require flags like `--run-checks`.

Optional telemetry, if ever added:

- Must be opt-in.
- Must never include source code.
- Must never include file contents.
- Should only include anonymous detector success/failure metrics.

The best default is no telemetry.

## 24. LLM Assistance, Later

The tool can later support optional LLM synthesis:

```bash
agent-ready init --llm
```

Use cases:

- Summarize README into repo purpose.
- Infer architecture from structured facts.
- Draft conventions from existing docs.
- Produce better natural language descriptions.

Rules:

- Never required.
- Never send files without clear user consent.
- Show what will be sent.
- Allow local model providers.
- Save prompts for auditability.
- Mark LLM-authored sections.

Provider support could include:

- OpenAI.
- Anthropic.
- Local Ollama-compatible providers.
- Custom command provider.

But the default product should remain deterministic.

## 25. CI Integration

CI should prevent stale agent docs.

Two recommended modes:

### Advisory Mode

Warn but do not fail.

```yaml
- uses: agent-ready/action@v1
  with:
    command: validate
    mode: advisory
```

### Required Mode

Fail if docs are stale.

```yaml
- uses: agent-ready/action@v1
  with:
    command: validate
    mode: required
```

The GitHub Action should comment on pull requests with:

- What changed.
- Which generated sections are stale.
- Suggested command to fix.

Example:

```text
AGENTS.md is stale.

Run:
  npx agent-ready update

Reason:
  package.json added script "typecheck", but AGENTS.md does not mention it.
```

## 26. Human Review Workflow

The ideal workflow:

1. Developer runs `agent-ready init`.
2. Tool creates `AGENTS.md` and `.agents/`.
3. Developer reviews the diff.
4. Developer edits the human-owned sections.
5. Developer commits.
6. CI validates future freshness.

Agent workflow:

1. Agent starts in repo.
2. Agent reads `AGENTS.md`.
3. Agent uses commands and risks from the file.
4. Agent updates handoff using template.
5. If agent discovers missing repo knowledge, it suggests an update.

## 27. Monorepo Support

Monorepos are common and need special handling.

Detect:

- pnpm workspaces.
- npm workspaces.
- Yarn workspaces.
- Turborepo.
- Nx.
- Rush.
- Lerna.
- Bazel.
- Pants.

Output should include:

```markdown
## Monorepo

This repo appears to be a pnpm workspace.

Workspace packages:

- `apps/web`
- `apps/api`
- `packages/ui`
- `packages/config`

Common commands:

- Install: `pnpm install`
- Run web tests: `pnpm --filter web test`
- Build all: `pnpm build`
```

The scanner should not pretend it understands every workspace deeply in v1. It should identify structure and provide safe next steps.

## 28. Generated File Detection

Generated files are a major source of agent mistakes.

Signals:

- Paths named `generated`, `gen`, `dist`, `build`.
- File headers containing "generated".
- OpenAPI generated clients.
- Prisma generated outputs.
- GraphQL generated types.
- Protobuf generated files.
- Lockfiles.

Generated file policy:

```markdown
Avoid hand-editing generated files. Change the source schema or generator input instead, then regenerate.
```

The tool should include known generator source hints when detected:

- OpenAPI spec: `openapi.yaml`, `swagger.json`.
- Protobuf: `.proto`.
- GraphQL: `.graphql`, codegen config.
- Prisma: `schema.prisma`.

## 29. Environment Variable Detection

The tool should detect env var documentation without reading secrets.

Safe sources:

- `.env.example`
- `.env.sample`
- `.env.template`
- README docs.
- Docker Compose variable names.
- CI workflow env keys.

Unsafe sources:

- `.env`
- `.env.local`
- `.env.production`
- Secret files.

Output:

```markdown
## Environment

Environment examples:

- `.env.example`

Do not read or commit real secret files such as `.env` or `.env.local`.
```

If safe examples exist, include variable names but not values unless they are clearly placeholder values.

## 30. Versioned Schemas

Structured files should have schemas:

```text
schemas/repo-map.schema.json
schemas/commands.schema.json
```

Every JSON output should include:

```json
{
  "schemaVersion": "1.0.0"
}
```

Schema changes:

- Patch: add optional fields.
- Minor: add new fact kinds.
- Major: rename or remove fields.

This lets other agent tools safely consume the metadata.

## 31. Public API

The CLI should also expose a programmatic API.

Example:

```ts
import { scanRepo, writeAgentsMd } from "agent-ready";

const scan = await scanRepo({ root: process.cwd() });
await writeAgentsMd({ root: process.cwd(), scan });
```

Useful for:

- IDE extensions.
- Agent runtimes.
- CI tools.
- Company-internal wrappers.

The API should be documented and semver-stable after v1.

## 32. MCP Server, Later

After the CLI is reliable, build an optional MCP server:

```bash
agent-ready mcp
```

Tools:

- `get_repo_map`
- `get_commands`
- `get_risk_policy`
- `get_agent_instructions`
- `validate_agent_docs`

This would let MCP-compatible agents query repo facts directly without parsing files.

But this should come after the CLI because Markdown and JSON are more universal.

## 33. Documentation Plan

Docs needed:

```text
README.md
docs/getting-started.md
docs/cli.md
docs/config.md
docs/profiles.md
docs/schemas.md
docs/security.md
docs/ci.md
docs/examples.md
docs/contributing-detectors.md
```

README sections:

- What it is.
- Why agents need it.
- Quick start.
- Example output.
- Supported ecosystems.
- Safety model.
- CI usage.
- Agent profiles.
- Contributing.

The docs should include before and after examples:

Before:

```text
Agent enters repo and guesses commands.
```

After:

```text
Agent reads AGENTS.md and immediately knows setup, tests, risks, and conventions.
```

## 34. Configuration File

Support an optional config:

```text
agent-ready.config.json
```

Example:

```json
{
  "schemaVersion": "1.0.0",
  "profile": ["generic", "codex", "claude"],
  "ignore": ["examples/legacy/**"],
  "riskPaths": ["billing/**", "infra/**"],
  "generatedPaths": ["src/generated/**"],
  "commands": {
    "install": "pnpm install",
    "test": "pnpm test",
    "lint": "pnpm lint"
  },
  "sections": {
    "purpose": "Customer billing service."
  }
}
```

Config should override detected facts where humans know better.

## 35. Handling Existing AGENTS.md

If `AGENTS.md` already exists:

- Do not overwrite by default.
- Parse generated markers if present.
- If no markers exist, offer `--merge` or `--force`.
- In dry run, show proposed additions.

Behavior:

```text
AGENTS.md already exists and does not appear to be generated by agent-ready.
No changes written.

Run with:
  agent-ready update --merge
or:
  agent-ready init --force
```

Merge should append generated sections under a clearly marked heading.

## 36. Output Quality Rules

Generated `AGENTS.md` should be:

- Useful within 30 seconds.
- Short enough to read.
- Specific enough to act on.
- Honest about uncertainty.
- Free of marketing language.
- Stable across runs.
- Easy to review in diffs.

Bad output:

```markdown
This is a modern scalable application with robust architecture.
```

Good output:

```markdown
This appears to be a Next.js app using pnpm. The main route files are under `app/`, shared UI is under `components/`, and tests use Vitest.
```

## 37. Release Plan

### Pre-Alpha

Goal:

- Prove scanner and writer on 10 real repos.

Deliver:

- Local CLI.
- Node support.
- Initial `AGENTS.md`.

### Alpha

Goal:

- Let early users try it.

Deliver:

- npm package.
- GitHub repo.
- Basic docs.
- Node, Python, Go, Rust support.
- Issue templates.

### Beta

Goal:

- Make it trustworthy enough for teams.

Deliver:

- CI action.
- Human edit preservation.
- Validation.
- Config file.
- Monorepo support.
- Security docs.

### v1.0

Goal:

- Stable schemas and CLI.

Deliver:

- Semver API.
- Versioned schemas.
- Cross-platform tests.
- Profile adapters.
- Clear support matrix.
- Release automation.

## 38. Launch Strategy

Launch audiences:

- AI coding agent users.
- Open source maintainers.
- Developer tooling communities.
- Platform engineering teams.
- Coding agent vendors.

Launch assets:

- Demo video.
- Example PR adding `AGENTS.md` to a repo.
- Blog post: "Make Your Repo Legible to AI Agents."
- Docs site.
- GitHub Action badge.
- Example generated files.

Launch message:

> Stop making every AI agent rediscover your repo. Generate a durable operating manual once, keep it fresh in CI, and let any agent start with the right context.

## 39. Adoption Flywheel

The product gets more valuable as more repos include `AGENTS.md`.

Flywheel:

1. Maintainer runs `agent-ready init`.
2. Repo gains `AGENTS.md`.
3. Agents perform better in that repo.
4. Maintainers see fewer bad automated PRs.
5. More maintainers add it.
6. Agent vendors learn to read `AGENTS.md` by default.
7. `AGENTS.md` becomes a standard convention.

To accelerate this:

- Publish excellent examples.
- Make adding it a tiny PR.
- Build a GitHub Action.
- Encourage agent vendors to support it.
- Keep the format simple and non-proprietary.

## 40. Vendor-Neutral Standardization

The project should avoid being tied to one agent vendor.

Rules:

- Use `AGENTS.md` as the canonical file.
- Keep schemas open.
- Avoid proprietary metadata unless placed under profile files.
- Accept contributions from many agent communities.
- Document how other tools can consume the files.

Long-term, propose a lightweight community spec:

```text
AGENTS.md
.agents/repo-map.json
.agents/commands.json
```

The spec should be permissive, not bureaucratic.

## 41. Success Metrics

Usage metrics if measured manually:

- GitHub stars.
- npm downloads.
- Repos containing generated `AGENTS.md`.
- CI action usage.
- Community detector contributions.
- Agent vendor support.

Quality metrics:

- Detection accuracy across fixtures.
- False positive rate for commands.
- Number of supported ecosystems.
- Number of stale-doc cases caught by validation.
- Time from empty repo to useful `AGENTS.md`.

Agent impact metrics:

- Fewer failed setup attempts.
- Fewer wrong test commands.
- Fewer edits to generated files.
- Faster first useful diff.
- Better handoffs.

## 42. Risks and Mitigations

### Risk: Generated docs are wrong

Mitigation:

- Confidence scores.
- Evidence links.
- Validation.
- Dry runs.
- Human review.
- Conservative phrasing.

### Risk: The tool overwrites human docs

Mitigation:

- Generated markers.
- No overwrite by default.
- Preserve unmarked sections.
- Require `--force`.

### Risk: Agents rely on stale instructions

Mitigation:

- `agent-ready validate`.
- CI action.
- Generated timestamps.
- Staleness checks.

### Risk: The scanner reads secrets

Mitigation:

- Secret path denylist.
- Content read caps.
- Safe metadata only.
- Security tests.

### Risk: Too many ecosystems make the tool shallow

Mitigation:

- Start with focused support.
- Make detectors modular.
- Publish contribution guide.
- Label unsupported cases honestly.

### Risk: Agent vendors ignore it

Mitigation:

- Keep the format simple.
- Make it useful without integration.
- Add profile adapters.
- Build community examples.

## 43. Detailed Development Checklist

Initial setup:

- Create repo.
- Add TypeScript config.
- Add CLI entrypoint.
- Add test framework.
- Add formatter.
- Add linting.
- Add CI.
- Add release tooling.
- Add license.
- Add README.
- Add initial `AGENTS.md` for the project itself.

Scanner:

- Implement safe file walk.
- Respect ignore files.
- Add default ignores.
- Add max file count.
- Add max file size.
- Add symlink behavior.
- Add evidence collection.
- Add fact model.
- Add confidence scoring.

Detectors:

- Node detector.
- Python detector.
- Go detector.
- Rust detector.
- Package manager detector.
- Framework detector.
- Command detector.
- CI detector.
- Docs detector.
- Risk detector.
- Generated file detector.
- Env example detector.

Writers:

- Markdown writer.
- JSON writer.
- Generated markers.
- Stable sorting.
- Profile pointer files.
- Dry run output.

Validators:

- Schema validator.
- File reference validator.
- Command reference validator.
- Staleness validator.
- Marker validator.

CLI:

- `init`.
- `scan`.
- `write`.
- `update`.
- `validate`.
- `explain`.
- `--root`.
- `--dry-run`.
- `--json`.
- `--force`.
- `--profile`.
- `--config`.

Docs:

- Quick start.
- CLI reference.
- Config reference.
- Generated file examples.
- Security policy.
- Contribution guide.
- Detector guide.
- Profile guide.

Distribution:

- npm publish.
- GitHub Releases.
- GitHub Action.
- Homebrew tap later.
- Docker image later.
- Standalone binaries later.

Community:

- Issue templates.
- Detector request template.
- Fixture contribution guide.
- Roadmap.
- Changelog.
- Discussions.

## 44. First 7-Day Build Plan

### Day 1

- Scaffold TypeScript CLI.
- Add `scan --json`.
- Add file inventory.
- Add default ignore rules.
- Add basic fact schema.

### Day 2

- Add Node detector.
- Detect package manager.
- Detect package scripts.
- Detect TypeScript and common frameworks.
- Add fixture tests.

### Day 3

- Add Python, Go, Rust basic detectors.
- Add Makefile target detection.
- Add command model.
- Add confidence scoring.

### Day 4

- Build `AGENTS.md` writer.
- Add generated markers.
- Add `.agents/repo-map.json`.
- Add `.agents/commands.json`.
- Add `init`.

### Day 5

- Add `update`.
- Preserve human edits.
- Add `validate`.
- Add stale command detection.
- Add dry run mode.

### Day 6

- Add CI detector.
- Add risk detector.
- Add env example detector.
- Add docs extraction.
- Polish output.

### Day 7

- Package for npm.
- Write README.
- Add examples.
- Test on real repos.
- Cut alpha release.

## 45. First Version Acceptance Criteria

The first alpha is good enough when:

- It runs with one command in a typical repo.
- It produces a useful `AGENTS.md`.
- It does not require an API key.
- It does not read secret contents.
- It detects Node, Python, Go, and Rust basics.
- It preserves human edits on update.
- It has tests for fixture repos.
- It has a clear README.
- It can be published as an npm package.

It does not need perfect framework understanding. It needs trustworthiness, usefulness, and a clean extension path.

## 46. Example Generated Output

```markdown
# AGENTS.md

## Purpose

This appears to be a TypeScript web application using Next.js and pnpm.

## Repo Map

<!-- agent-ready:start repo-map -->
- `app/`: Next.js app routes.
- `components/`: shared React components.
- `lib/`: shared application utilities.
- `tests/`: test files.
- `.github/workflows/`: CI workflows.
<!-- agent-ready:end repo-map -->

## Setup

<!-- agent-ready:start setup -->
- Package manager: pnpm.
- Install dependencies with `pnpm install`.
- Node version is defined in `.nvmrc`.
<!-- agent-ready:end setup -->

## Common Commands

<!-- agent-ready:start commands -->
- Lint: `pnpm lint`
- Typecheck: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`
<!-- agent-ready:end commands -->

## Risky Areas

<!-- agent-ready:start risks -->
- `prisma/migrations/`: database migrations; review carefully.
- `.github/workflows/`: CI changes can affect deployment and validation.
- `src/generated/`: generated files; update the generator source instead of hand-editing.
<!-- agent-ready:end risks -->

## Agent Workflow

1. Read this file before editing.
2. Inspect nearby code and tests before making changes.
3. Run the smallest relevant validation command.
4. Summarize changed files, validation, and remaining risks in the final handoff.
```

## 47. Why This Can Win

This idea can win because it is:

- Small enough to build quickly.
- Useful immediately.
- Vendor-neutral.
- Easy to adopt.
- Easy to review.
- Compatible with all agents.
- Valuable for both humans and machines.
- Expandable into schemas, CI, profiles, and MCP later.

Most importantly, it solves a real daily pain: agents enter repos under-informed. A durable repo operating manual is one of the highest-leverage pieces of infrastructure the agent ecosystem needs.

## 48. Final Positioning

The positioning should be:

> Agent-ready repos start with `AGENTS.md`.

The product should make that sentence true.

The first release should focus on generating the file. The second release should keep it fresh. The third release should make it a standard consumed by every serious coding agent.

Build the boring thing. Make it reliable. Make it portable. Make it the default first file every agent reads.
