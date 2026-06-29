import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { generateAgentsMd, updateMarkedSections } from "../src/writers/agents-md.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

test("detects a pnpm TypeScript app and commands", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Example app",
      scripts: {
        test: "vitest run",
        lint: "eslint .",
        typecheck: "tsc --noEmit",
        build: "vite build"
      },
      dependencies: {
        react: "^18.0.0",
        vite: "^5.0.0"
      },
      devDependencies: {
        typescript: "^5.0.0"
      }
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    "tsconfig.json": "{}",
    "src/main.tsx": "console.log('hi')",
    ".env": "SECRET=value",
    ".env.example": "SECRET=example"
  });

  const scan = await scanRepo({ root });
  assert.equal(scan.summary.purpose, "Example app");
  assert.ok(scan.languages.some((item) => item.name === "TypeScript"));
  assert.ok(scan.packageManagers.some((item) => item.name === "pnpm"));
  assert.ok(scan.frameworks.some((item) => item.name === "React"));
  assert.ok(scan.frameworks.some((item) => item.name === "Vite"));
  assert.ok(scan.commands.some((item) => item.command === "pnpm test"));
  assert.ok(scan.environment.secretLikeFiles.includes(".env"));
  assert.ok(scan.environment.examples.includes(".env.example"));
});

test("detects Python pytest and ruff signals", async () => {
  const root = await makeFixture({
    "pyproject.toml": "[project]\ndependencies = ['fastapi', 'pytest', 'ruff']\n",
    "uv.lock": "",
    "app/main.py": "print('hi')",
    "tests/test_app.py": "def test_ok(): assert True\n"
  });

  const scan = await scanRepo({ root });
  assert.ok(scan.languages.some((item) => item.name === "Python"));
  assert.ok(scan.packageManagers.some((item) => item.name === "uv"));
  assert.ok(scan.frameworks.some((item) => item.name === "FastAPI"));
  assert.ok(scan.commands.some((item) => item.command === "uv sync"));
  assert.ok(scan.commands.some((item) => item.command === "python -m pytest"));
  assert.ok(scan.commands.some((item) => item.command === "ruff check ."));
});

test("updates generated sections while preserving human edits", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Preserve me",
      scripts: {
        test: "node --test"
      }
    }),
    "package-lock.json": "{}"
  });

  const scan = await scanRepo({ root });
  const generated = generateAgentsMd(scan);
  const existing = `${generated}\n## Human Notes\n\nKeep this paragraph.\n`;
  const updatedScan = {
    ...scan,
    summary: {
      ...scan.summary,
      purpose: "Updated purpose"
    }
  };
  const updated = updateMarkedSections(existing, generateAgentsMd(updatedScan));

  assert.ok(updated.content.includes("Updated purpose"));
  assert.ok(updated.content.includes("## Human Notes"));
  assert.ok(updated.content.includes("Keep this paragraph."));
  assert.ok(updated.replacements > 0);
});

test("applies agent-ready config overrides", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Detected purpose",
      scripts: {
        test: "node --test"
      }
    }),
    "src/index.js": "console.log('app')",
    "ignored/tool.py": "print('ignore me')",
    "billing/invoice.js": "export const invoice = true",
    "src/generated/client.js": "export const generated = true",
    "agent-ready.config.json": JSON.stringify({
      sections: {
        purpose: "Configured purpose",
        conventions: ["Prefer the public billing API for invoice changes."]
      },
      ignore: ["ignored/**"],
      riskPaths: ["billing/**"],
      generatedPaths: ["src/generated/**"],
      directoryRoles: {
        billing: "billing domain code"
      },
      commands: {
        test: "npm run test:ci",
        verify: {
          command: "npm run verify",
          requiresNetwork: false,
          writesFiles: false,
          risk: "low"
        }
      }
    })
  });

  const scan = await scanRepo({ root });

  assert.equal(scan.summary.purpose, "Configured purpose");
  assert.equal(scan.config.loaded, true);
  assert.ok(!scan.languages.some((item) => item.name === "Python"));
  assert.ok(scan.configuredConventions.includes("Prefer the public billing API for invoice changes."));
  assert.ok(scan.directories.some((item) => item.path === "billing" && item.role === "billing domain code"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "npm run test:ci"));
  assert.ok(scan.commands.some((item) => item.name === "verify" && item.command === "npm run verify"));
  assert.ok(scan.risks.some((item) => item.path === "billing/invoice.js" && item.category === "configured_risk"));
  assert.ok(scan.risks.some((item) => item.path === "src/generated/client.js" && item.category === "configured_generated"));
});

