# Roadmap

This roadmap is intentionally practical. The goal is to make `agent-ready`
boring, portable infrastructure for coding agents.

## v0.1

Status: complete for initial release.

- Generate `AGENTS.md`.
- Write `.agents` metadata.
- Support deterministic scanners for Node.js, Python, Go, Rust, Makefile, justfile, Taskfile, and common CI providers.
- Add fixture coverage for Rails, Django, Java/Spring Boot, and .NET.
- Detect npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.
- Preserve human edits through generated markers.
- Add strict validation plus metadata and runtime report schemas.
- Add `agent-ready context` compact onboarding packets.
- Add `agent-ready doctor` readiness diagnostics.
- Add `agent-ready status` compact dashboards for readiness, worktree, validation, recipes, and CI adoption.
- Add `agent-ready impact` planned-path and git-changed risk and validation guidance.
- Add `agent-ready handoff` transfer packet generation.
- Add `agent-ready preflight` one-shot readiness, impact, validation, and handoff guidance.
- Add `agent-ready run` structured validation receipts for discovered commands.
- Add `agent-ready recipes` for built-in copy-paste and machine-readable adoption loops.
- Add `agent-ready schemas` for discoverable JSON Schema contracts.
- Add `agent-ready verify-contract` for local validation of saved JSON reports.
- Add `agent-ready add-to-ci` for GitHub Actions workflow generation.
- Add CI receipt artifacts for status dashboards and contract verification.
- Add `agent-ready ci-status` for summarizing downloaded CI receipt artifacts.
- Expose doctor readiness through MCP resource and tool surfaces.
- Expose status dashboards through MCP resource and tool surfaces.
- Expose impact guidance through an MCP tool.
- Expose handoff packet generation through an MCP tool.
- Expose preflight guidance through an MCP tool.
- Add safer stale-file reference validation for `AGENTS.md`.
- Add `agent-ready config init` to generate a starter config.
- Add a read-only stdio MCP server exposing agent docs and metadata.
- Expose context packets through MCP resources.
- Add MCP resource templates, prompts, and a client configuration example.
- Add MCP client recipes for installed-package, source-checkout, multi-repo, and command/args host setups.
- Add a maintainer adoption playbook from first scan to CI receipts.
- Add copy-paste and machine-readable adoption recipes for Codex, Claude, Cursor, and terminal agents.
- Expose built-in adoption recipes through MCP resources.
- Expose JSON Schema contracts through MCP resources.
- Add MCP compatibility smoke tests for context packets, doctor readiness, impact guidance, handoff guidance, preflight guidance, stdio launch patterns, and multi-repo isolation.
- Add examples, snapshots, package smoke checks, release notes, and install smoke checks.
- Add JSON output stability tests for `.agents` metadata.

## v0.2

Status: in progress.

Focus: broader repo coverage and better update ergonomics.

- Add first-class workspace package summaries through `agent-ready workspaces`, `.agents/workspaces.json`, JSON Schema, and MCP.
- Map `impact` and `preflight` paths back to affected workspace packages with scoped validation suggestions.
- Add direct affected package lookup through `agent-ready affected`, `agent-ready workspaces --changed`, JSON Schema, and MCP.
- Add first external-repo dogfood pass with `laravel/laravel`.
- Add Composer and Laravel detection, Artisan commands, Pint/PHPUnit hints, Laravel directory roles, and Laravel fixture snapshots.
- Add external Symfony dogfood with `symfony/demo`.
- Add Symfony detection, console/PHPUnit/PHP-CS-Fixer/PHPStan command guidance, Symfony directory roles, and Symfony fixture snapshots.
- Add external Pest dogfood with `pestphp/pest`.
- Add Pest detection, richer Composer script aliases, safer README purpose extraction for blockquoted announcements, and generic Composer/Pest fixture snapshots.
- Add external Ruby gem dogfood with `rubocop/rubocop`.
- Add Ruby gem detection for gemspecs, RSpec, RuboCop, Rake tasks, executable entrypoints, and Ruby gem fixture snapshots.
- Add external Minitest Ruby gem dogfood with `rack/rack`.
- Add Minitest detection, Rake `test`/`ci` command guidance, and Minitest Ruby gem fixture snapshots.
- Continue improving monorepo update ergonomics around affected package detection.
- Add more fixture repos for generic Composer libraries without frameworks, Pest plugin variants, mobile apps, and polyglot monorepos.

## v0.3

Focus: agent integrations.

- Add compatibility notes from real-world agent host testing.
- Add profile adapters for more coding agents.
- Add a docs page explaining the `AGENTS.md` convention.

## Later

- Optional LLM-assisted summaries with explicit opt-in.
- Standalone binaries.
- Homebrew distribution.
- Docker image.
- Community-maintained detector packs.

## Principles

- Deterministic first, LLM-assisted second.
- No network by default.
- No telemetry by default.
- No secret content reads.
- Human-edit preservation over aggressive regeneration.
- Vendor-neutral Markdown and JSON before proprietary integrations.
