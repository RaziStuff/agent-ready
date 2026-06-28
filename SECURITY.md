# Security Policy

`agent-ready` is local-first. It scans repository files to generate `AGENTS.md`
and `.agents` metadata, and it should not upload source code, call remote APIs,
or execute project commands during scanning.

## Supported Versions

Security fixes are currently targeted at the latest published `0.x` release.

## Reporting a Vulnerability

If you find a vulnerability, please do not open a public issue with exploit
details.

Report privately through the repository security advisory flow when available,
or contact the maintainer directly through the project owner profile.

Please include:

- A short description of the issue.
- A minimal reproduction.
- The affected command.
- Whether secret-like file contents, command execution, or package publishing is involved.
- Any suggested fix or mitigation.

## Security Model

Default behavior:

- No network access is required.
- No telemetry is collected.
- Project commands are not executed during scanning.
- Secret-like file contents are not read.
- Symlinks are recorded but not followed.
- Large files are skipped by default.
- Generated output is written only when the user runs `init` or `update`.

Secret-like paths include:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `id_rsa`
- `id_ed25519`
- `credentials.json`
- `service-account*.json`

Safe example env files such as `.env.example`, `.env.sample`, and
`.env.template` may be read as documentation sources.

## Agent Safety Expectations

Agents using this tool should:

- Read `AGENTS.md` before editing.
- Avoid reading secret-like files unless the user explicitly provides them.
- Treat migrations, infrastructure, deployment, and CI changes as high-impact.
- Run the smallest relevant validation command before handoff.
- Preserve human-authored sections outside generated markers.

## Release Safety

Before publishing:

```bash
npm run ci
pnpm pack --dry-run
```

The release gate includes:

- Unit and snapshot tests.
- Strict generated metadata validation.
- Package manifest and bin smoke checks.
- Local tarball install smoke checks.
- Release notes freshness checks.

## Out of Scope

`agent-ready` does not sandbox other tools, audit dependencies, detect all
secrets, or replace human review for high-impact changes. It provides repo
context and safety hints for agents; it is not a security scanner.
