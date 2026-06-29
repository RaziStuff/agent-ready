# Agent Adoption Recipes

These recipes are for coding agents and agent hosts that need a predictable
loop for using `agent-ready` in any repository. The same recipes are available
as machine-readable JSON in `docs/agent-recipes.json`.

For maintainer setup from first scan to CI receipts, use
`docs/adoption-playbook.md`.

From an installed package, agents can also read the same built-in recipes with:

```bash
agent-ready recipes
agent-ready recipes --json
agent-ready recipes cli-task-loop
```

MCP clients can read `agent-ready://recipes` or `agent-ready://recipes-json`.

Replace `/absolute/path/to/repo`, `src/example.js`, and `test` with the target
repo root, planned path, and discovered command name.

## Universal CLI Loop

Use this when the agent can run local commands.

```bash
agent-ready status --root /absolute/path/to/repo --json
agent-ready context --root /absolute/path/to/repo --json
agent-ready workspaces --root /absolute/path/to/repo --json
agent-ready affected --root /absolute/path/to/repo --json src/example.js
agent-ready doctor --root /absolute/path/to/repo --strict --json
agent-ready impact --root /absolute/path/to/repo --json src/example.js
agent-ready preflight --root /absolute/path/to/repo --json
agent-ready run test --root /absolute/path/to/repo --json
agent-ready handoff --root /absolute/path/to/repo --changed --json
```

Agent behavior:

- Treat `context` as the first briefing: purpose, docs, commands, risks, and recommended workflow.
- Use `status` when the agent needs one dashboard for readiness, current changes, validation receipts, recipes, and CI adoption.
- Use `workspaces` in monorepos to choose package-scoped validation before reaching for repo-wide checks.
- Use `affected` when you only need the workspace packages touched by current or planned paths.
- Treat `doctor --strict` failures as blockers until the user or maintainer accepts the risk.
- Run `impact` before editing known paths, especially migrations, infra, CI, generated files, lockfiles, secret-like paths, and workspace package paths.
- Use `impact` and `preflight` affected workspace output to choose package-scoped validation in monorepos.
- Run `preflight` before handoff so the final answer includes readiness, changed-path impact, affected workspaces, and validation guidance.
- Run `run <command-name>` only for discovered or configured command names.
- Attach the `run` receipt status, duration, exit code, and important output to the final handoff.
- Finish with `handoff --changed` when transferring state to another agent or a human.

## MCP-First Loop

Use this when the host supports MCP. The MCP server is read-only, so validation
execution still uses the CLI.

MCP server config:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "agent-ready",
      "args": ["mcp", "--root", "/absolute/path/to/repo"]
    }
  }
}
```

Agent sequence:

1. Get prompt `agent-ready-orient` with optional argument `focus`.
2. Read resource `agent-ready://status` or call tool `agent_ready_status`.
3. Read resource `agent-ready://context`.
4. Read resource `agent-ready://workspaces` or call tool `agent_ready_workspaces`.
5. Call tool `agent_ready_affected` with `{"paths": ["src/example.js"]}` when package ownership is the only question.
6. Call tool `agent_ready_doctor` with `{"strict": true}`.
7. Call tool `agent_ready_impact` with `{"paths": ["src/example.js"]}` before editing planned paths.
8. Call tool `agent_ready_preflight` with `{"changed": true}` before handoff.
9. Run `agent-ready run test --root /absolute/path/to/repo --json` through the local CLI for a validation receipt.
10. Call tool `agent_ready_handoff` with `{"changed": true}` for final transfer notes.

## Codex-Style Prompt

Paste this into an agent instruction when a repo has `agent-ready` installed:

```text
Before editing, run `agent-ready status --json`, `agent-ready context --json`, `agent-ready workspaces --json`, and `agent-ready doctor --strict --json`.
When planning monorepo edits, run `agent-ready affected --json <repo-relative-path>` to identify package-scoped checks.
Before touching planned files, run `agent-ready impact --json <repo-relative-path>` and use affected workspace packages for package-scoped validation.
Before final handoff, run `agent-ready preflight --json`.
For validation, run the discovered command by name with `agent-ready run <command-name> --json`.
In monorepos, prefer package-scoped commands from `agent-ready workspaces --json` while iterating.
Finish with `agent-ready handoff --changed --json` and include the validation receipt status.
Do not pass `--allow-network` or `--allow-writes` unless the user approved that side effect.
```

## Claude/Cursor-Style Rules Snippet

Use this as a project rule in hosts that keep repo-level agent instructions:

```text
This repo uses agent-ready. Start each task by reading `agent-ready context --json`.
Use `agent-ready status --json` when you need current changed paths, validation receipts, recipes, and CI adoption hints in one payload.
Use `agent-ready workspaces --json` in monorepos to choose affected packages and package-scoped commands.
Use `agent-ready affected --json <paths...>` or `agent-ready workspaces --changed --json` when package ownership is the only question.
Use `agent-ready doctor --strict --json` to detect stale or missing agent metadata.
Use `agent-ready impact --json <paths...>` before editing risky, workspace-owned, or user-named paths.
Use `agent-ready preflight --json` before final response and include affected workspace guidance when present.
Use `agent-ready run <command-name> --json` for validation receipts, with explicit user approval before `--allow-network` or `--allow-writes`.
Use `agent-ready handoff --changed --json` when transferring work or summarizing remaining risk.
```

## Validation Approval Matrix

`agent-ready run` refuses commands with side effects unless the agent supplies an
explicit approval flag.

| Command metadata | Required flag | Agent behavior |
| --- | --- | --- |
| `requiresNetwork: true` | `--allow-network` | Ask for approval before running. |
| `writesFiles: true` | `--allow-writes` | Ask for approval before running. |
| Both flags true | both flags | Ask for approval and name both side effects. |
| Neither flag true | none | Safe to run as a low-risk validation receipt. |

## CI Adoption Loop

Use this when a maintainer wants GitHub Actions to enforce agent metadata
freshness. For the complete maintainer path, read `docs/adoption-playbook.md`.

```bash
agent-ready add-to-ci --root /absolute/path/to/repo --json
agent-ready add-to-ci --root /absolute/path/to/repo --uses RaziStuff/agent-ready@v0.2.2 --mode required --strict --json
agent-ready add-to-ci --root /absolute/path/to/repo --write --uses RaziStuff/agent-ready@v0.2.2 --mode required --strict
agent-ready validate --root /absolute/path/to/repo --strict
agent-ready ci-status --status-file agent-ready-status.json --contract-file agent-ready-contract.json
```

Agent behavior:

- Preview first; do not write workflow files until the user approves the action reference.
- Confirm generated workflows save `agent-ready-status.json` and `agent-ready-contract.json` as `agent-ready-receipts` artifacts.
- After downloading artifacts, use `ci-status` to summarize readiness, contract validity, and next steps.
- Use `--mode advisory` for early adoption when CI should report issues without failing.
- Use `--no-strict` only when warnings should not fail validation.
- Use `--no-artifacts` only when a maintainer does not want readiness receipts uploaded.
- Use `--force` only when replacing an existing `.github/workflows/agent-ready.yml` is intentional.

## Final Handoff Shape

Every final handoff should include:

- What changed.
- Files touched.
- `agent-ready status` status.
- `agent-ready preflight` status.
- `agent-ready run` receipt status, command name, duration, and exit code.
- Any skipped validation and why.
- Any remaining risks from `agent-ready handoff --changed`.
