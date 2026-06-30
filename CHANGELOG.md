# Changelog

All notable changes to `agent-ready` will be documented here.

## 0.2.10 - WordPressCS and Compact PHPCS Maps

### Added

- Added WordPress Coding Standards-style Composer aliases for `check-cs`,
  `fix-cs`, and `run-tests`.
- Added PHPCS ruleset-only directory roles for standards such as
  `WordPress-Core`, `WordPress-Docs`, and `WordPress-Extra`.
- Added compact grouping for large bundled PHPCS standards trees such as
  `src/Standards` so generated repo maps do not list every nested
  `*/Sniffs` directory.
- Added case-insensitive common directory role matching, including `Tests/`.
- Added external dogfood notes for the published CLI against
  `WordPress/WordPress-Coding-Standards` and
  `PHPCSStandards/PHP_CodeSniffer`.

### Fixed

- Skip Markdown table-of-contents list items and broken multi-line badge
  fragments when extracting README purpose summaries.
- Prefer project-declared WPCS Composer scripts over raw PHPUnit fallbacks.

## 0.2.9 - Composer Descriptions and PHPCS Directory Roles

### Added

- Added PHPCS standard namespace and nested `Sniffs/` directory roles so
  agents can find standard source quickly.
- Added Composer `scripts-descriptions` support on command catalog entries and
  generated AGENTS.md command lists.
- Added Composer `build`, `build-phar`, `coverage`, and `coverage-local`
  script aliases with role and side-effect metadata.
- Added richer command role/risk inference for check, fix, format, build,
  coverage, migration, deploy, release, and publish-like custom commands.
- Documented `description`, `role`, and `executionMode` in the published
  command catalog JSON Schema.
- Added external dogfood notes for the published CLI against
  `PHPCompatibility/PHPCompatibility` and
  `PHPCSStandards/PHP_CodeSniffer`.

### Fixed

- Keep dry-run/check-only format commands such as `cargo fmt --check` from
  being marked as file-writing commands.
- Avoid surfacing PHPCS fixture/test `Sniffs/` directories as primary repo-map
  source directories.

## 0.2.8 - PHPCS Standards and Command Roles

### Added

- Added PHPCS standard package detection from Composer
  `type: phpcodesniffer-standard`.
- Added command `role` and `executionMode` metadata to discovered command
  catalog entries.
- Added long-running command annotation in generated AGENTS.md command lists.
- Added shebang-aware Composer `bin` command generation for PHP, Node, Deno,
  Bun, Python, Ruby, and shell scripts.
- Added PHPCS standard Composer script aliases for `checkcs`, `fixcs`,
  `check-complete`, and `check-complete-strict`.
- Added a PHPCS standard fixture with shebang-aware Composer bins,
  long-running language-server metadata, AGENTS.md, repo-map, and command
  snapshots.
- Added external dogfood notes for the published CLI against
  `PHPCompatibility/PHPCompatibility`, `composer/composer`, and `vimeo/psalm`.

### Fixed

- Mark Composer `bin` commands such as `psalm-language-server` as
  long-running service commands instead of ordinary one-shot tools.
- Avoid assuming every Composer `bin` executable should be invoked with `php`.

## 0.2.7 - PHP_CodeSniffer and Composer CLI Coverage

### Added

- Added PHP_CodeSniffer detection from Composer dependencies, package names,
  `phpcs`/`phpcbf` bins, and PHPCS config/ruleset files.
- Added PHPCS entrypoints for `phpcs.xml`, `phpcs.xml.dist`,
  `.phpcs.xml`, `.phpcs.xml.dist`, `phpcs.dist.xml`, and `ruleset.xml`.
- Added Composer script aliases for `phpcs`, `phpcs:check`, `phpcbf`,
  `cbf`, `check`, `check-all`, and `qa`.
- Added command catalog entries for local Composer `bin` executables, including
  write-aware handling for fixer/refactor-style bins.
- Added generated Composer `allow-plugins` guidance in `AGENTS.md` and
  repo-map metadata when `composer.json` explicitly allows plugins.
