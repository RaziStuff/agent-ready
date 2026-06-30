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

## 2026-06-29: External Symfony repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.0`

Target repo: shallow clone of `symfony/demo` into `/private/tmp`, then ran the
published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- Composer and PHP were detected.
- PHPUnit was detected from project files.
- GitHub Actions run commands were extracted, including Composer install,
  console lint commands, PHPStan, and PHPUnit.
- Secret-like `.env*` files were flagged without reading contents.

Friction found:

- Symfony was not identified as a framework.
- Symfony-native entrypoints such as `bin/console`, `config/bundles.php`, and
  `config/routes.yaml` were not surfaced.
- Symfony-friendly commands for console access, local serving, PHP-CS-Fixer,
  and PHPStan were missing from the first-class command catalog.
- README purpose extraction stopped at the first line of a wrapped paragraph.
- `templates`, `translations`, and `data` directories were labeled as generic
  project directories.

Finding fixed:

- Added Symfony detection, Symfony entrypoints, console/PHPUnit/PHP-CS-Fixer/
  PHPStan command guidance, framework directory roles, paragraph-aware README
  purpose extraction, and a committed Symfony fixture with AGENTS.md/repo-map/
  commands snapshots.

Follow-up candidates:

- Test a generic Composer library with no web framework.
- Test a PHP package that uses Pest instead of PHPUnit.
- Consider parsing common Composer script arrays into more exact command text.

## 2026-06-29: External Pest repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.1`

Target repo: shallow clone of `pestphp/pest` into `/private/tmp`, then ran the
published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- Composer, PHP, PHPStan, and GitHub Actions signals were detected.
- CI run commands were extracted, including Composer install and test scripts.
- README purpose extraction skipped the HTML image block and found the project
  description paragraph.

Friction found:

- Pest was not identified as a framework.
- The command catalog preferred raw PHPUnit fallback guidance over the project's
  declared Composer/Pest scripts.
- Common Composer script names such as `test:unit`, `test:integration`,
  `test:parallel`, `test:lint`, and `test:type:check` were not surfaced as
  first-class commands.
- Blockquoted README announcements could become the detected purpose before the
  project description.

Finding fixed:

- Added Pest detection, richer Composer script aliases, Composer-script-first
  command ordering, blockquote-skipping README purpose extraction, simple
  Markdown emphasis cleanup, and a committed generic Composer/Pest fixture with
  AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test a generic Composer library with no framework-specific dependencies.
- Test a Pest plugin package to tune plugin-specific directory and command
  guidance.
- Consider parsing Composer script arrays into more exact command text while
  keeping the simpler `composer <script>` command as the default agent action.

## 2026-06-29: External Ruby gem repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.2`

Target repo: shallow clone of `rubocop/rubocop` into `/private/tmp`, then ran
the published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- Ruby and Bundler were detected from the Gemfile.
- RSpec was detected from Ruby project files and surfaced as `bundle exec rspec`.
- GitHub Actions workflow files and their run commands were extracted.
- `lib/` and `spec/` received useful generic directory roles.

Friction found:

- Badge-only README links became the detected project purpose.
- RSpec and RuboCop were not surfaced as detected Ruby tools/frameworks.
- RuboCop's root `.gemspec` and `exe/rubocop` executable were not surfaced as
  entrypoints.
- The command catalog missed `gem build`, RuboCop linting, and default Rake
  verification guidance.
- `exe/` and `tasks/` directories were labeled as generic project directories.

Finding fixed:

- Added root gemspec detection, RubyGems manifest language/package signals,
  RSpec and RuboCop tool detection, gem build guidance, Rake spec/default task
  guidance, `exe/*` and gemspec entrypoints, `exe/` and `tasks/` directory
  roles, badge-link README cleanup, and a committed Ruby gem/RSpec/RuboCop
  fixture with AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test a gemspec-only Ruby gem without a Gemfile.
- Test a Ruby CLI gem that uses Minitest instead of RSpec.
- Parse more Rake task files under `tasks/` instead of only the root Rakefile.

## 2026-06-29: External Minitest Ruby gem repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.3`

Target repo: shallow clone of `rack/rack` into `/private/tmp`, then ran the
published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- Ruby, Bundler, RuboCop, the root gemspec, gem build, and default Rake
  verification were detected.
- README purpose extraction skipped badges and found the real project summary.
- GitHub Actions run commands were extracted, including `bundle exec rake`.

Friction found:

- Minitest was not identified even though the gemspec declares `minitest`.
- `test/` files did not produce a first-class test framework signal.
- The command catalog missed the direct `bundle exec rake test` command.
- The command catalog missed the `bundle exec rake ci` task.
- `Rake::TestTask.new(:test)` was not recognized as a Rake task declaration.

Finding fixed:

- Added Minitest detection from Ruby dependencies and `test/` files, Rake
  `test` and `ci` command guidance, `Rake::TestTask` parsing, and a committed
  Minitest/RuboCop Ruby gem fixture with AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test a gemspec-only Ruby gem without a Gemfile.
- Parse extra Rake task files under `tasks/`.
- Consider detecting Bake tasks in Ruby projects that use `bake`.

## 2026-06-29: External generic Composer library repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.4`

Target repo: shallow clone of `Seldaek/monolog` into `/private/tmp`, then ran
the published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- PHP and Composer were detected.
- README purpose extraction found the real package summary.
- `composer test` was detected from Composer scripts.
- PHPStan was detected from project files.
- GitHub Actions run commands were extracted, including `composer phpstan`.

Friction found:

- The project was not identified as a generic Composer library even though
  `composer.json` has `"type": "library"`.
