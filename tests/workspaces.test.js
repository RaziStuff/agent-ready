import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { validateAgainstSchema } from "../src/schemas/verify-contract.js";
import {
  buildAffectedWorkspacesReport,
  buildWorkspacesReport,
  formatAffectedWorkspacesReport,
  formatWorkspacesReport
} from "../src/workspaces/report.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-workspaces-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeWorkspaceRepo() {
  return makeFixture({
    "package.json": JSON.stringify({
      description: "Workspace report target",
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
        dev: "next dev",
        test: "vitest run"
      }
    }),
    "apps/web/src/page.tsx": "export default function Page() { return null; }\n",
    "packages/ui/package.json": JSON.stringify({
      name: "@acme/ui",
      scripts: {
        build: "tsup",
        lint: "eslint .",
        typecheck: "tsc --noEmit"
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

test("workspace report summarizes packages and scoped commands", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildWorkspacesReport({ root });

  assert.equal(report.ok, true);
  assert.equal(report.status, "workspace");
  assert.equal(report.summary.packageCount, 2);
  assert.ok(report.monorepo.tools.some((tool) => tool.name === "Turborepo"));
  assert.ok(report.commands.workspace.some((command) => command.command === "turbo run test"));
  assert.ok(report.packages.some((workspacePackage) => workspacePackage.path === "apps/web" && workspacePackage.name === "@acme/web"));
  assert.ok(report.commands.packageScoped.some((command) => command.command === "pnpm --filter @acme/web test"));
  assert.ok(report.nextSteps.some((step) => step.includes("package-scoped commands")));
});

test("workspace formatter returns markdown package guidance", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildWorkspacesReport({ root });
  const text = formatWorkspacesReport(report);

  assert.ok(text.startsWith("# Agent Ready Workspaces"));
  assert.ok(text.includes("`apps/web/`: `@acme/web`"));
  assert.ok(text.includes("`test`: `pnpm --filter @acme/web test`"));
  assert.ok(text.includes("## Next Steps"));
});

test("workspace CLI returns JSON and markdown", async () => {
  const root = await makeWorkspaceRepo();
  const jsonResult = await runCli(["workspaces", "--root", root, "--json"]);
  const report = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(report.status, "workspace");
  assert.ok(report.packages.some((workspacePackage) => workspacePackage.name === "@acme/ui"));

  const markdownResult = await runCli(["workspaces", "--root", root]);
  assert.equal(markdownResult.status, 0);
  assert.ok(markdownResult.stdout.includes("# Agent Ready Workspaces"));
});

test("affected workspace report summarizes planned package paths", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildAffectedWorkspacesReport({
    root,
    paths: ["apps/web/src/page.tsx"]
  });
  const text = formatAffectedWorkspacesReport(report);

  assert.equal(report.ok, true);
  assert.equal(report.status, "affected");
  assert.equal(report.pathSource, "provided");
  assert.equal(report.affectedPackages.length, 1);
  assert.equal(report.affectedPackages[0].name, "@acme/web");
  assert.deepEqual(report.affectedPackages[0].changedPaths, ["apps/web/src/page.tsx"]);
  assert.ok(report.recommendedCommands.some((command) => command.command === "pnpm --filter @acme/web test"));
  assert.ok(text.includes("# Agent Ready Affected Workspaces"));
  assert.ok(text.includes("`apps/web/`: `@acme/web`"));
});

test("affected workspace CLI defaults to git changed paths and workspaces --changed aliases it", async () => {
  const root = await makeWorkspaceRepo();
  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);

  const affectedResult = await runCli(["affected", "--root", root, "--json"]);
  const affected = JSON.parse(affectedResult.stdout);
  assert.equal(affectedResult.status, 0);
  assert.equal(affected.pathSource, "git_changed");
  assert.ok(affected.affectedPackages.some((workspacePackage) => workspacePackage.name === "@acme/web"));

  const changedResult = await runCli(["workspaces", "--root", root, "--changed", "--json"]);
  const changed = JSON.parse(changedResult.stdout);
  assert.equal(changedResult.status, 0);
  assert.equal(changed.pathSource, "git_changed");
  assert.ok(changed.affectedPackages.some((workspacePackage) => workspacePackage.name === "@acme/ui"));
});

test("workspace metadata validates against the published schema", async () => {
  const root = await makeWorkspaceRepo();
  const scan = await scanRepo({ root });
  await writeMetadata({ root, scan });

  const metadata = JSON.parse(await fs.readFile(path.join(root, ".agents", "workspaces.json"), "utf8"));
  const schema = JSON.parse(await fs.readFile(path.join(process.cwd(), "schemas/workspaces.schema.json"), "utf8"));

  assert.equal(metadata.monorepo.detected, true);
  assert.ok(metadata.commands.packageScoped.some((command) => command.packageName === "@acme/web"));
  assert.deepEqual(validateAgainstSchema(schema, metadata), []);
});

test("affected workspace report validates against the published schema", async () => {
  const root = await makeWorkspaceRepo();
  const report = await buildAffectedWorkspacesReport({
    root,
    paths: ["packages/ui/src/index.ts"]
  });
  const schema = JSON.parse(await fs.readFile(path.join(process.cwd(), "schemas/affected.schema.json"), "utf8"));

  assert.deepEqual(validateAgainstSchema(schema, report), []);
});
