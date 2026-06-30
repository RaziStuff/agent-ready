# Agent Ready Adoption Playbook

This playbook is for maintainers and setup agents adopting `agent-ready` in a
real repository. It turns a repo with no agent contract into one with:

- `AGENTS.md` as the canonical operating guide.
- `.agents/` metadata for repo maps, commands, risk policy, and handoff shape.
- Local readiness checks through `doctor`, `status`, and `validate`.
- CI enforcement through a generated GitHub Actions workflow.
- Machine-readable CI receipts and a local summary command.

Use the steps in order for a first adoption. For an existing adoption, start at
the maintenance checklist near the end.

## 1. Install Or Select A Checkout

From an installed package:

```bash
agent-ready --version
```

From a source checkout:

```bash
node src/cli/main.js --version
```

For the commands below, use `agent-ready` when installed. Use
`node src/cli/main.js` when working from this repository checkout.

## 2. Inspect The Repo Without Writing

Start with read-only commands. They do not execute project commands.

```bash
agent-ready scan --json
agent-ready status --json
agent-ready doctor --json
```

Look for:

- The repo purpose is recognizable.
- Package managers and primary language look right.
- Useful validation commands were detected.
- Risk paths include migrations, CI, infra, generated files, lockfiles, and
  secret-like files when present.

If the scan misses important context, add maintainer config before generating
docs.

## 3. Create Maintainer Config

Generate a starter config:

```bash
agent-ready config init
```

Edit `agent-ready.config.json` when maintainers know better than the scanner.
Common useful overrides:

- `sections.purpose`: the short repo purpose agents should preserve.
- `sections.conventions`: repo-specific coding expectations.
- `commands`: preferred validation commands by stable names.
- `riskPaths`: domain-specific sensitive paths.
- `generatedPaths`: generated outputs agents should avoid editing directly.
- `profiles`: thin pointers for tools such as Claude, Cursor, Aider, or
  OpenHands.

Check the config contract when needed:

```bash
agent-ready schemas config --json
```

## 4. Generate Agent Docs

Create `AGENTS.md` and `.agents/` metadata:

```bash
agent-ready init
```

Use `update` after config changes or scanner improvements:

```bash
agent-ready update
```

Generated sections are marker-wrapped so human edits outside those sections are
preserved.

## 5. Validate The Local Adoption

Run the strict local gate:

```bash
agent-ready validate --strict
agent-ready doctor --strict
agent-ready status --json
```

Expected result:

- `validate --strict` exits 0.
- `doctor --strict` reports `ready`.
- `status --json` returns an `ok: true` dashboard unless the current worktree
  has high-impact changes that need review or validation.

If strict validation fails, fix stale docs or metadata first:

```bash
agent-ready update
agent-ready validate --strict
```

## 6. Teach Agents The Local Loop

Use the built-in recipes:

```bash
agent-ready recipes
agent-ready recipes --json
```

For a normal coding task, agents should use:

```bash
agent-ready status --json
agent-ready context --json
agent-ready workspaces --json
agent-ready affected --json <repo-relative-path>
agent-ready doctor --strict --json
agent-ready impact --json <repo-relative-path>
agent-ready preflight --json
agent-ready run <command-name> --json
agent-ready handoff --changed --json
```

In monorepos, `agent-ready workspaces --json` helps agents choose the affected
package and package-scoped validation command before running broad workspace
checks.

`agent-ready impact --json <path>` and `agent-ready preflight --json` also
include affected workspace packages when changed paths sit inside a workspace
package, so agents can cite the package owner and scoped command in handoffs.
Use `agent-ready affected --json <path>` or `agent-ready workspaces --changed --json`
when the agent only needs package ownership and package-scoped commands.

Commands that require network access or write files require explicit approval:

```bash
agent-ready run <command-name> --allow-network --allow-writes --json
```

Only pass those flags when the user or maintainer approved the side effects.

## 7. Preview CI Adoption

Preview the workflow before writing anything:

```bash
agent-ready add-to-ci --json --uses RaziStuff/agent-ready@v0.2.7
```

Confirm:

- `actionRef` points at the real package, repo action, or pinned release.
- `mode` is right for the repo.
- `strict` matches maintainer expectations.
- Receipt artifacts are enabled unless maintainers explicitly opt out.
- The workflow path is `.github/workflows/agent-ready.yml` or another approved
  repo-local path.

Early adoption can be advisory:

```bash
agent-ready add-to-ci --json --mode advisory --no-strict --uses RaziStuff/agent-ready@v0.2.7
```

