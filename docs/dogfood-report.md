# Dogfood Report

This log captures first-use checks against the published package. Keep it short,
specific, and biased toward fixes an outside agent would feel immediately.

## 2026-06-29: Published package first-use check

Package tested: `@ahmedshaikh/agent-ready@0.1.1`

Target repo: copied `examples/node-next-pnpm` into `/private/tmp` and ran the
published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready --help
agent-ready init
agent-ready validate --strict
agent-ready status --json
agent-ready context --json
agent-ready affected app/page.tsx components/account-card.tsx --json
agent-ready preflight app/page.tsx components/account-card.tsx --goal "dogfood sample UI edit" --json
agent-ready add-to-ci --json
```

What worked:

- Help text was complete enough to orient a fresh user.
- `init` was non-interactive and created `AGENTS.md` plus six metadata files.
- `validate --strict` passed immediately after generation.
- `context --json` gave commands, risk areas, MCP surfaces, and a usable workflow.
- `preflight` with explicit planned paths produced validation guidance without
  requiring a git worktree.

Finding fixed:

- `add-to-ci --json` defaulted to `your-org/agent-ready@v1`, which made the
  zero-config CI path feel unfinished for a public release. The `0.1.2` default
  points at `RaziStuff/agent-ready@v0.1.2`, while `--uses` still allows
  maintainers to pin a fork or newer release.

Follow-up candidates:

- Make the non-git `status --json` warning friendlier by recommending explicit
  path commands when no `.git` directory exists.
- Add a first-class `agent-ready published-smoke` command or documented release
  recipe around the existing smoke script.

## 2026-06-29: External Laravel repo check

Package tested: `@ahmedshaikh/agent-ready@0.1.2`

Target repo: shallow clone of `laravel/laravel` into `/private/tmp`, then ran
the published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- PHP was detected as the primary language.
- GitHub Actions run commands were extracted, including `composer install` and
  `php artisan test`.
- Database migrations were correctly marked as high-risk paths.

Friction found:

- `composer.json` alone did not register Composer unless `composer.lock` existed.
- Laravel was not identified as a framework.
- Artisan commands such as `php artisan test` and `php artisan serve` were not
  surfaced as first-class commands.
- Laravel Pint and PHPUnit signals were not converted into lint/test guidance.
- HTML-heavy README hero markup could become the detected repo purpose.
- Laravel directories such as `bootstrap`, `database`, `resources`, `routes`,
  and `storage` were labeled as generic project directories.

Finding fixed:

- Added Composer detection from `composer.json`, Laravel framework detection,
  Artisan command guidance, Pint/PHPUnit hints, safer README purpose cleanup,
  Laravel-oriented directory roles, `composer.lock` risk handling, and a
  committed Laravel fixture with AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test a non-Laravel Composer package to tune generic PHP library behavior.
- Add Symfony fixture coverage.
- Add a Laravel monorepo or app-with-packages fixture if real users surface one.