- Added a PHP_CodeSniffer/code-quality fixture with Composer `allow-plugins`,
  PHPCS rulesets, Composer `bin` commands, AGENTS.md, repo-map, and command
  snapshots.
- Added external dogfood notes for the published CLI against
  `PHPCSStandards/PHP_CodeSniffer`,
  `Dealerdirect/phpcodesniffer-composer-installer`, and `vimeo/psalm`.

### Fixed

- Skip reference-style badge images and Markdown link-definition lines when
  extracting README purpose summaries.
- Preserve underscores inside tool names such as `PHP_CodeSniffer` while
  cleaning Markdown emphasis markers.

## 0.2.6 - Composer Plugin and Psalm Coverage

### Added

- Added Composer plugin classification from `composer.json` type and
  `composer-plugin-api` dependencies.
- Added Composer plugin class entrypoints by resolving `extra.class` through
  PSR-4 autoload paths.
- Added Psalm detection from Composer dependencies, package names, scripts,
  `psalm.xml*` config files, and Psalm baseline files.
- Added Composer `bin` executable entrypoints from local files listed in
  `composer.json`.
- Added Composer script aliases for `tests`, `phpunit`, `phpunit-std`,
  `psalm`, `psalm:check`, and `psalm-check`.
- Added a Composer plugin fixture with Psalm, plugin class resolution, Composer
  `bin` executables, AGENTS.md, repo-map, and command snapshots.
- Added external dogfood notes for the published CLI against
  `composer/installers` and `vimeo/psalm`.

### Fixed

- Prefer declared Composer test/static-analysis scripts such as
  `composer tests` and `composer psalm` before falling back to raw PHPUnit or
  tool binaries.

## 0.2.5 - Generic Composer Library Coverage

### Added

- Added Composer library classification from `composer.json` type.
- Added Composer script aliases for `phpstan`, `phpstan-baseline`, and common
  PHP-CS-Fixer script names.
- Added entrypoints for `composer.json`, PHPUnit config, PHPStan config, and
  PHP-CS-Fixer config.
- Added a generic Composer library fixture with PHPUnit, PHPStan, PHP-CS-Fixer,
  AGENTS.md, repo-map, and command snapshots.
- Added an external dogfood report for the published CLI against
  `Seldaek/monolog`.

### Fixed

- Recognize `.php-cs-fixer.php` and `phpstan*.neon` files when inferring
  Composer library lint/typecheck guidance.

## 0.2.4 - Minitest Ruby Gem Coverage

### Added

- Added Minitest detection from Ruby gem dependencies and `test/` project files.
- Added Rake `test` and `ci` command guidance for Ruby gems.
- Added a Minitest/RuboCop Ruby gem fixture with AGENTS.md, repo-map, and
  command snapshots.
- Added an external dogfood report for the published CLI against `rack/rack`.

### Fixed

- Recognize `Rake::TestTask.new(:test)` when inferring available Rake tasks.

## 0.2.3 - Ruby Gem Coverage

### Added

- Added Ruby gem detection from root `.gemspec` files and Rakefiles.
- Added RSpec and RuboCop tool detection for Ruby gems and Rails apps.
- Added Ruby gem commands for `gem build`, `bundle exec rspec`,
  `bundle exec rake spec`, `bundle exec rubocop`, and default Rake verification.
- Added Ruby gem entrypoints for root gemspecs and `exe/*` executables.
- Added directory roles for `exe/` executable entrypoints and `tasks/` Rake
  automation.
- Added a Ruby gem/RSpec/RuboCop fixture with AGENTS.md, repo-map, and command
  snapshots.
- Added an external dogfood report for the published CLI against
  `rubocop/rubocop`.

### Fixed

- Ignore empty badge links and line-wrapped Markdown links when extracting README
  purpose summaries.

## 0.2.2 - Pest Coverage

### Added

- Added Pest framework detection from Composer package names, dependencies,
  plugin dependencies, `bin/pest`, `tests/Pest.php`, and `pest.php`.