test("detects pnpm Turborepo workspaces and workspace commands", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["apps/*", "packages/*"],
      scripts: {
        test: "turbo run test"
      },
      devDependencies: {
        turbo: "^2.0.0"
      }
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - \"packages/*\"\n",
    "turbo.json": JSON.stringify({
      tasks: {
        test: {},
        build: {}
      }
    }),
    "apps/web/package.json": JSON.stringify({
      name: "@acme/web",
      scripts: {
        build: "next build",
        test: "vitest run"
      }
    }),
    "apps/web/src/page.tsx": "export default function Page() { return null; }\n",
    "packages/ui/package.json": JSON.stringify({
      name: "@acme/ui",
      scripts: {
        lint: "eslint .",
        test: "vitest run"
      }
    }),
    "packages/ui/src/index.ts": "export const ok = true;\n"
  });

  const scan = await scanRepo({ root });
  const generated = generateAgentsMd(scan);

  assert.equal(scan.monorepo.detected, true);
  assert.equal(scan.summary.monorepo, true);
  assert.ok(scan.monorepo.tools.some((item) => item.name === "pnpm workspaces"));
  assert.ok(scan.monorepo.tools.some((item) => item.name === "Turborepo"));
  assert.ok(scan.monorepo.workspaceGlobs.some((item) => item.pattern === "apps/*"));
  assert.ok(scan.monorepo.packages.some((item) => item.path === "apps/web" && item.name === "@acme/web"));
  assert.ok(scan.monorepo.packages.some((item) => item.path === "packages/ui" && item.scripts.includes("lint")));
  assert.ok(scan.commands.some((item) => item.name === "workspace test" && item.command === "turbo run test"));
  assert.ok(scan.commands.some((item) => item.name === "workspace build" && item.command === "turbo run build"));
  assert.ok(generated.includes("Monorepo/workspace detected"));
  assert.ok(generated.includes("`apps/web/`: workspace package `@acme/web`"));
});

test("detects Yarn workspaces with Nx orchestration", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      private: true,
      workspaces: {
        packages: ["apps/*", "libs/*"]
      }
    }),
    "yarn.lock": "",
    "nx.json": JSON.stringify({
      targetDefaults: {
        test: {}
      }
    }),
    "apps/api/package.json": JSON.stringify({
      name: "@acme/api",
      scripts: {
        test: "node --test",
        lint: "eslint ."
      }
    }),
    "apps/api/src/index.ts": "export const api = true;\n",
    "libs/shared/package.json": JSON.stringify({
      name: "@acme/shared",
      scripts: {
        test: "node --test"
      }
    }),
    "libs/shared/src/index.ts": "export const shared = true;\n"
  });

  const scan = await scanRepo({ root });

  assert.equal(scan.monorepo.detected, true);
  assert.ok(scan.packageManagers.some((item) => item.name === "yarn"));
  assert.ok(scan.monorepo.tools.some((item) => item.name === "Yarn workspaces"));
  assert.ok(scan.monorepo.tools.some((item) => item.name === "Nx"));
  assert.ok(scan.monorepo.packages.some((item) => item.path === "apps/api"));
  assert.ok(scan.commands.some((item) => item.name === "workspace test" && item.command === "nx run-many -t test"));
  assert.ok(scan.commands.some((item) => item.name === "workspace lint" && item.command === "nx run-many -t lint"));
});

