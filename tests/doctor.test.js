import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildDoctorReport, formatDoctorReport } from "../src/doctor/report.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-doctor-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeRepo({ ci = true } = {}) {
  const files = {
    "package.json": JSON.stringify({
      description: "Doctor target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Doctor Target\n\nDoctor target repo for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nDoctor guide.\n",
    "src/index.js": "export const ok = true;\n"
  };

  if (ci) {
    files[".github/workflows/ci.yml"] = "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n";
  }

  return makeFixture(files);
}

async function initializeRepo(root) {
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
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

test("doctor reports missing generated agent docs as blocking", async () => {
  const root = await makeRepo();
  const report = await buildDoctorReport({ root });

  assert.equal(report.ok, false);
  assert.equal(report.status, "blocked");
  assert.equal(report.checks.find((item) => item.id === "agent-docs")?.status, "fail");

  const text = formatDoctorReport(report);
  assert.ok(text.includes("Generated agent docs are missing or invalid."));
  assert.ok(text.includes("agent-ready init"));
});

test("doctor reports initialized repos as ready", async () => {
  const root = await makeRepo();
  await initializeRepo(root);
  const report = await buildDoctorReport({ root });

  assert.equal(report.ok, true);
  assert.equal(report.status, "ready");
  assert.equal(report.counts.fail, 0);
  assert.equal(report.counts.warn, 0);
  assert.equal(report.checks.find((item) => item.id === "commands")?.status, "ok");
  assert.equal(report.checks.find((item) => item.id === "mcp")?.status, "ok");
});

test("doctor strict mode fails when readiness warnings remain", async () => {
  const root = await makeRepo({ ci: false });
  await initializeRepo(root);
  const report = await buildDoctorReport({ root, strict: true });

  assert.equal(report.status, "needs_attention");
  assert.equal(report.ok, false);
  assert.equal(report.checks.find((item) => item.id === "ci")?.status, "warn");
});

test("doctor CLI returns JSON and nonzero status for blockers", async () => {
  const root = await makeRepo();
  const result = await runCli(["doctor", "--root", root, "--json"]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, "");
  assert.equal(report.status, "blocked");
  assert.equal(report.checks.some((item) => item.id === "agent-docs" && item.status === "fail"), true);
});

