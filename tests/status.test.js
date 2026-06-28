import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildStatusReport, formatStatusReport } from "../src/status/report.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-status-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeInitializedRepo({ git = true } = {}) {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Status target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Status Target\n\nStatus target for agent-ready.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
  });
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  if (git) {
    await runCommand("git", ["init"], { cwd: root });
  }
  return root;
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

test("status report summarizes readiness, worktree, validation, and adoption", async () => {
  const root = await makeInitializedRepo();
  const report = await buildStatusReport({ root });

  assert.equal(report.ok, true);
  assert.ok(["ready", "needs_validation", "needs_review"].includes(report.status));
  assert.equal(report.doctor.status, "ready");
  assert.equal(report.worktree.available, true);
  assert.ok(report.worktree.changedPathCount > 0);
  assert.ok(report.validation.receipts.some((receipt) => receipt.receiptCommand === "agent-ready run test --json"));
  assert.equal(report.adoption.recipes.cli, "agent-ready recipes --json");
  assert.equal(report.adoption.ci.previewCommand, "agent-ready add-to-ci --json");
  assert.ok(report.nextSteps.length > 0);
});

test("status report degrades when git changed paths are unavailable", async () => {
  const root = await makeInitializedRepo({ git: false });
  const report = await buildStatusReport({ root });

  assert.equal(report.ok, true);
  assert.equal(report.status, "needs_attention");
  assert.equal(report.worktree.available, false);
  assert.match(report.worktree.error, /Could not read git changed paths/);
  assert.ok(report.nextSteps.some((step) => step.includes("git worktree")));
});

test("status formatter returns compact markdown dashboard", async () => {
  const root = await makeInitializedRepo();
  const report = await buildStatusReport({ root });
  const text = formatStatusReport(report);

  assert.ok(text.startsWith("# Agent Ready Status"));
  assert.ok(text.includes("## Worktree"));
  assert.ok(text.includes("## Validation Receipts"));
  assert.ok(text.includes("agent-ready recipes --json"));
});

test("status CLI returns JSON and markdown", async () => {
  const root = await makeInitializedRepo();
  const jsonResult = await runCli(["status", "--root", root, "--json"]);
  const report = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(report.worktree.available, true);
  assert.ok(report.validation.receipts.length > 0);

  const textResult = await runCli(["status", "--root", root]);
  assert.equal(textResult.status, 0);
  assert.ok(textResult.stdout.includes("# Agent Ready Status"));
});