test("detects npm workspace scripts", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      private: true,
      workspaces: ["packages/*"]
    }),
    "package-lock.json": "{}",
    "packages/core/package.json": JSON.stringify({
      name: "@acme/core",
      scripts: {
        typecheck: "tsc --noEmit"
      }
    }),
    "packages/core/src/index.ts": "export const core = true;\n"
  });

  const scan = await scanRepo({ root });

  assert.equal(scan.monorepo.detected, true);
  assert.ok(scan.packageManagers.some((item) => item.name === "npm"));
  assert.ok(scan.monorepo.tools.some((item) => item.name === "npm workspaces"));
  assert.ok(scan.monorepo.packages.some((item) => item.path === "packages/core"));
  assert.ok(scan.commands.some((item) => item.name === "workspace typecheck" && item.command === "npm run typecheck --workspaces"));
});

test("detects justfile and Taskfile command targets", async () => {
  const root = await makeFixture({
    "justfile": "test:\n  npm test\n\nlint *args:\n  npm run lint -- {{args}}\n\nrelease:\n  npm publish\n",
    "Taskfile.yml": "version: '3'\ntasks:\n  build:\n    cmds:\n      - go build ./...\n  typecheck:\n    cmds:\n      - tsc --noEmit\n  deploy:\n    cmds:\n      - ./deploy.sh\n",
    "src/index.js": "console.log('ok')\n"
  });

  const scan = await scanRepo({ root });

  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "just test" && item.source === "justfile:test"));
  assert.ok(scan.commands.some((item) => item.name === "lint" && item.command === "just lint" && item.source === "justfile:lint"));
  assert.ok(scan.commands.some((item) => item.name === "build" && item.command === "task build" && item.source === "Taskfile.yml:build"));
  assert.ok(scan.commands.some((item) => item.name === "typecheck" && item.command === "task typecheck" && item.source === "Taskfile.yml:typecheck"));
  assert.ok(!scan.commands.some((item) => item.command === "just release"));
  assert.ok(!scan.commands.some((item) => item.command === "task deploy"));
});

test("detects common CI providers and run commands", async () => {
  const root = await makeFixture({
    ".github/workflows/ci.yml": "name: CI\njobs:\n  test:\n    steps:\n      - run: npm test\n",
    ".gitlab-ci.yml": "test:\n  script: npm test\n",
    ".circleci/config.yml": "version: 2.1\njobs:\n  test:\n    steps:\n      - run: npm run lint\n",
    ".buildkite/pipeline.yml": "steps:\n  - command: npm run build\n",
    "azure-pipelines.yml": "steps:\n- script: npm run typecheck\n",
    "bitbucket-pipelines.yml": "pipelines:\n  default:\n    - step:\n        script:\n          - npm run test:ci\n",
    ".drone.yml": "steps:\n- name: test\n  commands:\n    - go test ./...\n",
    "Jenkinsfile": "pipeline { agent any stages { stage('Test') { steps { sh 'npm run e2e' } } } }\n"
  });

  const scan = await scanRepo({ root });
  const providers = scan.ci.map((item) => item.provider);

  assert.ok(providers.includes("GitHub Actions"));
  assert.ok(providers.includes("GitLab CI"));
  assert.ok(providers.includes("CircleCI"));
  assert.ok(providers.includes("Buildkite"));
  assert.ok(providers.includes("Azure Pipelines"));
  assert.ok(providers.includes("Bitbucket Pipelines"));
  assert.ok(providers.includes("Drone CI"));
  assert.ok(providers.includes("Jenkins"));
  assert.ok(scan.ci.some((item) => item.provider === "GitHub Actions" && item.runCommands.includes("npm test")));
  assert.ok(scan.ci.some((item) => item.provider === "GitLab CI" && item.runCommands.includes("npm test")));
  assert.ok(scan.ci.some((item) => item.provider === "CircleCI" && item.runCommands.includes("npm run lint")));
  assert.ok(scan.ci.some((item) => item.provider === "Buildkite" && item.runCommands.includes("npm run build")));
  assert.ok(scan.ci.some((item) => item.provider === "Azure Pipelines" && item.runCommands.includes("npm run typecheck")));
  assert.ok(scan.ci.some((item) => item.provider === "Bitbucket Pipelines" && item.runCommands.includes("npm run test:ci")));
  assert.ok(scan.ci.some((item) => item.provider === "Drone CI" && item.runCommands.includes("go test ./...")));
  assert.ok(scan.ci.some((item) => item.provider === "Jenkins" && item.runCommands.includes("npm run e2e")));
});