- Added common Composer script aliases for unit, integration, parallel,
  end-to-end, lint, typecheck, format, analyse/analyze, and PHPStan-style
  scripts.
- Added a generic Composer/Pest package fixture with AGENTS.md, repo-map, and
  command snapshots.
- Added an external dogfood report for the published CLI against `pestphp/pest`.

### Fixed

- Prefer declared Composer scripts such as `composer test` and
  `composer test:type:check` before falling back to raw PHPUnit/PHPStan commands.
- Skip README blockquote announcements and strip simple Markdown emphasis when
  extracting repo purpose summaries.

## 0.2.1 - Symfony Coverage

### Added

- Added Symfony framework detection from Composer dependencies and Symfony
  project files.
- Added Symfony entrypoints for `bin/console`, `config/bundles.php`,
  `config/routes.yaml`, and `public/index.php`.
- Added Symfony-oriented command guidance for console access, PHPUnit,
  PHP-CS-Fixer, PHPStan, and a dependency-free local PHP server.
- Added directory roles for server-rendered templates, translations, and local
  data fixtures.
- Added a Symfony fixture with AGENTS.md, repo-map, and command snapshots.
- Added an external dogfood report for the published CLI against
  `symfony/demo`.

### Fixed

- Build README purpose summaries from complete Markdown paragraphs so wrapped
  README descriptions are not truncated after the first line.

## 0.2.0 - Laravel Coverage

### Added

- Added Composer detection from `composer.json`, including Composer install and
  common script commands.
- Added Laravel framework detection with Artisan command guidance for tests,
  serving, and migrations.
- Added Laravel Pint and PHPUnit hints for lint/test guidance.
- Added Laravel-oriented directory roles, entrypoints, and a Laravel fixture
  with AGENTS.md, repo-map, and commands snapshots.
- Added an external dogfood report for the published CLI against
  `laravel/laravel`.

### Fixed

- Clean HTML-heavy README lines before choosing the detected repository
  purpose so logo and badge markup is not used as the summary.
- Mark `composer.lock` as a lockfile risk path.

## 0.1.2 - Public CI Default

### Fixed

- Default generated GitHub Actions workflows to the public
  `RaziStuff/agent-ready@v0.1.2` action ref so `agent-ready add-to-ci --json`
  is immediately usable after install.

### Added

- Added a dogfood report documenting the published-package first-use check and
  the friction it uncovered.

## 0.1.1 - Npm Metadata Patch

### Fixed

- Published under the npm user scope as `@ahmedshaikh/agent-ready` while keeping
  the executable command as `agent-ready`.
- Use the npm CLI publish path for patch releases so npm package pages receive
  README metadata.

## 0.1.0 - Initial Release

### Added

- CLI commands: `scan`, `init`, `update`, `context`, `doctor`, `status`, `workspaces`, `affected`, `impact`, `handoff`, `preflight`, `run`, `recipes`, `schemas`, `verify-contract`, `ci-status`, `add-to-ci`, `validate`, `explain`, `config init`, and `mcp`.
- `AGENTS.md` generation with marked sections that preserve human edits on update.
- `.agents` metadata output:
  - `repo-map.json`
  - `commands.json`
  - `workspaces.json`
  - `risk-policy.md`
  - `handoff-template.md`
  - `agent-index.md`
- Deterministic scanners for:
  - Node.js, JavaScript, TypeScript, package scripts, and common frameworks.
  - Python, uv, Poetry, pip, pytest, ruff, mypy, and framework signals.
  - Go modules.
  - Rust Cargo projects.
  - Ruby on Rails, Django, Java/Spring Boot, and .NET/ASP.NET Core projects.
  - Makefile, justfile, and Taskfile targets.
  - GitHub Actions, GitLab CI, CircleCI, Buildkite, Azure Pipelines, Bitbucket Pipelines, Drone CI, and Jenkins workflows.
  - npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.
  - Risk paths, generated paths, lockfiles, migrations, infra, and secret-like files.
