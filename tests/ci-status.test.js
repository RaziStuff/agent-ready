import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { buildCiStatusReport, formatCiStatusReport } from "../src/ci/status.js";

function statusReceipt(overrides = {}) {
  return {
    ok: true,
    status: "ready",
    root: "/tmp/repo",
    doctor: {
      status: "ready"
    },
    worktree: {
      changedPathCount: 3,
      changedPaths: ["src/index.js", "README.md", ".github/workflows/ci.yml"]
    },
    validation: {
      recommended: [{}],
      receipts: [{}]
    },
    nextSteps: ["Run agent-ready handoff --changed."],
    ...overrides
  };
}

function contractReceipt(overrides = {}) {
  return {
    ok: true,
    status: "valid",
    schema: {
      id: "status"
    },
    issueCount: 0,
    errors: [],
    ...overrides
  };
}

async function writeJson(root, name, value) {
  const filePath = path.join(root, name);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
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

test("ci-status summarizes valid status and contract receipts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-ci-status-"));
  const statusFile = await writeJson(root, "agent-ready-status.json", statusReceipt());
  const contractFile = await writeJson(root, "agent-ready-contract.json", contractReceipt());
  const report = await buildCiStatusReport({ statusFile, contractFile });

  assert.equal(report.ok, true);
  assert.equal(report.status, "ready");
  assert.equal(report.readiness.doctorStatus, "ready");
  assert.equal(report.readiness.changedPathCount, 3);
  assert.equal(report.contract.status, "valid");
  assert.equal(report.nextStep, "Run agent-ready handoff --changed.");

  const text = formatCiStatusReport(report);
  assert.ok(text.includes("# Agent Ready CI Status"));
  assert.ok(text.includes("Readiness: ready"));
  assert.ok(text.includes("Contract: valid"));
});

test("ci-status is not ok when contract receipt is invalid", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-ci-status-"));
  const statusFile = await writeJson(root, "agent-ready-status.json", statusReceipt());
  const contractFile = await writeJson(root, "agent-ready-contract.json", contractReceipt({
    ok: false,
    status: "invalid",
    issueCount: 2
  }));
  const report = await buildCiStatusReport({ statusFile, contractFile });

  assert.equal(report.ok, false);
  assert.equal(report.status, "contract_invalid");
  assert.equal(report.contract.issueCount, 2);
});

test("ci-status reports missing or malformed artifacts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-ci-status-"));
  const badStatusFile = path.join(root, "agent-ready-status.json");
  await fs.writeFile(badStatusFile, "{ bad json", "utf8");
  const report = await buildCiStatusReport({
    statusFile: badStatusFile,
    contractFile: path.join(root, "missing-contract.json")
  });

  assert.equal(report.ok, false);
  assert.equal(report.status, "unavailable");
  assert.ok(report.errors.some((item) => item.code === "invalid_json"));
  assert.ok(report.errors.some((item) => item.code === "read_error"));
});

test("ci-status CLI returns JSON and nonzero for failing receipts", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-ci-status-"));
  const statusFile = await writeJson(root, "status.json", statusReceipt());
  const contractFile = await writeJson(root, "contract.json", contractReceipt());
  const result = await runCli(["ci-status", "--status-file", statusFile, "--contract-file", contractFile, "--json"]);
  const report = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(report.status, "ready");
  assert.equal(report.contract.status, "valid");

  const failingContract = await writeJson(root, "bad-contract.json", contractReceipt({
    ok: false,
    status: "invalid"
  }));
  const failingResult = await runCli(["ci-status", "--status-file", statusFile, "--contract-file", failingContract, "--json"]);
  const failing = JSON.parse(failingResult.stdout);

  assert.equal(failingResult.status, 1);
  assert.equal(failing.status, "contract_invalid");
});
