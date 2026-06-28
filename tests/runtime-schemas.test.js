import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildHandoffReport } from "../src/handoff/report.js";
import { buildImpactReport } from "../src/impact/report.js";
import { buildPreflightReport } from "../src/preflight/report.js";
import { runCommandReceipt } from "../src/run/report.js";
import { validateAgainstSchema } from "../src/schemas/verify-contract.js";
import { buildStatusReport } from "../src/status/report.js";
import { buildAffectedWorkspacesReport, buildWorkspacesReport } from "../src/workspaces/report.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeRuntimeRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-runtime-schemas-"));
  const nodeCommand = JSON.stringify(process.execPath);
  const files = {
    "agent-ready.config.json": JSON.stringify(
      {
        commands: {
          quick: `${nodeCommand} -e "console.log('schema receipt')"`
        }
      },
      null,
      2
    ),
    "package.json": JSON.stringify({
      description: "Runtime schema target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Runtime Schema Target\n\nRuntime schema target for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nRuntime schema guide.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
  };

  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }

  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);
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

async function readSchema(fileName) {
  const raw = await fs.readFile(path.join(process.cwd(), "schemas", fileName), "utf8");
  return JSON.parse(raw);
}

test("runtime report schemas validate real agent-ready reports", async () => {
  const root = await makeRuntimeRepo();
  const reports = {
    "impact.schema.json": await buildImpactReport({
      root,
      paths: [".github/workflows/ci.yml", "src/index.js"]
    }),
    "handoff.schema.json": await buildHandoffReport({
      root,
      paths: [".github/workflows/ci.yml"],
      goal: "ship runtime schemas"
    }),
    "preflight.schema.json": await buildPreflightReport({
      root,
      paths: [".github/workflows/ci.yml"],
      goal: "ship runtime schemas"
    }),
    "run-receipt.schema.json": await runCommandReceipt({ root, name: "quick" }),
    "status.schema.json": await buildStatusReport({ root }),
    "workspaces.schema.json": await buildWorkspacesReport({ root }),
    "affected.schema.json": await buildAffectedWorkspacesReport({ root, paths: ["src/index.js"] })
  };

  for (const [fileName, report] of Object.entries(reports)) {
    const schema = await readSchema(fileName);
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(schema.type, "object");
    assert.deepEqual(validateAgainstSchema(schema, report), [], fileName);
  }
});

test("runtime schema validator catches missing required report fields", async () => {
  const schema = await readSchema("status.schema.json");
  const issues = validateAgainstSchema(schema, {
    schemaVersion: "0.1.0",
    generatedAt: new Date().toISOString(),
    root: "/tmp/example",
    strict: false
  });

  assert.ok(issues.some((issue) => issue.path === "$.summary" && issue.code === "required"));
  assert.ok(issues.some((issue) => issue.path === "$.status" && issue.code === "required"));
});
