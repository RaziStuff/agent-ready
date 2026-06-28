import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildHandoffReport, formatHandoffReport } from "../src/handoff/report.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-handoff-"));
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
      description: "Handoff target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Handoff Target\n\nHandoff target repo for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nHandoff guide.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
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

test("handoff report combines repo context, impact, and validation guidance", async () => {
  const root = await makeRepo();
  const report = await buildHandoffReport({
    root,
    paths: [".github/workflows/ci.yml"],
    goal: "ship handoff packets"
  });

  assert.equal(report.ok, true);
  assert.equal(report.goal, "ship handoff packets");
  assert.equal(report.impact.status, "medium");
  assert.ok(report.impact.impacts.some((impact) => impact.categories.includes("ci")));
  assert.ok(report.recommendedValidation.some((command) => command.command === "npm test"));
});

test("handoff formatter returns a paste-ready packet", async () => {
  const root = await makeRepo();
  const report = await buildHandoffReport({ root, paths: ["src/index.js"] });
  const text = formatHandoffReport(report);

  assert.ok(text.startsWith("# Agent Handoff Packet"));
  assert.ok(text.includes("## Completed Work"));
  assert.ok(text.includes("## Validation"));
  assert.ok(text.includes("TODO: Add commands run and outcomes."));
});

test("handoff CLI returns JSON and markdown", async () => {
  const root = await makeRepo();
  const jsonResult = await runCli(["handoff", "--root", root, "--goal", "handoff CLI", "--json", ".github/workflows/ci.yml"]);
  const report = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(report.goal, "handoff CLI");
  assert.equal(report.impact.status, "medium");

  const markdownResult = await runCli(["handoff", "--root", root, "src/index.js"]);
  assert.equal(markdownResult.status, 0);
  assert.ok(markdownResult.stdout.includes("# Agent Handoff Packet"));
});

test("handoff CLI can use current git changed paths", async () => {
  const root = await makeRepo();
  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);

  const result = await runCli(["handoff", "--root", root, "--changed", "--json"]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.impact.pathSource, "git_changed");
  assert.ok(report.impact.paths.includes(".github/workflows/ci.yml"));
});
