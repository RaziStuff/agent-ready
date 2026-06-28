import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { loadSchemaById, loadSchemaCatalog, schemaOutput } from "../src/schemas/catalog.js";

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

test("schema catalog lists published metadata and runtime contracts", async () => {
  const catalog = await loadSchemaCatalog();

  assert.equal(catalog.schemaVersion, "0.1.0");
  assert.equal(catalog.mcp.catalog, "agent-ready://schemas");
  assert.ok(catalog.schemas.some((schema) => schema.id === "commands" && schema.kind === "metadata"));
  assert.ok(catalog.schemas.some((schema) => schema.id === "workspaces" && schema.kind === "metadata"));
  assert.ok(catalog.schemas.some((schema) => schema.id === "affected" && schema.kind === "runtime-report"));
  assert.ok(catalog.schemas.some((schema) => schema.id === "status" && schema.kind === "runtime-report"));
  assert.ok(catalog.schemas.some((schema) => schema.id === "run-receipt"));
});

test("schema output returns markdown catalog and raw JSON Schema documents", async () => {
  const markdown = await schemaOutput();
  assert.equal(markdown.ok, true);
  assert.ok(markdown.text.includes("# Agent Ready JSON Schemas"));
  assert.ok(markdown.text.includes("agent-ready://schema/{id}"));

  const json = await schemaOutput({ json: true });
  const catalog = JSON.parse(json.text);
  assert.ok(catalog.schemas.some((schema) => schema.id === "impact"));

  const schema = await schemaOutput({ schemaId: "status", json: true });
  const parsed = JSON.parse(schema.text);
  assert.equal(parsed.title, "agent-ready status report");
  assert.ok(parsed.required.includes("worktree"));

  const doc = await schemaOutput({ schemaId: "run-receipt" });
  assert.ok(doc.text.includes("# agent-ready command receipt"));
  assert.ok(doc.text.includes("agent-ready run <command-name> --json"));

  const workspaceDoc = await schemaOutput({ schemaId: "workspaces" });
  assert.ok(workspaceDoc.text.includes("# agent-ready workspace catalog"));
  assert.ok(workspaceDoc.text.includes("agent-ready workspaces --json"));

  const affectedDoc = await schemaOutput({ schemaId: "affected" });
  assert.ok(affectedDoc.text.includes("# agent-ready affected workspaces report"));
  assert.ok(affectedDoc.text.includes("agent-ready affected [path...] --json"));
});

test("schema lookup accepts schema filenames and rejects unknown ids", async () => {
  const result = await loadSchemaById("schemas/status.schema.json");

  assert.equal(result.definition.id, "status");
  assert.equal(result.schema.title, "agent-ready status report");

  const missing = await schemaOutput({ schemaId: "not-real", json: true });
  const payload = JSON.parse(missing.text);

  assert.equal(missing.ok, false);
  assert.equal(payload.status, "unknown_schema");
  assert.ok(payload.availableSchemas.includes("status"));
});

test("schemas CLI returns catalog, individual schemas, and nonzero unknown status", async () => {
  const catalogResult = await runCli(["schemas", "--json"]);
  const catalog = JSON.parse(catalogResult.stdout);
  assert.equal(catalogResult.status, 0);
  assert.ok(catalog.schemas.some((schema) => schema.id === "preflight"));

  const schemaResult = await runCli(["schemas", "status", "--json"]);
  const schema = JSON.parse(schemaResult.stdout);
  assert.equal(schemaResult.status, 0);
  assert.equal(schema.title, "agent-ready status report");

  const markdownResult = await runCli(["schemas", "impact"]);
  assert.equal(markdownResult.status, 0);
  assert.ok(markdownResult.stdout.includes("# agent-ready impact report"));

  const missingResult = await runCli(["schemas", "missing-schema", "--json"]);
  const missing = JSON.parse(missingResult.stdout);
  assert.equal(missingResult.status, 1);
  assert.equal(missing.status, "unknown_schema");
});
