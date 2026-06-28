# MCP Client Recipes

`agent-ready mcp` starts a read-only stdio MCP server for one repository. It is
designed for coding agents that can launch a local command and speak MCP over
standard input and output.

## Recommended Config

Use the installed package when `agent-ready` is on the user's `PATH`:

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

Use the source checkout during local development:

```json
{
  "mcpServers": {
    "agent-ready-dev": {
      "command": "node",
      "args": [
        "/absolute/path/to/agent-ready/src/cli/main.js",
        "mcp",
        "--root",
        "/absolute/path/to/repo"
      ]
    }
  }
}
```

Use one server entry per repository. Give each entry a stable, descriptive name:

```json
{
  "mcpServers": {
    "agent-ready-api": {
      "command": "agent-ready",
      "args": ["mcp", "--root", "/work/api"]
    },
    "agent-ready-web": {
      "command": "agent-ready",
      "args": ["mcp", "--root", "/work/web"]
    }
  }
}
```

On Windows, escape backslashes in JSON paths:

```json
{
  "mcpServers": {
    "agent-ready": {
      "command": "agent-ready",
      "args": ["mcp", "--root", "C:\\Users\\you\\repo"]
    }
  }
}
```

## Host Setup Patterns

Different agent hosts expose MCP configuration in different places, but the
server shape is the same.

| Host setup pattern | What to enter |
| --- | --- |
| JSON config with `mcpServers` | Paste the recommended config and replace `/absolute/path/to/repo`. |
| Form with command and args fields | Command: `agent-ready`. Args: `mcp`, `--root`, `/absolute/path/to/repo`. |
| Host requires absolute executable paths | Use the absolute path to the installed `agent-ready` executable. |
| Project-level MCP config | Prefer project-level config when the host supports it, with `--root` set to that project root. |
| Global MCP config | Use unique server names per repo, such as `agent-ready-api` and `agent-ready-web`. |

If a host does not inherit the user's shell `PATH`, use an absolute command path
instead of `agent-ready`.

## Exposed Surface

Static resources:

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

Resource templates:

- `agent-ready://docs/{path}`
- `agent-ready://command/{name}`
- `agent-ready://risk/{path}`
- `agent-ready://schema/{id}`

URL-encode template values that contain `/`, spaces, or reserved characters.
For example, read `docs/architecture.md` as
`agent-ready://docs/docs%2Farchitecture.md`.

Prompts:

- `agent-ready-orient`
- `agent-ready-handoff`
- `agent-ready-risk-review`

Tools:

- `agent_ready_status`
- `agent_ready_preflight`
- `agent_ready_handoff`
- `agent_ready_impact`
- `agent_ready_workspaces`
- `agent_ready_affected`
- `agent_ready_summary`
- `agent_ready_validate`
- `agent_ready_doctor`

## Agent Workflow

For a new task, the agent should:

1. Get `agent-ready-orient` with an optional `focus` argument.
2. Read `agent-ready://status` or call `agent_ready_status` for the compact dashboard.
3. Read `agent-ready://context` for a compact onboarding packet.
4. Read `agent-ready://workspaces` or call `agent_ready_workspaces` before package-local changes in monorepos.
5. Call `agent_ready_affected` when you only need packages touched by planned or current paths.
6. Read `agent-ready://doctor` or call `agent_ready_doctor` with `strict: true`.
7. Read `agent-ready://agents-md`, `agent-ready://repo-map`, and `agent-ready://commands` when deeper detail is needed.
8. Read relevant docs through `agent-ready://docs/{path}` when `repo-map` lists them.
9. Call `agent_ready_impact` with planned repo-relative paths before editing, or with `changed: true` before handoff.
10. Check relevant risks through `agent-ready://risk/{path}` before editing high-impact paths.
11. Call `agent_ready_preflight` before handoff to check readiness, impact, validation, and handoff guidance.
12. Call `agent_ready_handoff` with `changed: true` to prepare transfer notes.
13. Use the CLI `agent-ready run <command-name> --json` when a structured validation receipt is needed.
14. Call `agent_ready_validate` before handoff.
15. Use `agent-ready-handoff` when transferring context to another agent or human.

For copy-paste host instructions and machine-readable command sequences, read
`agent-ready://recipes` or `agent-ready://recipes-json`. The same content ships
as `docs/agent-recipes.md` and `docs/agent-recipes.json`.

## Safety Guarantees

- The MCP server is read-only.
- The scanner does not execute project commands.
- Command execution is CLI-only through `agent-ready run <command-name>` and requires explicit approval flags for commands marked as networked or file-writing.
- Secret-like files are not read by content.
- `agent-ready://context` combines scanner and validation metadata without reading arbitrary files.
- `agent-ready://doctor` and `agent_ready_doctor` reuse local scanner and validation data only.
- `agent-ready://status` and `agent_ready_status` compose local readiness, current git changed path names, validation recommendations, recipes, and CI adoption hints without executing project commands.
- `agent-ready://workspaces` and `agent_ready_workspaces` summarize package manifests and command strings without executing workspace tools.
- `agent_ready_affected` maps planned or current path names to workspace packages without executing workspace tools.
- `agent_ready_impact` uses scanner metadata, path rules, and optional `git status` path names only; it does not inspect arbitrary file contents.
- `agent_ready_handoff` composes local context, impact guidance, and optional `git status` path names without executing project commands.
- `agent_ready_preflight` composes local context, validation metadata, impact guidance, and optional `git status` path names without executing project commands.
- Templated doc reads are limited to documentation files discovered by the scanner.
- Templated command and risk reads are limited to discovered or configured metadata.

## Troubleshooting

If the client cannot start the server:

- Run `agent-ready --version` in a terminal.
- Use an absolute path for `command` if the host does not inherit `PATH`.
- Confirm the `--root` path is absolute and points at the intended repository.
- Run `agent-ready validate --strict --root /absolute/path/to/repo` to confirm generated metadata is current.

If the client lists resources but cannot read a template URI:

- Confirm the path or command name appears in `agent-ready://repo-map` or `agent-ready://commands`.
- URL-encode `/` as `%2F` inside template values.
- Use `agent-ready://commands` first when unsure of the exact command name.

## Compatibility Harness

Run this before release changes that touch MCP behavior:

```bash
npm run mcp:compat
```

The harness launches real stdio MCP server processes, checks static resources,
status dashboards, context packets, doctor readiness, impact, handoff, and preflight guidance,
resource templates, prompts, tools, notification handling, absolute command
paths, and multi-repo isolation.