Use `--no-artifacts` only when the repo does not want readiness receipts
uploaded.

## 8. Write The CI Workflow

After review, write the workflow:

```bash
agent-ready add-to-ci --write --uses RaziStuff/agent-ready@v0.2.7
```

If replacing an existing workflow is intentional:

```bash
agent-ready add-to-ci --write --force --uses RaziStuff/agent-ready@v0.2.7
```

The generated workflow:

- Runs `agent-ready validate`.
- Writes `agent-ready-status.json`.
- Verifies that status receipt with the `status` JSON Schema.
- Writes `agent-ready-contract.json`.
- Uploads both files as the `agent-ready-receipts` artifact.

## 9. Read CI Receipts

After CI runs, download the `agent-ready-receipts` artifact and summarize it:

```bash
agent-ready ci-status \
  --status-file agent-ready-status.json \
  --contract-file agent-ready-contract.json
```

Machine-readable summary:

```bash
agent-ready ci-status \
  --status-file agent-ready-status.json \
  --contract-file agent-ready-contract.json \
  --json
```

Use the summary to answer:

- Did agent readiness pass?
- Did the status receipt match the published schema?
- How many changed paths were detected?
- Which validation receipts are recommended?
- What next step should an agent or maintainer take?

## 10. Use In PRs And Handoffs

A PR or handoff should include:

- `agent-ready status` result.
- `agent-ready doctor --strict` result.
- `agent-ready preflight` result for current changes.
- Validation receipt command, status, duration, and exit code.
- `agent-ready ci-status` summary when CI artifacts are available.
- Remaining risks, skipped validation, and the next step.

Suggested handoff commands:

```bash
agent-ready preflight --json
agent-ready handoff --changed
```

## 11. Maintain The Adoption

Run this when repo structure, commands, CI, generated paths, or agent rules
change:

```bash
agent-ready update
agent-ready validate --strict
agent-ready doctor --strict
```

Refresh CI when action references, strictness, artifact policy, or workflow path
changes:

```bash
agent-ready add-to-ci --json --uses RaziStuff/agent-ready@v0.2.7
agent-ready add-to-ci --write --force --uses RaziStuff/agent-ready@v0.2.7
```

Before publishing a package change to `agent-ready` itself:

```bash
npm run ci
pnpm pack --dry-run
```

## 12. Troubleshooting

`validate --strict` fails:

- Run `agent-ready update`.
- Check whether `AGENTS.md` references deleted local files.
- Check whether `.agents/repo-map.json` or `.agents/commands.json` is stale.

`doctor --strict` reports warnings:

- Decide whether the warning should block adoption.
- Add config overrides when scanner output is too generic.
- Use advisory CI mode during early rollout if warnings need time to resolve.

`add-to-ci --write` refuses to overwrite:

- Review the existing workflow.
- Use `--force` only when replacement is intentional.

`ci-status` reports missing artifacts:

- Confirm the workflow uploaded `agent-ready-receipts`.
- Confirm artifact download preserved `agent-ready-status.json` and
  `agent-ready-contract.json`.
- Re-run with explicit `--status-file` and `--contract-file` paths.

`verify-contract` reports schema issues:

- Confirm the report file came from the matching command.
- Fetch the schema with `agent-ready schemas <schema-id> --json`.
- Treat schema drift as a compatibility issue before relying on automation.

## 13. Rollback

To pause enforcement without deleting agent docs:

```bash
agent-ready add-to-ci --write --force --mode advisory --no-strict --uses RaziStuff/agent-ready@v0.2.7
```

To stop CI adoption, remove `.github/workflows/agent-ready.yml`. Keep
`AGENTS.md`, `.agents/`, and `agent-ready.config.json` unless maintainers are
intentionally removing agent support.

## 14. Adoption Definition Of Done

Adoption is complete when:

- `AGENTS.md` exists and has reviewed maintainer context.
- `.agents/repo-map.json` and `.agents/commands.json` exist.
- `agent-ready validate --strict` passes.
- `agent-ready doctor --strict` reports ready.
- `agent-ready add-to-ci --json` previews the intended workflow.
- `.github/workflows/agent-ready.yml` is committed when CI adoption is desired.
- CI uploads `agent-ready-receipts`.
- `agent-ready ci-status` can summarize downloaded receipts.
- Agent instructions or repo rules point agents to `agent-ready status`,
  `context`, `preflight`, `run`, and `handoff`.
