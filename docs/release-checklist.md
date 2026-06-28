# Release Checklist

Use this checklist before publishing `agent-ready`.

## Preflight

Run the full local gate:

```bash
npm run ci
```

The CI gate runs:

```bash
npm test
npm run snapshots:check
npm run validate:strict
npm run doctor:strict
npm run mcp:compat
npm run package:check
npm run package:install-smoke
npm run release:notes:check
```

## Registry Readiness

Before the first public publish:

- Confirm `@ahmedshaikh/agent-ready` is still available on npm with
  `npm view @ahmedshaikh/agent-ready version` or
  `pnpm view @ahmedshaikh/agent-ready version`; a 404 means the scoped name is
  unclaimed.
- Confirm the publishing shell is logged in with `npm whoami` or `pnpm whoami`.
- Confirm `package.json#publishConfig.access` is `public`.
- Confirm `package.json#repository`, `homepage`, and `bugs.url` point to
  `https://github.com/RaziStuff/agent-ready`.

## Package Smoke Check

`npm run package:check` runs `scripts/package-smoke.js`.

It verifies:

- Required `package.json` fields exist.
- Public npm publish metadata points at the GitHub repository.
- `bin.agent-ready` points to `src/cli/main.js`.
- The CLI supports top-level `--version`.
- Required package files exist and are allowlisted in `package.json#files`.
- Metadata and runtime report schemas are present and valid JSON.
- Maintainer adoption playbook is present and references init, CI adoption, receipts, and rollback.
- MCP client recipe docs are present.
- Agent adoption recipe docs and JSON are present.
- A temporary repo can run `agent-ready init`.
- The generated temp repo returns a usable `agent-ready status --json` dashboard.
- The generated temp repo returns a usable `agent-ready context` onboarding packet.
- The generated temp repo returns a usable `agent-ready workspaces --json` workspace report.
- The generated temp repo returns a usable `agent-ready affected --json` affected workspace report.
- The generated temp repo returns usable `agent-ready impact --json` path guidance for explicit and git-changed paths, including affected workspace fields.
- The generated temp repo returns usable `agent-ready handoff --json` transfer guidance for explicit and git-changed paths.
- The generated temp repo returns usable `agent-ready preflight --json` readiness, affected workspace, and validation guidance for explicit and git-changed paths.
- The generated temp repo can run a configured low-risk command through `agent-ready run --json` and return a passing receipt.
- The CLI can print built-in adoption recipes through `agent-ready recipes` and `agent-ready recipes --json`.
- The CLI can print the schema catalog and raw schemas through `agent-ready schemas --json`, `agent-ready schemas status --json`, `agent-ready schemas workspaces --json`, and `agent-ready schemas affected --json`.
- The CLI can validate a saved JSON report through `agent-ready verify-contract <file> --schema status --json`.
- The CLI can summarize saved status and contract receipts through `agent-ready ci-status --json`.
- The CLI can preview and write a GitHub Actions workflow through `agent-ready add-to-ci`, including status and contract receipt artifact steps.
- The generated temp repo passes `agent-ready validate --strict`.
- The generated temp repo returns a usable `agent-ready doctor --json` readiness report.
- The MCP server lists static resources, including `agent-ready://status`, `agent-ready://context`, `agent-ready://workspaces`, and `agent-ready://doctor`, resource templates, and prompts.
- The MCP server returns a usable status dashboard through `agent-ready://status` and `agent_ready_status`.
- The MCP server returns a usable context packet through `agent-ready://context`.
- The MCP server returns usable workspace metadata through `agent-ready://workspaces` and `agent_ready_workspaces`.
- The MCP server returns usable affected package guidance through `agent_ready_affected`.
- The MCP server returns built-in adoption recipes through `agent-ready://recipes` and `agent-ready://recipes-json`.
- The MCP server returns schema contracts through `agent-ready://schemas` and `agent-ready://schema/{id}`.
- The MCP server returns usable doctor, impact, handoff, and preflight reports through resource and tool calls, including git-changed impact mode.

The smoke test does not publish, install dependencies, or contact the network.

## MCP Compatibility Smoke Check

`npm run mcp:compat` runs `scripts/mcp-compat-smoke.js`.

It verifies:

- A source-checkout MCP launch can initialize and serve static resources.
- The server accepts notification messages without producing responses.
- The context packet resource returns compact onboarding guidance.
- The status resource and tool return compact readiness, worktree, validation, recipe, and CI adoption guidance.
- The workspace resource and tool return package summaries and package-scoped command suggestions.
- The affected tool returns package ownership and scoped command suggestions for planned or git-changed paths.
- Resource templates can read discovered docs, commands, and risk metadata.
- Prompts can be listed and fetched with arguments.
- Tools can return status dashboards, workspace summaries, repo summaries, doctor readiness, explicit-path and git-changed impact guidance with affected packages, handoff packets, preflight guidance, and strict validation results over stdio.
- Absolute command paths work when the host launches from another directory.
- Separate server entries for different repo roots do not leak repo context.

## Package Install Smoke Check

`npm run package:install-smoke` runs `scripts/package-install-smoke.js`.

It verifies:

- A real `.tgz` tarball can be created from the package.
- The local tarball installs into a fresh temporary project.
- The installed `node_modules/.bin/agent-ready` supports `--version`.
- The installed bin can run `init` in a separate temporary target repo.
- The installed bin can return a usable `status --json` dashboard.
- The installed bin can return a usable `context` onboarding packet.
- The installed bin can return a usable `workspaces --json` report.
- The installed bin can return a usable `affected --json` report.
- The installed bin can return usable `impact --json` path guidance for explicit and git-changed paths, including affected workspace fields.
- The installed bin can return usable `handoff --json` transfer guidance for explicit and git-changed paths.
- The installed bin can return usable `preflight --json` readiness, affected workspace, and validation guidance for explicit and git-changed paths.
- The installed bin can run a configured low-risk command through `run --json` and return a passing receipt.
- The installed bin can print built-in adoption recipes through `recipes` and `recipes --json`.
- The installed bin can print schema contracts through `schemas --json`, `schemas status --json`, `schemas workspaces --json`, and `schemas affected --json`.
- The installed bin can validate a saved JSON report through `verify-contract <file> --schema status --json`.
- The installed bin can summarize saved status and contract receipts through `ci-status --json`.
- The installed bin can preview and write a GitHub Actions workflow through `add-to-ci`, including status and contract receipt artifact steps.
- The generated target repo passes `validate --strict`.
- The installed bin can return a usable `doctor --json` readiness report.
- The installed bin MCP server can return usable explicit-path and git-changed impact guidance through `agent_ready_impact`.
- The installed bin MCP server can return usable handoff packets through `agent_ready_handoff`.
- The installed bin MCP server can return usable preflight guidance through `agent_ready_preflight`.
- The installed bin MCP server can return usable workspace guidance through `agent-ready://workspaces` and `agent_ready_workspaces`.
- The installed bin MCP server can return usable affected package guidance through `agent_ready_affected`.
- The installed bin MCP server can return built-in adoption recipes through `agent-ready://recipes`.
- The installed bin MCP server can return schema contracts through `agent-ready://schemas`.

The install smoke uses `npm` or `pnpm`. Set `AGENT_READY_PACKAGE_MANAGER` to an
explicit npm or pnpm executable in constrained environments.

## Package Contents

The publish allowlist should include:

- `src/`
- `schemas/`
- `docs/`
- `action.yml`
- `agent-ready.config.example.json`
- `AGENTS.md`
- `CHANGELOG.md`
- `CONTRIBUTING.md`
- `RELEASE_NOTES.md`
- `SECURITY.md`
- `README.md`
- `LICENSE`

Keep examples and tests out of the npm package unless they become part of the
runtime interface.

## Versioning

For `0.x` releases:

- Patch version: bug fixes, detector refinements, docs.
- Minor version: new commands, schema additions, profile support.
- Major version later: breaking CLI or schema changes after `1.0.0`.

Update `package.json` and confirm `agent-ready --version` returns the same
version.

## Publish Dry Run

When npm is available, inspect the package before publishing:

```bash
npm pack --dry-run
```

Check that the file list matches the package contents section.

## Release Notes

Generate the draft release notes from repo metadata:

```bash
npm run release:notes:write
```

Check them before publishing:

```bash
npm run release:notes:check
```

The generated `RELEASE_NOTES.md` includes the package version, CLI surface,
example coverage, JSON schemas, verification commands, package surface, and
known limitations.

## Publish

After the dry run looks correct:

```bash
npm publish
```

For a first public release, publish from a clean working tree and tag the
release after npm accepts it.

## Post-Publish

Smoke test the published package:

```bash
npx agent-ready --version
npx agent-ready init --dry-run
```

Then create a release note with:

- Version.
- Highlights.
- Supported ecosystems.
- Known limitations.
- Validation command used before publish.