- `composer phpstan` was not preferred over the raw PHPStan fallback.
- `.php-cs-fixer.php` did not produce lint guidance.
- `composer.json`, PHPUnit config, PHPStan baseline files, and PHP-CS-Fixer
  config were not surfaced as entrypoints.

Finding fixed:

- Added Composer library classification, `phpstan`/`phpstan-baseline` Composer
  script aliases, PHP-CS-Fixer script aliases, `.php-cs-fixer.php` detection,
  broader `phpstan*.neon` handling, PHP tooling entrypoints, and a committed
  generic Composer library fixture with AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test Composer plugin packages.
- Test Composer packages that use Psalm instead of PHPStan.
- Detect Composer `bin` executables as package entrypoints.

## 2026-06-30: External Composer plugin and Psalm repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.5`

Target repos: shallow clones of `composer/installers` and `vimeo/psalm` into
`/private/tmp`, then ran the published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- PHP and Composer were detected in both repos.
- `composer/installers` surfaced `composer test` and `composer phpstan` from
  Composer scripts.
- `vimeo/psalm` surfaced the package purpose, Composer install guidance, and a
  lint command from Composer scripts.

Friction found:

- `composer/installers` was not identified as a Composer plugin even though
  `composer.json` has `"type": "composer-plugin"`.
- The Composer plugin class from `extra.class` was not surfaced as an
  entrypoint.
- `vimeo/psalm` was not identified as a Psalm/static-analysis project.
- `vimeo/psalm` fell back to raw PHPUnit instead of the declared
  `composer tests` script.
- `vimeo/psalm` missed the declared `composer psalm` static-analysis script.
- Psalm config/baseline files and Composer `bin` executables were not surfaced
  as entrypoints.

Finding fixed:

- Added Composer plugin classification, plugin class entrypoints resolved from
  `extra.class` and PSR-4 autoload data, Psalm config/baseline/dependency/script
  detection, Composer `tests`/`phpunit`/Psalm script aliases, Composer `bin`
  executable entrypoints, and a committed Composer plugin/Psalm fixture with
  AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test Composer packages that use PHP_CodeSniffer without PHP-CS-Fixer.
- Detect Composer plugin activation notes from `config.allow-plugins`.
- Consider separate command labels for packages that publish multiple CLI
  executables.

## 2026-06-30: External PHP_CodeSniffer and Composer CLI repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.6`

Target repos: shallow clones of `PHPCSStandards/PHP_CodeSniffer`,
`Dealerdirect/phpcodesniffer-composer-installer`, and `vimeo/psalm` into
`/private/tmp`, then ran the published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- PHP, Composer, Composer libraries, Composer plugins, plugin classes, Psalm,
  and Composer `bin` executable entrypoints were detected where applicable.
- PHPCS packages surfaced Composer install, test, and lint commands when those
  scripts were declared.
- Psalm surfaced `composer tests`, `composer psalm`, and its published bin
  entrypoints.

Friction found:

- PHPCS projects were not identified as PHP_CodeSniffer projects/tools.
- PHPCS config and ruleset files were not surfaced as entrypoints.
- Composer `bin` files were surfaced as entrypoints, but not as runnable
  command catalog entries.
- Composer `allow-plugins` configuration was not reflected in generated agent
  guidance.
- Reference-style badge images and link-definition lines could become bogus
  README purpose summaries.
- The Markdown cleaner stripped underscores from tool names such as
  `PHP_CodeSniffer`.

Finding fixed:

- Added PHP_CodeSniffer detection, PHPCS config/ruleset entrypoints,
  `phpcs`/`phpcbf`/`check-all` Composer script aliases, command catalog entries
  for local Composer `bin` executables, `allow-plugins` guidance, reference
  badge/link-definition README cleanup, underscore-preserving Markdown cleanup,
  and a committed PHP_CodeSniffer/code-quality fixture with
  AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Test packages that publish Composer bin files outside PHP scripts.
- Detect PHPCS standard packages that declare `type:
  phpcodesniffer-standard`.
- Consider a richer command role model for long-running CLI tools such as
  language servers.

## 2026-06-30: External PHPCS standard and command role repo check

Package tested: `@ahmedshaikh/agent-ready@0.2.7`

Target repos: shallow clones of `PHPCompatibility/PHPCompatibility`,
`composer/composer`, and `vimeo/psalm` into `/private/tmp`, then ran the
published CLI through `pnpm dlx`.

Commands exercised:

```bash
agent-ready scan --json
```

What worked:

- PHPCS config files, PHP_CodeSniffer tooling, Composer `allow-plugins`, and
  Composer `bin` entrypoints were detected.
- `composer/composer` surfaced its root `bin/composer` executable and
  Composer test/PHPStan scripts.
- `vimeo/psalm` surfaced multiple Composer `bin` entrypoints including
  `psalm-language-server`.

Friction found:

- Packages with Composer `type: phpcodesniffer-standard` were not identified as
  PHPCS standards.
- PHPCS standard scripts such as `checkcs`, `fixcs`, and `check-complete` were
  not mapped to lint/format/verify commands.
- Composer `bin` command generation assumed PHP for every executable instead
  of inspecting shebangs.
- Commands did not include role or execution-mode metadata, so long-running
  tools such as language servers looked like ordinary one-shot commands.

Finding fixed:

- Added PHPCS standard detection, PHPCS standard script aliases, shebang-aware
  Composer `bin` command generation, command `role` and `executionMode`
  metadata, long-running annotations in generated AGENTS.md, and a committed
  PHPCS standard fixture with AGENTS.md/repo-map/commands snapshots.

Follow-up candidates:

- Detect PHPCS standard package directories such as `Sniffs/` more explicitly.
- Consider surfacing `scripts-descriptions` from Composer manifests.
- Add richer role hints for destructive custom CLI commands beyond filename
  heuristics.
