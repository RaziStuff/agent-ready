import fs from "node:fs/promises";
import path from "node:path";
import { pathExists, toPosixPath } from "../core/inventory.js";

const DEFAULT_WORKFLOW_PATH = ".github/workflows/agent-ready.yml";
export const DEFAULT_ACTION_REF = "RaziStuff/agent-ready@v0.2.2";
const VALID_MODES = new Set(["required", "advisory"]);

function yamlString(value) {
  return JSON.stringify(String(value));
}

function normalizeMode(mode) {
  const normalized = String(mode ?? "required").trim().toLowerCase();
  if (!VALID_MODES.has(normalized)) {
    throw new Error(`Unsupported CI mode: ${mode}. Expected required or advisory.`);
  }
  return normalized;
}

function resolveWorkflowPath(root, workflowPath = DEFAULT_WORKFLOW_PATH) {
  const absolutePath = path.resolve(root, workflowPath);
  const relPath = path.relative(root, absolutePath);
  if (!relPath || relPath.startsWith("..") || path.isAbsolute(relPath)) {
    throw new Error("CI workflow path must stay inside the repository root.");
  }
  return {
    path: toPosixPath(relPath),
    absolutePath
  };
}

export function generateGithubActionsWorkflow({
  actionRef = DEFAULT_ACTION_REF,
  mode = "required",
  strict = true,
  artifacts = true
} = {}) {
  const normalizedMode = normalizeMode(mode);
  const strictValue = strict === true ? "true" : "false";
  const artifactSteps = artifacts === true
    ? `      - name: Write agent-ready status receipt
        if: always()
        uses: ${actionRef}
        with:
          command: status
          mode: advisory
          strict: ${yamlString(strictValue)}
          json: "true"
          output-file: agent-ready-status.json
      - name: Verify status receipt contract
        if: always()
        uses: ${actionRef}
        with:
          command: verify-contract
          mode: ${normalizedMode}
          args: agent-ready-status.json --schema status
          json: "true"
          output-file: agent-ready-contract.json
      - name: Upload agent-ready receipts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: agent-ready-receipts
          path: |
            agent-ready-status.json
            agent-ready-contract.json
          if-no-files-found: warn
`
    : "";

  return `name: Agent Ready

on:
  pull_request:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Validate agent metadata
        uses: ${actionRef}
        with:
          command: validate
          mode: ${normalizedMode}
          strict: ${yamlString(strictValue)}
${artifactSteps}`;
}

export async function buildCiWorkflow({
  root,
  workflowPath = DEFAULT_WORKFLOW_PATH,
  actionRef = DEFAULT_ACTION_REF,
  mode = "required",
  strict = true,
  artifacts = true
}) {
  const resolved = resolveWorkflowPath(root, workflowPath);
  const normalizedMode = normalizeMode(mode);
  const content = generateGithubActionsWorkflow({
    actionRef,
    mode: normalizedMode,
    strict,
    artifacts
  });

  return {
    schemaVersion: "0.1.0",
    provider: "github-actions",
    path: resolved.path,
    absolutePath: resolved.absolutePath,
    actionRef,
    command: "validate",
    mode: normalizedMode,
    strict: strict === true,
    artifacts: artifacts === true,
    artifactName: artifacts === true ? "agent-ready-receipts" : null,
    artifactFiles: artifacts === true ? ["agent-ready-status.json", "agent-ready-contract.json"] : [],
    content
  };
}

export async function writeCiWorkflow({
  root,
  workflowPath = DEFAULT_WORKFLOW_PATH,
  actionRef = DEFAULT_ACTION_REF,
  mode = "required",
  strict = true,
  artifacts = true,
  write = false,
  force = false
}) {
  const workflow = await buildCiWorkflow({ root, workflowPath, actionRef, mode, strict, artifacts });

  if (!write) {
    return {
      ...workflow,
      ok: true,
      status: "preview",
      written: false
    };
  }

  if (await pathExists(workflow.absolutePath)) {
    const current = await fs.readFile(workflow.absolutePath, "utf8");
    if (current === workflow.content) {
      return {
        ...workflow,
        ok: true,
        status: "unchanged",
        written: false
      };
    }
    if (!force) {
      throw new Error(`${workflow.path} already exists. Pass --force to replace it.`);
    }
  }

  await fs.mkdir(path.dirname(workflow.absolutePath), { recursive: true });
  await fs.writeFile(workflow.absolutePath, workflow.content, "utf8");

  return {
    ...workflow,
    ok: true,
    status: (await pathExists(workflow.absolutePath)) ? "written" : "preview",
    written: true
  };
}

export function formatCiWorkflowResult(result) {
  if (result.status === "preview") {
    return [
      "# Agent Ready CI Workflow",
      "",
      `Path: ${result.path}`,
      `Provider: ${result.provider}`,
      `Action: ${result.actionRef}`,
      `Mode: ${result.mode}`,
      `Strict: ${result.strict ? "true" : "false"}`,
      `Artifacts: ${result.artifacts ? result.artifactFiles.join(", ") : "false"}`,
      "",
      "Write this workflow with `agent-ready add-to-ci --write`.",
      "",
      "```yaml",
      result.content.trimEnd(),
      "```",
      ""
    ].join("\n");
  }

  const verb = result.status === "unchanged" ? "Already current" : "Wrote";
  return `${verb} ${result.path}\n`;
}