test("detects Rails projects and Ruby commands", async () => {
  const root = await makeFixture({
    "README.md": "# Billing Console\n\nRails API for billing operations.\n",
    "Gemfile": "source 'https://rubygems.org'\ngem 'rails', '~> 7.1'\ngem 'rspec-rails'\ngem 'rubocop'\n",
    "config/application.rb": "require_relative 'boot'\nrequire 'rails/all'\nmodule BillingConsole\n  class Application < Rails::Application\n  end\nend\n",
    "bin/rails": "APP_PATH = File.expand_path('../config/application', __dir__)\n",
    "app/models/account.rb": "class Account < ApplicationRecord\nend\n",
    "spec/models/account_spec.rb": "RSpec.describe Account do\nend\n",
    "db/migrate/20260101000000_create_accounts.rb": "class CreateAccounts < ActiveRecord::Migration[7.1]\nend\n"
  });

  const scan = await scanRepo({ root });

  assert.ok(scan.languages.some((item) => item.name === "Ruby"));
  assert.ok(scan.packageManagers.some((item) => item.name === "bundler"));
  assert.ok(scan.frameworks.some((item) => item.name === "Rails"));
  assert.ok(scan.entrypoints.some((item) => item.path === "config/application.rb"));
  assert.ok(scan.commands.some((item) => item.name === "install" && item.command === "bundle install"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "bundle exec rspec"));
  assert.ok(scan.commands.some((item) => item.name === "lint" && item.command === "bundle exec rubocop"));
  assert.ok(scan.risks.some((item) => item.path.startsWith("db/migrate") && item.category === "database_migration"));
});

test("detects Laravel Composer projects and sanitizes HTML-heavy README purpose", async () => {
  const root = await makeFixture({
    "README.md": "<p align=\"center\"><a href=\"https://laravel.com\"><img src=\"logo.svg\" alt=\"Laravel Logo\"></a></p>\n\n## About Laravel\n\nLaravel is a web application framework with expressive, elegant syntax.\n",
    "composer.json": JSON.stringify({
      type: "project",
      description: "The skeleton application for the Laravel framework.",
      require: {
        php: "^8.3",
        "laravel/framework": "^13.0"
      },
      "require-dev": {
        "laravel/pint": "^1.0",
        "phpunit/phpunit": "^12.0"
      },
      scripts: {
        test: ["@php artisan test"]
      }
    }),
    "package.json": JSON.stringify({
      scripts: {
        dev: "vite",
        build: "vite build"
      },
      devDependencies: {
        vite: "^7.0.0"
      }
    }),
    "artisan": "#!/usr/bin/env php\n<?php\n",
    "bootstrap/app.php": "<?php\nreturn Illuminate\\Foundation\\Application::configure(basePath: dirname(__DIR__))->create();\n",
    "public/index.php": "<?php\nrequire __DIR__.'/../vendor/autoload.php';\n",
    "routes/web.php": "<?php\nuse Illuminate\\Support\\Facades\\Route;\nRoute::get('/', fn () => view('welcome'));\n",
    "app/Models/User.php": "<?php\nnamespace App\\Models;\nclass User {}\n",
    "database/migrations/20260101000000_create_users_table.php": "<?php\nreturn new class extends Migration {};\n",
    "tests/Feature/ExampleTest.php": "<?php\ntest('ok', fn () => expect(true)->toBeTrue());\n",
    "phpunit.xml": "<phpunit />\n"
  });

  const scan = await scanRepo({ root });

  assert.equal(scan.summary.purpose, "Laravel is a web application framework with expressive, elegant syntax.");
  assert.ok(scan.languages.some((item) => item.name === "PHP"));
  assert.ok(scan.packageManagers.some((item) => item.name === "composer"));
  assert.ok(scan.packageManagers.some((item) => item.name === "npm"));
  assert.ok(scan.frameworks.some((item) => item.name === "Laravel"));
  assert.ok(scan.frameworks.some((item) => item.name === "Vite"));
  assert.ok(scan.entrypoints.some((item) => item.path === "artisan"));
  assert.ok(scan.entrypoints.some((item) => item.path === "public/index.php"));
  assert.ok(scan.entrypoints.some((item) => item.path === "routes/web.php"));
  assert.ok(scan.commands.some((item) => item.name === "install" && item.command === "composer install"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "php artisan test"));
  assert.ok(scan.commands.some((item) => item.name === "serve" && item.command === "php artisan serve"));
  assert.ok(scan.commands.some((item) => item.name === "migrate" && item.command === "php artisan migrate" && item.risk === "high"));
  assert.ok(scan.commands.some((item) => item.name === "lint" && item.command === "vendor/bin/pint --test"));
  assert.ok(scan.risks.some((item) => item.path.startsWith("database/migrations") && item.category === "database_migration"));
});

