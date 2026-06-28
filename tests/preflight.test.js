import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildPreflightReport, formatPreflightReport } from "../src/preflight/report.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-preflight-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeRepo() {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Preflight target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Preflight Target\n\nPreflight target repo for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nPreflight guide.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
  });
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  return root;
}

async function makeWorkspaceRepo() {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Workspace preflight target",
      private: true,
      workspaces: ["apps/*", "packages/*"]
    }),
    "pnpm-lock.yaml": "lockfileVersion: '9.0'",
    "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    "turbo.json": JSON.stringify({
      tasks: {
        test: {}
      }
    }),
    "apps/web/package.json": JSON.stringify({
      name: "@acme/web",
      private: true,
      scripts: {
        test: "vitest run",
        lint: "eslint ."
      }
    }),
    "apps/web/src/page.tsx": "export default function Page() { return null; }\n",
    "packages/ui/package.json": JSON.stringify({
      name: "@acme/ui",
      scripts: {
        test: "vitest run"
      }
    }),
    "packages/ui/src/index.ts": "export const ok = true;\n"
  });
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  return root;
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

test("preflight report combines readiness, impact, validation, and handoff guidance", async () => {
  const root = await makeRepo();
  const report = await buildPreflightReport({
    root,
    paths: [".github/workflows/ci.yml"],
    goal: "ship preflight"
  });

  assert.equal(report.ok, true);
  assert.equal(report.status, "needs_validation");
  assert.equal(report.pathSource, "provided");
  assert.equal(report.goal, "ship preflight");
  assert.equal(report.impact.status, "medium");
  assert.ok(report.recommendedValidation.some((command) => command.command === "npm test"));
  assert.ok(report.handoffCommand.includes("agent-ready handoff"));
});

test("preflight formatter returns a concise handoff checklist", async () => {
  const root = await makeRepo();
  const report = await buildPreflightReport({ root, paths: ["src/index.js"] });
  const text = formatPreflightReport(report);

  assert.ok(text.startsWith("# Agent Preflight"));
  assert.ok(text.includes("## Readiness"));
  assert.ok(text.includes("## Recommended Validation"));
  assert.ok(text.includes("agent-ready handoff"));
});

test("preflight includes affected workspace package guidance", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildPreflightReport({
    root,
    paths: ["apps/web/src/page.tsx"]
  });
  const text = formatPreflightReport(report);

  assert.equal(report.status, "needs_validation");
  assert.equal(report.impact.affectedPackages.length, 1);
  assert.equal(report.impact.affectedPackages[0].name, "@acme/web");
  assert.ok(report.recommendedValidation.some((command) => command.command === "pnpm --filter @acme/web test"));
  assert.ok(text.includes("## Affected Workspaces"));
  assert.ok(text.includes("`apps/web/` (@acme/web)"));
  assert.ok(text.includes("pnpm --filter @acme/web test"));
});

test("preflight defaults to current git changed paths", async () => {
  const root = await makeRepo();
  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);

  const report = await buildPreflightReport({ root });

  assert.equal(report.pathSource, "git_changed");
  assert.equal(report.changedDefaulted, true);
  assert.ok(report.impact.paths.includes(".github/workflows/ci.yml"));
});

test("preflight CLI returns JSON and markdown", async () => {
  const root = await makeRepo();
  const jsonResult = await runCli(["preflight", "--root", root, "--json", ".github/workflows/ci.yml"]);
  const report = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(report.status, "needs_validation");
  assert.equal(report.impact.status, "medium");

  const markdownResult = await runCli(["preflight", "--root", root, "src/index.js"]);
  assert.equal(markdownResult.status, 0);
  assert.ok(markdownResult.stdout.includes("# Agent Preflight"));
});