- Maintainer config through `agent-ready.config.json`.
- Starter config generation through `agent-ready config init`.
- Compact onboarding packets through `agent-ready context` and `agent-ready context --json`.
- Readiness diagnostics through `agent-ready doctor` and `agent-ready doctor --strict`.
- Compact status dashboards through `agent-ready status` and `agent-ready status --json`, combining readiness, current git changes, preflight summary, validation receipts, recipes, and CI adoption hints.
- First-class workspace package summaries through `agent-ready workspaces`, `.agents/workspaces.json`, `agent-ready://workspaces`, and `agent_ready_workspaces`.
- Direct affected package lookup through `agent-ready affected`, `agent-ready workspaces --changed`, and `agent_ready_affected`.
- Planned-path and current-worktree impact guidance through `agent-ready impact <path...>`, `agent-ready impact --changed`, and JSON output, including affected workspace package mapping.
- Handoff packet generation through `agent-ready handoff`, `agent-ready handoff --changed`, and JSON output.
- One-shot preflight guidance through `agent-ready preflight`, combining readiness, changed-path impact, affected workspace packages, validation recommendations, and handoff guidance.
- Structured command receipts through `agent-ready run <command-name>`, with explicit approval flags for networked or file-writing commands.
- Built-in adoption recipe discovery through `agent-ready recipes`, `agent-ready recipes --json`, `agent-ready://recipes`, and `agent-ready://recipes-json`.
- JSON Schema discovery through `agent-ready schemas`, `agent-ready schemas --json`, `agent-ready schemas <schema-id> --json`, `agent-ready://schemas`, and `agent-ready://schema/{id}`.
- Local JSON contract verification through `agent-ready verify-contract <report-file> --schema <schema-id>`.
- CI receipt summaries through `agent-ready ci-status`, reading status and contract artifacts generated by `agent-ready add-to-ci`.
- GitHub Actions workflow generation through `agent-ready add-to-ci`, including preview, JSON output, explicit write mode, advisory/required modes, strict toggles, receipt artifacts, custom action refs, and overwrite protection.
- Agent profile pointer support for Claude, Cursor, Aider, and OpenHands-style files.
- Read-only stdio MCP server exposing `AGENTS.md`, `.agents` metadata, schema contracts, status dashboards, context packets, doctor readiness, impact guidance, handoff packets, preflight guidance, resource templates, prompts, repo summaries, and validation results.
- MCP client recipes for installed-package, source-checkout, multi-repo, and command/args host setups.
- Maintainer adoption playbook covering first scan, config, generated docs, CI receipts, artifact summaries, maintenance, troubleshooting, and rollback.
- Copy-paste and machine-readable adoption recipes for Codex, Claude, Cursor, MCP-capable hosts, and terminal agents.
- Strict validation mode with metadata shape checks and stale local reference warnings for `AGENTS.md`.
- JSON schemas for config, repo maps, command catalogs, workspace catalogs, affected workspace reports, impact reports, handoff packets, preflight reports, run receipts, and status dashboards.
- Example fixture repos plus generated `AGENTS.md`, `repo-map.json`, and `commands.json` snapshots for Node, Python, Go, Rust, Rails, Django, Spring Boot, and .NET.
- GitHub composite Action.
- CI workflow.
- Package smoke check and local tarball install smoke check, including installed status, explicit-path and git-changed impact, handoff, preflight, recipe, CI workflow receipt artifacts, schema, contract verification, CI status summaries, and run receipt checks.
- MCP compatibility smoke check for schema discovery, status dashboards, context packets, doctor readiness, explicit-path and git-changed impact guidance, handoff guidance, preflight guidance, common stdio launch patterns, and multi-repo isolation.
- Release notes generator and release checklist.

### Known Limitations

- No LLM-assisted summarization yet.
- MCP server is read-only and intentionally limited to local repo context; resources expose scanner-discovered docs, commands, workspaces, risk paths, and package-level schemas.
- No Homebrew, Docker, or standalone binary distribution yet.
- Detection remains conservative and fixture-driven.
