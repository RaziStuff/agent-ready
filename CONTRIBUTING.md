# Contributing

Thanks for helping make repos easier for agents to understand.

## Development Setup

This project is dependency-light. The core CLI runs on Node.js without install-time
runtime dependencies.

Run the main checks:

```bash
npm run ci
```

Useful individual commands:

```bash
npm test
npm run snapshots:check
npm run snapshots:update
npm run validate:strict
npm run package:check
npm run package:install-smoke
npm run release:notes:check
```

## Project Structure

- `src/core/`: scanning, config, inventory, and detection logic.
- `src/writers/`: `AGENTS.md` and `.agents` metadata writers.
- `src/validators/`: validation and metadata shape checks.
- `src/cli/`: command-line entrypoint.
- `examples/`: fixture repos used to prove generated output quality.
- `tests/snapshots/`: expected generated `AGENTS.md` output.
- `schemas/`: JSON schema documentation for generated metadata and config.
- `scripts/`: release, package, and snapshot helper scripts.

## Adding or Updating Detectors

When adding a detector:

1. Keep detection deterministic and local-first.
2. Prefer explicit repo evidence such as manifests, lockfiles, scripts, config files, and CI.
3. Avoid reading secret-like files.
4. Add or update a fixture under `examples/`.
5. Update generated snapshots with `npm run snapshots:update`.
6. Add focused unit tests when the behavior is not covered by snapshots.

Detection should be conservative. If confidence is low, omit the claim from the
main `AGENTS.md` or label it as likely.

## Updating Generated Output

If `AGENTS.md` writer output changes intentionally:

```bash
npm run snapshots:update
npm test
```

Review the snapshot diff carefully. The generated guide is the user-facing
product, so wording changes should be deliberate.

## Config and Schemas

When changing `agent-ready.config.json` behavior, update:

- `agent-ready.config.example.json`
- `schemas/config.schema.json`
- README configuration docs
- tests for config overrides

When changing generated metadata shape, update:

- `schemas/repo-map.schema.json`
- `schemas/commands.schema.json`
- `src/validators/metadata-schema.js`
- validation tests

## Release Checks

Before release, run:

```bash
npm run ci
pnpm pack --dry-run
```

`npm run package:install-smoke` creates a real tarball, installs it into a temp
project, and runs the installed CLI. In constrained environments, set:

```bash
AGENT_READY_PACKAGE_MANAGER=/path/to/npm-or-pnpm npm run package:install-smoke
```

See `docs/release-checklist.md` for the full release workflow.

## Pull Requests

PRs should include:

- Summary of behavior changed.
- Validation commands run.
- Snapshot updates when generated output changes.
- Notes about risk areas such as CI, schemas, package metadata, or release tooling.