test("detects Symfony Composer projects and console-oriented commands", async () => {
  const root = await makeFixture({
    "README.md": "Symfony Demo Application\n========================\n\nReference app for Symfony best practices.\n",
    "composer.json": JSON.stringify({
      type: "project",
      description: "Symfony Demo Application",
      require: {
        php: ">=8.3",
        "symfony/console": "^7.0",
        "symfony/framework-bundle": "^7.0",
        "symfony/runtime": "^7.0",
        "symfony/twig-bundle": "^7.0"
      },
      "require-dev": {
        "friendsofphp/php-cs-fixer": "^3.0",
        "phpstan/phpstan": "^2.0",
        "phpunit/phpunit": "^11.0"
      }
    }),
    "composer.lock": "{}",
    "bin/console": "#!/usr/bin/env php\n<?php\n",
    "bin/phpunit": "#!/usr/bin/env php\n<?php\n",
    "config/bundles.php": "<?php\nreturn [Symfony\\Bundle\\FrameworkBundle\\FrameworkBundle::class => ['all' => true]];\n",
    "config/packages/framework.yaml": "framework:\n  secret: '%env(APP_SECRET)%'\n",
    "config/routes.yaml": "controllers:\n  resource: ../src/Controller/\n",
    "public/index.php": "<?php\nuse App\\Kernel;\n",
    "src/Controller/StatusController.php": "<?php\nnamespace App\\Controller;\nclass StatusController {}\n",
    "templates/status.html.twig": "<h1>Status</h1>\n",
    "translations/messages.en.yaml": "status: Status\n",
    "tests/Controller/StatusControllerTest.php": "<?php\nnamespace App\\Tests\\Controller;\nclass StatusControllerTest {}\n",
    "phpunit.dist.xml": "<phpunit />\n",
    "phpstan.dist.neon": "parameters: {}\n",
    ".php-cs-fixer.dist.php": "<?php\nreturn (new PhpCsFixer\\Config())->setRules([]);\n"
  });

  const scan = await scanRepo({ root });

  assert.equal(scan.summary.purpose, "Reference app for Symfony best practices.");
  assert.ok(scan.languages.some((item) => item.name === "PHP"));
  assert.ok(scan.packageManagers.some((item) => item.name === "composer"));
  assert.ok(scan.frameworks.some((item) => item.name === "Symfony"));
  assert.ok(scan.entrypoints.some((item) => item.path === "bin/console"));
  assert.ok(scan.entrypoints.some((item) => item.path === "config/bundles.php"));
  assert.ok(scan.entrypoints.some((item) => item.path === "config/routes.yaml"));
  assert.ok(scan.entrypoints.some((item) => item.path === "public/index.php"));
  assert.ok(scan.directories.some((item) => item.path === "templates" && item.role === "server-rendered templates"));
  assert.ok(scan.directories.some((item) => item.path === "translations" && item.role === "localization messages"));
  assert.ok(scan.commands.some((item) => item.name === "install" && item.command === "composer install"));
  assert.ok(scan.commands.some((item) => item.name === "console" && item.command === "./bin/console"));
  assert.ok(scan.commands.some((item) => item.name === "serve" && item.command === "php -S localhost:8000 -t public/"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "./bin/phpunit"));
  assert.ok(scan.commands.some((item) => item.name === "lint" && item.command === "vendor/bin/php-cs-fixer fix --dry-run --diff"));
  assert.ok(scan.commands.some((item) => item.name === "typecheck" && item.command === "vendor/bin/phpstan analyse"));
  assert.ok(scan.risks.some((item) => item.path === "composer.lock" && item.category === "lockfile"));
});

