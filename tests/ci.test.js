import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { buildCiWorkflow, generateGithubActionsWorkflow, writeCiWorkflow } from "../src/ci/github-actions.js";
import { pathExists } from "../src/core/inventory.js";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-ci-"));
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

test("generateGithubActionsWorkflow returns strict required validation YAML", () => {
  const content = generateGithubActionsWorkflow({ actionRef: "acme/agent-ready@v1" });

  assert.ok(content.includes("name: Agent Ready"));
  assert.ok(content.includes("uses: actions/checkout@v4"));
  assert.ok(content.includes("name: Validate agent metadata"));
  assert.ok(content.includes("uses: acme/agent-ready@v1"));
  assert.ok(content.includes("command: validate"));
  assert.ok(content.includes("mode: required"));
  assert.ok(content.includes('strict: "true"'));
  assert.ok(content.includes("name: Write agent-ready status receipt"));
  assert.ok(content.includes("command: status"));
  assert.ok(content.includes("output-file: agent-ready-status.json"));
  assert.ok(content.includes("command: verify-contract"));
  assert.ok(content.includes("args: agent-ready-status.json --schema status"));
  assert.ok(content.includes("output-file: agent-ready-contract.json"));
  assert.ok(content.includes("uses: actions/upload-artifact@v4"));
  assert.ok(content.includes("name: agent-ready-receipts"));
});

test("generateGithubActionsWorkflow can omit artifact receipt steps", () => {
  const content = generateGithubActionsWorkflow({
    actionRef: "acme/agent-ready@v1",
    artifacts: false
  });

  assert.ok(content.includes("command: validate"));
  assert.ok(!content.includes("agent-ready-status.json"));
  assert.ok(!content.includes("actions/upload-artifact"));
});

test("buildCiWorkflow previews a repo-local workflow path", async () => {
  const root = await makeTempRoot();
  const workflow = await buildCiWorkflow({
    root,
    workflowPath: ".github/workflows/agent-ready.yml",
    mode: "advisory",
    strict: false
  });

  assert.equal(workflow.provider, "github-actions");
  assert.equal(workflow.path, ".github/workflows/agent-ready.yml");
  assert.equal(workflow.mode, "advisory");
  assert.equal(workflow.strict, false);
  assert.equal(workflow.artifacts, true);
  assert.deepEqual(workflow.artifactFiles, ["agent-ready-status.json", "agent-ready-contract.json"]);
  assert.ok(workflow.content.includes("mode: advisory"));
  assert.ok(workflow.content.includes('strict: "false"'));
  assert.ok(workflow.content.includes("Verify status receipt contract"));
});

test("writeCiWorkflow previews by default and writes only when requested", async () => {
  const root = await makeTempRoot();
  const target = path.join(root, ".github/workflows/agent-ready.yml");

  const preview = await writeCiWorkflow({ root });
  assert.equal(preview.status, "preview");
  assert.equal(preview.written, false);
  assert.equal(await pathExists(target), false);

  const written = await writeCiWorkflow({ root, write: true });
  assert.equal(written.status, "written");
  assert.equal(written.written, true);
  assert.equal(await pathExists(target), true);

  const unchanged = await writeCiWorkflow({ root, write: true });
  assert.equal(unchanged.status, "unchanged");
  assert.equal(unchanged.written, false);
});

test("writeCiWorkflow refuses to overwrite different workflow without force", async () => {
  const root = await makeTempRoot();
  const target = path.join(root, ".github/workflows/agent-ready.yml");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, "name: Custom\n", "utf8");

  await assert.rejects(
    writeCiWorkflow({ root, write: true }),
    /already exists/
  );

  const forced = await writeCiWorkflow({ root, write: true, force: true });
  assert.equal(forced.status, "written");
  assert.ok((await fs.readFile(target, "utf8")).includes("name: Agent Ready"));
});

test("add-to-ci CLI previews JSON and writes workflow", async () => {
  const root = await makeTempRoot();

  const previewResult = await runCli(["add-to-ci", "--root", root, "--json", "--uses", "acme/agent-ready@v1"]);
  const preview = JSON.parse(previewResult.stdout);
  assert.equal(previewResult.status, 0);
  assert.equal(preview.status, "preview");
  assert.equal(preview.written, false);
  assert.equal(preview.actionRef, "acme/agent-ready@v1");
  assert.equal(preview.artifacts, true);
  assert.ok(preview.content.includes("uses: acme/agent-ready@v1"));
  assert.ok(preview.content.includes("agent-ready-contract.json"));

  const noArtifactResult = await runCli(["add-to-ci", "--root", root, "--json", "--no-artifacts"]);
  const noArtifact = JSON.parse(noArtifactResult.stdout);
  assert.equal(noArtifactResult.status, 0);
  assert.equal(noArtifact.artifacts, false);
  assert.ok(!noArtifact.content.includes("actions/upload-artifact"));

  const writeResult = await runCli(["add-to-ci", "--root", root, "--write", "--mode", "advisory", "--no-strict", "--json"]);
  const written = JSON.parse(writeResult.stdout);
  assert.equal(writeResult.status, 0);
  assert.equal(written.status, "written");
  assert.equal(written.mode, "advisory");
  assert.equal(written.strict, false);
  assert.equal(written.artifacts, true);
  assert.equal(await pathExists(path.join(root, ".github/workflows/agent-ready.yml")), true);
});

test("composite action supports JSON output files for CI receipts", async () => {
  const content = await fs.readFile("action.yml", "utf8");

  assert.ok(content.includes("json:"));
  assert.ok(content.includes("args:"));
  assert.ok(content.includes("output-file:"));
  assert.ok(content.includes('ARGS+=("--json")'));
  assert.ok(content.includes('> "$AGENT_READY_OUTPUT_FILE"'));
});
