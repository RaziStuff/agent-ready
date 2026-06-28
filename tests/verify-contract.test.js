import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { loadSchemaById } from "../src/schemas/catalog.js";
import { formatContractVerification, validateAgainstSchema, verifyContract } from "../src/schemas/verify-contract.js";

function statusReport(overrides = {}) {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    root: "/tmp/repo",
    strict: false,
    summary: {
      purpose: "Verify contract target.",
      packageManagers: [],
      frameworks: []
    },
    doctor: {
      ok: true,
      strict: false,
      status: "ready",
      counts: {},
      nextSteps: [],
      validation: {}
    },
    worktree: {
      available: true,
      pathSource: "git_changed",
      changedPathCount: 0,
      changedPaths: []
    },
    preflight: null,
    validation: {
      recommended: [],
      receipts: []
    },
    adoption: {
      recipes: {
        cli: "agent-ready recipes --json",
        mcp: "agent-ready://recipes-json",
        recommendedRecipe: "final-answer-loop"
      },
      ci: {
        workflowPath: ".github/workflows/agent-ready.yml",
        workflowDetected: false,
        previewCommand: "agent-ready add-to-ci --json",
        writeCommand: "agent-ready add-to-ci --write",
        note: "Preview CI adoption."
      }
    },
    ok: true,
    status: "ready",
    nextSteps: [],
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

test("verifyContract returns a valid report for matching JSON", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-contract-"));
  const reportPath = await writeJson(root, "status.json", statusReport());
  const result = await verifyContract({ reportPath, schemaId: "status" });

  assert.equal(result.ok, true);
  assert.equal(result.status, "valid");
  assert.equal(result.schema.id, "status");
  assert.equal(result.issueCount, 0);
  assert.ok(formatContractVerification(result).includes("The report matches the requested schema."));
});

test("verifyContract reports required, enum, and JSON parse failures", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-contract-"));
  const invalidReport = statusReport({
    status: "sideways"
  });
  delete invalidReport.worktree;
  const invalidPath = await writeJson(root, "invalid-status.json", invalidReport);
  const invalid = await verifyContract({ reportPath: invalidPath, schemaId: "status" });

  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.errors.some((item) => item.path === "$.worktree" && item.code === "required"));
  assert.ok(invalid.errors.some((item) => item.path === "$.status" && item.code === "enum"));

  const badJsonPath = path.join(root, "bad.json");
  await fs.writeFile(badJsonPath, "{ bad json", "utf8");
  const badJson = await verifyContract({ reportPath: badJsonPath, schemaId: "status" });

  assert.equal(badJson.ok, false);
  assert.equal(badJson.status, "invalid_json");
  assert.equal(badJson.errors[0].code, "invalid_json");
});

test("validator supports oneOf and additionalProperties used by config schema", async () => {
  const config = await loadSchemaById("config");
  const valid = validateAgainstSchema(config.schema, {
    commands: {
      quick: {
        command: "npm test",
        risk: "low"
      }
    }
  });
  assert.deepEqual(valid, []);

  const invalid = validateAgainstSchema(config.schema, {
    unexpected: true,
    commands: {
      quick: {
        command: "npm test",
        risk: "extreme"
      },
      impossible: 42
    }
  });

  assert.ok(invalid.some((item) => item.path === "$.unexpected" && item.code === "additionalProperties"));
  assert.ok(invalid.some((item) => item.path === "$.commands.quick.risk" && item.code === "enum"));
  assert.ok(invalid.some((item) => item.path === "$.commands.impossible" && item.code === "oneOf"));
});

test("verify-contract CLI returns JSON and nonzero for invalid reports", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-contract-"));
  const validPath = await writeJson(root, "status.json", statusReport());
  const validResult = await runCli(["verify-contract", validPath, "--schema", "status", "--json"]);
  const valid = JSON.parse(validResult.stdout);

  assert.equal(validResult.status, 0);
  assert.equal(valid.status, "valid");

  const invalidPath = await writeJson(root, "invalid-status.json", {
    schemaVersion: "0.1.0"
  });
  const invalidResult = await runCli(["verify-contract", invalidPath, "--schema", "status", "--json"]);
  const invalid = JSON.parse(invalidResult.stdout);

  assert.equal(invalidResult.status, 1);
  assert.equal(invalid.status, "invalid");
  assert.ok(invalid.errors.some((item) => item.path === "$.status"));

  const unknownResult = await runCli(["verify-contract", validPath, "--schema", "missing", "--json"]);
  const unknown = JSON.parse(unknownResult.stdout);
  assert.equal(unknownResult.status, 1);
  assert.equal(unknown.status, "unknown_schema");
  assert.ok(unknown.errors[0].availableSchemas.includes("status"));
});
