import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { parseGitStatusPorcelainZ } from "../src/impact/git-changes.js";
import { buildImpactReport, formatImpactReport } from "../src/impact/report.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-impact-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeRepo() {
  return makeFixture({
    "package.json": JSON.stringify({
      description: "Impact target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js",
        build: "node scripts/build.js"
      }
    }),
    "README.md": "# Impact Target\n\nImpact target repo for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nImpact guide.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n",
    "scripts/build.js": "console.log('build');\n"
  });
}

async function makeWorkspaceRepo() {
  return makeFixture({
    "package.json": JSON.stringify({
      description: "Workspace impact target",
      private: true,
      workspaces: ["apps/*", "packages/*"]
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    "turbo.json": JSON.stringify({
      tasks: {
        test: {},
        build: {}
      }
    }),
    "apps/web/package.json": JSON.stringify({
      name: "@acme/web",
      private: true,
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
}

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["src/cli/main.js", ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ status: 127, stdout, stderr: error.message });
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

test("git status parser returns changed paths", () => {
  const output = [
    " M src/index.js",
    "?? docs/new guide.md",
    "R  src/new-name.js",
    "src/old-name.js",
    ""
  ].join("\0");

  assert.deepEqual(parseGitStatusPorcelainZ(output), [
    "src/index.js",
    "docs/new guide.md",
    "src/new-name.js"
  ]);
});

test("impact report classifies planned paths and recommends validation", async () => {
  const root = await makeRepo();
  const report = await buildImpactReport({
    root,
    paths: ["src/index.js", ".github/workflows/ci.yml", "db/migrate/001_create_users.rb"]
  });

  assert.equal(report.ok, true);
  assert.equal(report.status, "high");
  assert.ok(report.impacts.some((impact) => impact.path === ".github/workflows/ci.yml" && impact.categories.includes("ci")));
  assert.ok(report.impacts.some((impact) => impact.path === "db/migrate/001_create_users.rb" && impact.categories.includes("database_migration")));
  assert.ok(report.recommendedCommands.some((command) => command.command === "npm test"));
  assert.ok(report.nextSteps.some((step) => step.includes("maintainer review")));
});

test("impact formatter returns markdown guidance", async () => {
  const root = await makeRepo();
  const report = await buildImpactReport({ root, paths: [".github/workflows/ci.yml"] });
  const text = formatImpactReport(report);

  assert.ok(text.startsWith("# Agent Change Impact"));
  assert.ok(text.includes("Status: medium"));
  assert.ok(text.includes("CI changes can affect validation"));
  assert.ok(text.includes("Recommended Validation"));
});

test("impact report maps changed paths to affected workspace packages", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildImpactReport({
    root,
    paths: ["apps/web/src/page.tsx"]
  });
  const text = formatImpactReport(report);

  assert.equal(report.ok, true);
  assert.equal(report.status, "low");
  assert.equal(report.affectedPackages.length, 1);
  assert.equal(report.affectedPackages[0].name, "@acme/web");
  assert.deepEqual(report.affectedPackages[0].changedPaths, ["apps/web/src/page.tsx"]);
  assert.ok(report.impacts[0].workspacePackages.some((workspacePackage) => workspacePackage.name === "@acme/web"));
  assert.ok(report.recommendedCommands.some((command) => command.command === "pnpm --filter @acme/web test"));
  assert.ok(report.recommendedCommands.some((command) => command.command === "turbo run test"));
  assert.ok(text.includes("## Affected Workspaces"));
  assert.ok(text.includes("`apps/web/` (@acme/web)"));
  assert.ok(text.includes("pnpm --filter @acme/web test"));
});

test("impact CLI returns JSON and rejects missing paths", async () => {
  const root = await makeRepo();
  const result = await runCli(["impact", "--root", root, "--json", ".github/workflows/ci.yml"]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.status, "medium");
  assert.ok(report.recommendedCommands.length > 0);

  const missing = await runCli(["impact", "--root", root]);
  assert.equal(missing.status, 1);
  assert.ok(missing.stderr.includes("impact requires at least one repo-relative path or --changed"));
});

test("impact CLI can read current git changed paths", async () => {
  const root = await makeRepo();
  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);

  const result = await runCli(["impact", "--root", root, "--changed", "--json"]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.pathSource, "git_changed");
  assert.equal(report.status, "medium");
  assert.ok(report.paths.includes("src/index.js"));
  assert.ok(report.paths.includes(".github/workflows/ci.yml"));
  assert.ok(report.impacts.some((impact) => impact.categories.includes("ci")));
});

test("impact report flags paths outside the repo", async () => {
  const root = await makeRepo();
  const report = await buildImpactReport({ root, paths: [path.join(os.tmpdir(), "outside.txt")] });

  assert.equal(report.ok, false);
  assert.equal(report.status, "high");
  assert.equal(report.impacts[0].outsideRoot, true);
});

test("impact report treats the repo root as an in-repo path", async () => {
  const root = await makeRepo();
  const report = await buildImpactReport({ root, paths: ["."] });

  assert.equal(report.ok, true);
  assert.equal(report.paths[0], ".");
  assert.equal(report.impacts[0].outsideRoot, false);
  assert.equal(report.impacts[0].exists, true);
});

test("impact report stays quiet when git changed mode has no paths", async () => {
  const root = await makeRepo();
  const report = await buildImpactReport({ root, paths: [], pathSource: "git_changed" });
  const text = formatImpactReport(report);

  assert.equal(report.ok, true);
  assert.equal(report.status, "low");
  assert.deepEqual(report.recommendedCommands, []);
  assert.ok(text.includes("No changed paths detected by git."));
});