test("detects Django projects and manage.py test command", async () => {
  const root = await makeFixture({
    "README.md": "# Support Desk\n\nDjango service for support ticket workflows.\n",
    "requirements.txt": "Django==5.1\ndjangorestframework==3.15\n",
    "manage.py": "import os\nfrom django.core.management import execute_from_command_line\nexecute_from_command_line()\n",
    "support/settings.py": "INSTALLED_APPS = ['django.contrib.auth', 'tickets']\n",
    "tickets/models.py": "from django.db import models\n",
    "tickets/tests.py": "from django.test import TestCase\n"
  });

  const scan = await scanRepo({ root });

  assert.ok(scan.languages.some((item) => item.name === "Python"));
  assert.ok(scan.packageManagers.some((item) => item.name === "pip"));
  assert.ok(scan.frameworks.some((item) => item.name === "Django"));
  assert.ok(scan.entrypoints.some((item) => item.path === "manage.py"));
  assert.ok(scan.commands.some((item) => item.name === "install" && item.command === "python -m pip install -r requirements.txt"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "python manage.py test"));
});

test("detects Spring Boot projects and Maven wrapper commands", async () => {
  const root = await makeFixture({
    "README.md": "# Order Service\n\nSpring Boot service for order lifecycle APIs.\n",
    "pom.xml": "<project><dependencies><dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency></dependencies></project>\n",
    "mvnw": "#!/bin/sh\n",
    "src/main/java/com/acme/orders/OrdersApplication.java": "package com.acme.orders;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\npublic class OrdersApplication {}\n",
    "src/test/java/com/acme/orders/OrdersApplicationTests.java": "package com.acme.orders;\nclass OrdersApplicationTests {}\n"
  });

  const scan = await scanRepo({ root });

  assert.ok(scan.languages.some((item) => item.name === "Java"));
  assert.ok(scan.packageManagers.some((item) => item.name === "maven"));
  assert.ok(scan.frameworks.some((item) => item.name === "Spring Boot"));
  assert.ok(scan.entrypoints.some((item) => item.kind === "Spring Boot application entrypoint"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "./mvnw test"));
  assert.ok(scan.commands.some((item) => item.name === "build" && item.command === "./mvnw package"));
});

test("detects ASP.NET Core projects and dotnet commands", async () => {
  const root = await makeFixture({
    "README.md": "# Orders API\n\nASP.NET Core service for orders.\n",
    "Orders.Api.sln": "Microsoft Visual Studio Solution File, Format Version 12.00\n",
    "Orders.Api/Orders.Api.csproj": "<Project Sdk=\"Microsoft.NET.Sdk.Web\"><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>\n",
    "Orders.Api/Program.cs": "var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\napp.Run();\n",
    "Orders.Api/appsettings.json": "{}\n",
    "Orders.Api.Tests/Orders.Api.Tests.csproj": "<Project Sdk=\"Microsoft.NET.Sdk\"><ItemGroup><PackageReference Include=\"xunit\" Version=\"2.8.0\" /></ItemGroup></Project>\n"
  });

  const scan = await scanRepo({ root });

  assert.ok(scan.languages.some((item) => item.name === "C#"));
  assert.ok(scan.packageManagers.some((item) => item.name === "dotnet"));
  assert.ok(scan.frameworks.some((item) => item.name === "ASP.NET Core"));
  assert.ok(scan.entrypoints.some((item) => item.path === "Orders.Api/Program.cs"));
  assert.ok(scan.commands.some((item) => item.name === "install" && item.command === "dotnet restore"));
  assert.ok(scan.commands.some((item) => item.name === "build" && item.command === "dotnet build"));
  assert.ok(scan.commands.some((item) => item.name === "test" && item.command === "dotnet test"));
});
