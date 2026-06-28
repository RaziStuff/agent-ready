#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathExists } from "../src/core/inventory.js";

const REQUIRED_MANIFEST_FIELDS = ["name", "version", "description", "type", "bin", "license", "files"];
const REQUIRED_PACKAGE_PATHS = [
  "src",
  "schemas",
  "docs",
  "action.yml",
  "agent-ready.config.example.json",
  "README.md",
  "LICENSE",
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "RELEASE_NOTES.md",
  "SECURITY.md"
];
const REQUIRED_SCHEMA_FILES = [
  "schemas/config.schema.json",
  "schemas/repo-map.schema.json",
  "schemas/commands.schema.json",
  "schemas/workspaces.schema.json",
  "schemas/affected.schema.json",
  "schemas/impact.schema.json",
  "schemas/handoff.schema.json",
  "schemas/preflight.schema.json",
  "schemas/run-receipt.schema.json",
  "schemas/status.schema.json"
];
const REQUIRED_DOC_FILES = [
  "docs/adoption-playbook.md",
  "docs/mcp-clients.md",
  "docs/agent-recipes.md",
  "docs/agent-recipes.json"
];

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function assertExists(relPath) {
  if (!(await pathExists(path.join(process.cwd(), relPath)))) {
    fail(`Missing required path: ${relPath}`);
  }
}

function runNode(args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"]
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
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"]
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
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

async function assertManifest(packageJson) {
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in packageJson)) {
      fail(`package.json missing ${field}`);
    }
  }

  if (packageJson.type !== "module") {
    fail('package.json must use "type": "module"');
  }

  if (!packageJson.bin || packageJson.bin["agent-ready"] !== "./src/cli/main.js") {
    fail('package.json bin.agent-ready must point to "./src/cli/main.js"');
  }

  if (!Array.isArray(packageJson.files)) {
    fail("package.json files must be an array");
  }

  for (const requiredPath of REQUIRED_PACKAGE_PATHS) {
    if (!packageJson.files.includes(requiredPath)) {
      fail(`package.json files must include ${requiredPath}`);
    }
    await assertExists(requiredPath);
  }
}

async function assertCliBin(packageJson) {
  const binPath = packageJson.bin["agent-ready"].replace(/^\.\//, "");
  const absoluteBinPath = path.join(process.cwd(), binPath);
  const binContent = await fs.readFile(absoluteBinPath, "utf8");
  if (!binContent.startsWith("#!/usr/bin/env node")) {
    fail(`${binPath} must start with a node shebang`);
  }

  const versionResult = await runNode([absoluteBinPath, "--version"]);
  if (versionResult.status !== 0) {
    fail(`CLI --version failed: ${versionResult.stderr.trim()}`);
  }
  if (versionResult.stdout.trim() !== packageJson.version) {
    fail(`CLI --version returned ${versionResult.stdout.trim()}, expected ${packageJson.version}`);
  }

  const recipesResult = await runNode([absoluteBinPath, "recipes", "--json"]);
  if (recipesResult.status !== 0) {
    fail(`CLI recipes --json failed: ${recipesResult.stderr.trim() || recipesResult.stdout.trim()}`);
  }
  const recipes = JSON.parse(recipesResult.stdout);
  if (!recipes.recipes?.some((recipe) => recipe.id === "cli-task-loop")) {
    fail("CLI recipes --json did not return the built-in CLI task loop.");
  }

  const recipeResult = await runNode([absoluteBinPath, "recipes", "mcp-first-loop"]);
  if (recipeResult.status !== 0 || !recipeResult.stdout.includes("# MCP-first agent loop")) {
    fail("CLI recipes mcp-first-loop did not return the expected Markdown recipe.");
  }

  const schemasResult = await runNode([absoluteBinPath, "schemas", "--json"]);
  if (schemasResult.status !== 0) {
    fail(`CLI schemas --json failed: ${schemasResult.stderr.trim() || schemasResult.stdout.trim()}`);
  }
  const schemas = JSON.parse(schemasResult.stdout);
  if (!schemas.schemas?.some((schema) => schema.id === "status")) {
    fail("CLI schemas --json did not return the status schema catalog entry.");
  }

  const statusSchemaResult = await runNode([absoluteBinPath, "schemas", "status", "--json"]);
  if (statusSchemaResult.status !== 0) {
    fail(`CLI schemas status --json failed: ${statusSchemaResult.stderr.trim() || statusSchemaResult.stdout.trim()}`);
  }
  const statusSchema = JSON.parse(statusSchemaResult.stdout);
  if (statusSchema.title !== "agent-ready status report") {
    fail("CLI schemas status --json did not return the status schema.");
  }

  const workspaceSchemaResult = await runNode([absoluteBinPath, "schemas", "workspaces", "--json"]);
  if (workspaceSchemaResult.status !== 0) {
    fail(`CLI schemas workspaces --json failed: ${workspaceSchemaResult.stderr.trim() || workspaceSchemaResult.stdout.trim()}`);
  }
  const workspaceSchema = JSON.parse(workspaceSchemaResult.stdout);
  if (workspaceSchema.title !== "agent-ready workspace catalog") {
    fail("CLI schemas workspaces --json did not return the workspace schema.");
  }

  const affectedSchemaResult = await runNode([absoluteBinPath, "schemas", "affected", "--json"]);
  if (affectedSchemaResult.status !== 0) {
    fail(`CLI schemas affected --json failed: ${affectedSchemaResult.stderr.trim() || affectedSchemaResult.stdout.trim()}`);
  }
  const affectedSchema = JSON.parse(affectedSchemaResult.stdout);
  if (affectedSchema.title !== "agent-ready affected workspaces report") {
    fail("CLI schemas affected --json did not return the affected schema.");
  }

  const ciPreviewResult = await runNode([absoluteBinPath, "add-to-ci", "--json", "--uses", "acme/agent-ready@v1"]);
  if (ciPreviewResult.status !== 0) {
    fail(`CLI add-to-ci --json failed: ${ciPreviewResult.stderr.trim() || ciPreviewResult.stdout.trim()}`);
  }
  const ciPreview = JSON.parse(ciPreviewResult.stdout);
  if (
    ciPreview.status !== "preview"
    || !ciPreview.content?.includes("uses: acme/agent-ready@v1")
    || !ciPreview.content?.includes("agent-ready-status.json")
    || !ciPreview.content?.includes("verify-contract")
    || !ciPreview.content?.includes("actions/upload-artifact@v4")
  ) {
    fail("CLI add-to-ci --json did not return a workflow preview.");
  }
}

async function assertSchemas() {
  for (const schemaPath of REQUIRED_SCHEMA_FILES) {
    await assertExists(schemaPath);
    const schema = await readJson(path.join(process.cwd(), schemaPath));
    if (!schema.$schema || !schema.title || schema.type !== "object") {
      fail(`${schemaPath} is missing expected schema metadata`);
    }
  }
}

async function assertDocs() {
  for (const docPath of REQUIRED_DOC_FILES) {
    await assertExists(docPath);
  }

  const mcpContent = await fs.readFile(path.join(process.cwd(), "docs/mcp-clients.md"), "utf8");
  if (!mcpContent.includes("MCP Client Recipes") || !mcpContent.includes("agent-ready mcp")) {
    fail("docs/mcp-clients.md is missing expected MCP client recipe content");
  }

  const adoptionContent = await fs.readFile(path.join(process.cwd(), "docs/adoption-playbook.md"), "utf8");
  for (const expected of ["Agent Ready Adoption Playbook", "agent-ready init", "agent-ready add-to-ci", "agent-ready ci-status", "agent-ready-receipts"]) {
    if (!adoptionContent.includes(expected)) {
      fail(`docs/adoption-playbook.md is missing expected adoption content: ${expected}`);
    }
  }

  const recipeContent = await fs.readFile(path.join(process.cwd(), "docs/agent-recipes.md"), "utf8");
  for (const expected of ["Agent Adoption Recipes", "docs/adoption-playbook.md", "agent-ready status", "agent-ready context", "agent-ready workspaces", "agent-ready affected", "agent-ready preflight", "agent-ready handoff", "agent-ready run", "agent-ready add-to-ci"]) {
    if (!recipeContent.includes(expected)) {
      fail(`docs/agent-recipes.md is missing expected recipe content: ${expected}`);
    }
  }

  const recipeJson = await readJson("docs/agent-recipes.json");
  if (!Array.isArray(recipeJson.recipes) || recipeJson.recipes.length < 3) {
    fail("docs/agent-recipes.json must include at least three adoption recipes");
  }
  const serializedRecipes = JSON.stringify(recipeJson);
  for (const expected of ["docs/adoption-playbook.md", "agent-ready status", "agent-ready context", "agent-ready workspaces", "agent-ready affected", "agent-ready preflight", "agent-ready handoff", "agent-ready run", "agent-ready add-to-ci"]) {
    if (!serializedRecipes.includes(expected)) {
      fail(`docs/agent-recipes.json is missing expected command: ${expected}`);
    }
  }
}

async function assertTempRepoSmoke(packageJson) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-package-"));
  const binPath = path.join(process.cwd(), packageJson.bin["agent-ready"]);

  await fs.writeFile(
    path.join(tempRoot, "package.json"),
    JSON.stringify(
      {
        name: "agent-ready-smoke-target",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.mkdir(path.join(tempRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "src", "index.js"), "export const ok = true;\n", "utf8");
  await fs.mkdir(path.join(tempRoot, "scripts"), { recursive: true });
  await fs.writeFile(path.join(tempRoot, "scripts", "quick.js"), "console.log('package quick ok');\n", "utf8");
  const gitInit = await runCommand("git", ["init"], { cwd: tempRoot });
  if (gitInit.status !== 0) {
    fail(`Temp repo git init failed: ${gitInit.stderr.trim() || gitInit.stdout.trim()}`);
  }

  const configResult = await runNode([binPath, "config", "init", "--root", tempRoot]);
  if (configResult.status !== 0) {
    fail(`CLI config init smoke failed: ${configResult.stderr.trim() || configResult.stdout.trim()}`);
  }
  if (!(await pathExists(path.join(tempRoot, "agent-ready.config.json")))) {
    fail("CLI config init smoke did not create agent-ready.config.json");
  }
  const smokeConfigPath = path.join(tempRoot, "agent-ready.config.json");
  const smokeConfig = await readJson(smokeConfigPath);
  smokeConfig.commands = {
    ...(smokeConfig.commands ?? {}),
    quick: "node scripts/quick.js"
  };
  await fs.writeFile(smokeConfigPath, `${JSON.stringify(smokeConfig, null, 2)}\n`, "utf8");

  const initResult = await runNode([binPath, "init", "--root", tempRoot]);
  if (initResult.status !== 0) {
    fail(`CLI init smoke failed: ${initResult.stderr.trim()}`);
  }

  for (const relPath of ["AGENTS.md", ".agents/repo-map.json", ".agents/commands.json", ".agents/workspaces.json"]) {
    if (!(await pathExists(path.join(tempRoot, relPath)))) {
      fail(`CLI init smoke did not create ${relPath}`);
    }
  }

  const validateResult = await runNode([binPath, "validate", "--root", tempRoot, "--strict"]);
  if (validateResult.status !== 0) {
    fail(`CLI strict validation smoke failed: ${validateResult.stderr.trim() || validateResult.stdout.trim()}`);
  }

  const doctorResult = await runNode([binPath, "doctor", "--root", tempRoot, "--json"]);
  if (doctorResult.status !== 0) {
    fail(`CLI doctor smoke failed: ${doctorResult.stderr.trim() || doctorResult.stdout.trim()}`);
  }
  const doctor = JSON.parse(doctorResult.stdout);
  if (doctor.ok !== true || !["ready", "needs_attention"].includes(doctor.status)) {
    fail("CLI doctor smoke did not return a usable readiness report.");
  }

  const contextResult = await runNode([binPath, "context", "--root", tempRoot]);
  if (contextResult.status !== 0) {
    fail(`CLI context smoke failed: ${contextResult.stderr.trim() || contextResult.stdout.trim()}`);
  }
  if (!contextResult.stdout.includes("# Agent Context Packet")) {
    fail("CLI context smoke did not return an agent context packet.");
  }

  const workspacesResult = await runNode([binPath, "workspaces", "--root", tempRoot, "--json"]);
  if (workspacesResult.status !== 0) {
    fail(`CLI workspaces smoke failed: ${workspacesResult.stderr.trim() || workspacesResult.stdout.trim()}`);
  }
  const workspaces = JSON.parse(workspacesResult.stdout);
  if (workspaces.status !== "single-package" || !Array.isArray(workspaces.packages) || !workspaces.nextSteps?.length) {
    fail("CLI workspaces smoke did not return a usable workspace report.");
  }
  const affectedResult = await runNode([binPath, "affected", "--root", tempRoot, "--json", "src/index.js"]);
  if (affectedResult.status !== 0) {
    fail(`CLI affected smoke failed: ${affectedResult.stderr.trim() || affectedResult.stdout.trim()}`);
  }
  const affected = JSON.parse(affectedResult.stdout);
  if (affected.status !== "single-package" || affected.pathSource !== "provided" || !Array.isArray(affected.unmatchedPaths)) {
    fail("CLI affected smoke did not return a usable affected workspace report.");
  }

  const statusResult = await runNode([binPath, "status", "--root", tempRoot, "--json"]);
  if (statusResult.status !== 0) {
    fail(`CLI status smoke failed: ${statusResult.stderr.trim() || statusResult.stdout.trim()}`);
  }
  const status = JSON.parse(statusResult.stdout);
  if (status.worktree?.available !== true || !status.adoption?.recipes?.cli?.includes("recipes")) {
    fail("CLI status smoke did not return worktree and adoption guidance.");
  }
  const statusReportPath = path.join(tempRoot, "status-report.json");
  await fs.writeFile(statusReportPath, statusResult.stdout, "utf8");
  const contractResult = await runNode([binPath, "verify-contract", statusReportPath, "--schema", "status", "--json"]);
  if (contractResult.status !== 0) {
    fail(`CLI verify-contract smoke failed: ${contractResult.stderr.trim() || contractResult.stdout.trim()}`);
  }
  const contract = JSON.parse(contractResult.stdout);
  if (contract.status !== "valid" || contract.schema?.id !== "status") {
    fail("CLI verify-contract smoke did not validate the saved status report.");
  }
  const contractReportPath = path.join(tempRoot, "contract-report.json");
  await fs.writeFile(contractReportPath, contractResult.stdout, "utf8");
  const ciStatusResult = await runNode([
    binPath,
    "ci-status",
    "--status-file",
    statusReportPath,
    "--contract-file",
    contractReportPath,
    "--json"
  ]);
  if (ciStatusResult.status !== 0) {
    fail(`CLI ci-status smoke failed: ${ciStatusResult.stderr.trim() || ciStatusResult.stdout.trim()}`);
  }
  const ciStatus = JSON.parse(ciStatusResult.stdout);
  if (ciStatus.contract?.status !== "valid" || ciStatus.readiness?.status === "unknown" || !ciStatus.artifacts?.statusFile) {
    fail("CLI ci-status smoke did not summarize status and contract receipts.");
  }

  const impactResult = await runNode([binPath, "impact", "--root", tempRoot, "--json", "src/index.js"]);
  if (impactResult.status !== 0) {
    fail(`CLI impact smoke failed: ${impactResult.stderr.trim() || impactResult.stdout.trim()}`);
  }
  const impact = JSON.parse(impactResult.stdout);
  if (!Array.isArray(impact.impacts) || impact.impacts.length !== 1) {
    fail("CLI impact smoke did not return path impact data.");
  }

  const changedImpactResult = await runNode([binPath, "impact", "--root", tempRoot, "--changed", "--json"]);
  if (changedImpactResult.status !== 0) {
    fail(`CLI changed impact smoke failed: ${changedImpactResult.stderr.trim() || changedImpactResult.stdout.trim()}`);
  }
  const changedImpact = JSON.parse(changedImpactResult.stdout);
  if (changedImpact.pathSource !== "git_changed" || !changedImpact.paths?.includes("src/index.js")) {
    fail("CLI changed impact smoke did not return git changed path data.");
  }

  const handoffResult = await runNode([binPath, "handoff", "--root", tempRoot, "--json", "src/index.js"]);
  if (handoffResult.status !== 0) {
    fail(`CLI handoff smoke failed: ${handoffResult.stderr.trim() || handoffResult.stdout.trim()}`);
  }
  const handoff = JSON.parse(handoffResult.stdout);
  if (handoff.impact?.status !== "low" || !handoff.recommendedValidation?.some((command) => command.command === "npm test")) {
    fail("CLI handoff smoke did not return validation guidance.");
  }

  const changedHandoffResult = await runNode([binPath, "handoff", "--root", tempRoot, "--changed", "--json"]);
  if (changedHandoffResult.status !== 0) {
    fail(`CLI changed handoff smoke failed: ${changedHandoffResult.stderr.trim() || changedHandoffResult.stdout.trim()}`);
  }
  const changedHandoff = JSON.parse(changedHandoffResult.stdout);
  if (changedHandoff.impact?.pathSource !== "git_changed" || !changedHandoff.impact?.paths?.includes("src/index.js")) {
    fail("CLI changed handoff smoke did not return git changed path data.");
  }

  const preflightResult = await runNode([binPath, "preflight", "--root", tempRoot, "--json", "src/index.js"]);
  if (preflightResult.status !== 0) {
    fail(`CLI preflight smoke failed: ${preflightResult.stderr.trim() || preflightResult.stdout.trim()}`);
  }
  const preflight = JSON.parse(preflightResult.stdout);
  if (preflight.status !== "needs_validation" || !preflight.recommendedValidation?.some((command) => command.command === "npm test")) {
    fail("CLI preflight smoke did not return validation guidance.");
  }

  const changedPreflightResult = await runNode([binPath, "preflight", "--root", tempRoot, "--json"]);
  if (changedPreflightResult.status !== 0) {
    fail(`CLI changed preflight smoke failed: ${changedPreflightResult.stderr.trim() || changedPreflightResult.stdout.trim()}`);
  }
  const changedPreflight = JSON.parse(changedPreflightResult.stdout);
  if (changedPreflight.pathSource !== "git_changed" || !changedPreflight.impact?.paths?.includes("src/index.js")) {
    fail("CLI changed preflight smoke did not return git changed path data.");
  }

  const runResult = await runNode([binPath, "run", "--root", tempRoot, "--json", "quick"]);
  if (runResult.status !== 0) {
    fail(`CLI run smoke failed: ${runResult.stderr.trim() || runResult.stdout.trim()}`);
  }
  const runReceipt = JSON.parse(runResult.stdout);
  if (runReceipt.status !== "passed" || !runReceipt.stdout?.includes("package quick ok")) {
    fail("CLI run smoke did not return a passing command receipt.");
  }

  const mcpInput = [
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list" }),
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "resources/templates/list" }),
    JSON.stringify({ jsonrpc: "2.0", id: 3, method: "prompts/list" }),
    JSON.stringify({ jsonrpc: "2.0", id: 4, method: "resources/read", params: { uri: "agent-ready://doctor" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "agent_ready_doctor", arguments: { strict: true } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 6, method: "resources/read", params: { uri: "agent-ready://status" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "agent_ready_status", arguments: { strict: true } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 8, method: "resources/read", params: { uri: "agent-ready://context" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 9, method: "resources/read", params: { uri: "agent-ready://recipes" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 10, method: "resources/read", params: { uri: "agent-ready://recipes-json" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "agent_ready_impact", arguments: { paths: ["src/index.js"] } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 12, method: "tools/call", params: { name: "agent_ready_impact", arguments: { changed: true } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 13, method: "tools/call", params: { name: "agent_ready_handoff", arguments: { paths: ["src/index.js"] } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 14, method: "tools/call", params: { name: "agent_ready_preflight", arguments: { paths: ["src/index.js"] } } }),
    JSON.stringify({ jsonrpc: "2.0", id: 15, method: "resources/read", params: { uri: "agent-ready://schemas" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 16, method: "resources/read", params: { uri: "agent-ready://schema/status" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 17, method: "resources/read", params: { uri: "agent-ready://workspaces" } }),
    JSON.stringify({ jsonrpc: "2.0", id: 18, method: "tools/call", params: { name: "agent_ready_workspaces", arguments: {} } }),
    JSON.stringify({ jsonrpc: "2.0", id: 19, method: "tools/call", params: { name: "agent_ready_affected", arguments: { paths: ["src/index.js"] } } }),
    ""
  ].join("\n");
  const mcpResult = await runNode([binPath, "mcp", "--root", tempRoot], { input: mcpInput });
  if (mcpResult.status !== 0) {
    fail(`CLI MCP smoke failed: ${mcpResult.stderr.trim() || mcpResult.stdout.trim()}`);
  }
  const mcpResponses = mcpResult.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const mcpResponse = mcpResponses.find((item) => item.id === 1);
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://repo-map")) {
    fail("CLI MCP smoke did not list repo-map resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://doctor")) {
    fail("CLI MCP smoke did not list doctor resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://context")) {
    fail("CLI MCP smoke did not list context resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://status")) {
    fail("CLI MCP smoke did not list status resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://workspaces")) {
    fail("CLI MCP smoke did not list workspaces resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://recipes")) {
    fail("CLI MCP smoke did not list recipes resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://schemas")) {
    fail("CLI MCP smoke did not list schemas resource.");
  }
  const templateResponse = mcpResponses.find((item) => item.id === 2);
  if (!templateResponse.result?.resourceTemplates?.some((template) => template.uriTemplate === "agent-ready://docs/{path}")) {
    fail("CLI MCP smoke did not list docs resource template.");
  }
  if (!templateResponse.result?.resourceTemplates?.some((template) => template.uriTemplate === "agent-ready://schema/{id}")) {
    fail("CLI MCP smoke did not list schema resource template.");
  }
  const promptsResponse = mcpResponses.find((item) => item.id === 3);
  if (!promptsResponse.result?.prompts?.some((prompt) => prompt.name === "agent-ready-orient")) {
    fail("CLI MCP smoke did not list orientation prompt.");
  }
  const doctorResourceResponse = mcpResponses.find((item) => item.id === 4);
  if (JSON.parse(doctorResourceResponse.result?.contents?.[0]?.text ?? "{}").ok !== true) {
    fail("CLI MCP smoke doctor resource did not report ok.");
  }
  const doctorToolResponse = mcpResponses.find((item) => item.id === 5);
  if (JSON.parse(doctorToolResponse.result?.content?.[0]?.text ?? "{}").strict !== true) {
    fail("CLI MCP smoke doctor tool did not honor strict argument.");
  }
  const statusResourceResponse = mcpResponses.find((item) => item.id === 6);
  if (!["ready", "needs_attention"].includes(JSON.parse(statusResourceResponse.result?.contents?.[0]?.text ?? "{}").doctor?.status)) {
    fail("CLI MCP smoke status resource did not return readiness data.");
  }
  const statusToolResponse = mcpResponses.find((item) => item.id === 7);
  if (!JSON.parse(statusToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Status")) {
    fail("CLI MCP smoke status tool did not return status markdown.");
  }
  const contextResourceResponse = mcpResponses.find((item) => item.id === 8);
  if (!contextResourceResponse.result?.contents?.[0]?.text?.includes("# Agent Context Packet")) {
    fail("CLI MCP smoke context resource did not return a context packet.");
  }
  const recipesResourceResponse = mcpResponses.find((item) => item.id === 9);
  if (!recipesResourceResponse.result?.contents?.[0]?.text?.includes("# Agent Adoption Recipes")) {
    fail("CLI MCP smoke recipes resource did not return adoption recipes.");
  }
  const recipesJsonResponse = mcpResponses.find((item) => item.id === 10);
  if (!JSON.parse(recipesJsonResponse.result?.contents?.[0]?.text ?? "{}").recipes?.some((recipe) => recipe.id === "cli-task-loop")) {
    fail("CLI MCP smoke recipes-json resource did not return recipe JSON.");
  }
  const impactToolResponse = mcpResponses.find((item) => item.id === 11);
  if (!Array.isArray(JSON.parse(impactToolResponse.result?.content?.[0]?.text ?? "{}").impacts)) {
    fail("CLI MCP smoke impact tool did not return path impact data.");
  }
  const changedImpactToolResponse = mcpResponses.find((item) => item.id === 12);
  const changedImpactTool = JSON.parse(changedImpactToolResponse.result?.content?.[0]?.text ?? "{}");
  if (changedImpactTool.pathSource !== "git_changed" || !changedImpactTool.paths?.includes("src/index.js")) {
    fail("CLI MCP smoke changed impact tool did not return git changed path data.");
  }
  const handoffToolResponse = mcpResponses.find((item) => item.id === 13);
  const handoffTool = JSON.parse(handoffToolResponse.result?.content?.[0]?.text ?? "{}");
  if (!handoffTool.markdown?.includes("# Agent Handoff Packet")) {
    fail("CLI MCP smoke handoff tool did not return handoff markdown.");
  }
  const preflightToolResponse = mcpResponses.find((item) => item.id === 14);
  const preflightTool = JSON.parse(preflightToolResponse.result?.content?.[0]?.text ?? "{}");
  if (!preflightTool.markdown?.includes("# Agent Preflight")) {
    fail("CLI MCP smoke preflight tool did not return preflight markdown.");
  }
  const schemasResourceResponse = mcpResponses.find((item) => item.id === 15);
  if (!JSON.parse(schemasResourceResponse.result?.contents?.[0]?.text ?? "{}").schemas?.some((schema) => schema.id === "run-receipt")) {
    fail("CLI MCP smoke schemas resource did not return schema catalog data.");
  }
  const statusSchemaResourceResponse = mcpResponses.find((item) => item.id === 16);
  if (JSON.parse(statusSchemaResourceResponse.result?.contents?.[0]?.text ?? "{}").title !== "agent-ready status report") {
    fail("CLI MCP smoke schema template did not return the status schema.");
  }
  const workspacesResourceResponse = mcpResponses.find((item) => item.id === 17);
  const workspacesResource = JSON.parse(workspacesResourceResponse.result?.contents?.[0]?.text ?? "{}");
  if (!Array.isArray(workspacesResource.packages) || workspacesResource.monorepo?.detected !== false) {
    fail("CLI MCP smoke workspaces resource did not return workspace metadata.");
  }
  const workspacesToolResponse = mcpResponses.find((item) => item.id === 18);
  if (!JSON.parse(workspacesToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Workspaces")) {
    fail("CLI MCP smoke workspaces tool did not return workspace markdown.");
  }
  const affectedToolResponse = mcpResponses.find((item) => item.id === 19);
  if (!JSON.parse(affectedToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Affected Workspaces")) {
    fail("CLI MCP smoke affected tool did not return affected workspace markdown.");
  }

  const addToCiPreview = await runNode([binPath, "add-to-ci", "--root", tempRoot, "--json", "--uses", "acme/agent-ready@v1"]);
  if (addToCiPreview.status !== 0) {
    fail(`CLI add-to-ci preview smoke failed: ${addToCiPreview.stderr.trim() || addToCiPreview.stdout.trim()}`);
  }
  const ciPreview = JSON.parse(addToCiPreview.stdout);
  if (
    ciPreview.status !== "preview"
    || ciPreview.written !== false
    || ciPreview.artifacts !== true
    || !ciPreview.content?.includes("uses: acme/agent-ready@v1")
    || !ciPreview.content?.includes("agent-ready-contract.json")
  ) {
    fail("CLI add-to-ci preview smoke did not return workflow content.");
  }

  const addToCiWrite = await runNode([binPath, "add-to-ci", "--root", tempRoot, "--write", "--mode", "advisory", "--no-strict", "--json"]);
  if (addToCiWrite.status !== 0) {
    fail(`CLI add-to-ci write smoke failed: ${addToCiWrite.stderr.trim() || addToCiWrite.stdout.trim()}`);
  }
  const ciWrite = JSON.parse(addToCiWrite.stdout);
  if (ciWrite.status !== "written" || ciWrite.mode !== "advisory" || ciWrite.strict !== false) {
    fail("CLI add-to-ci write smoke did not return write metadata.");
  }
  if (!(await pathExists(path.join(tempRoot, ".github/workflows/agent-ready.yml")))) {
    fail("CLI add-to-ci write smoke did not create workflow file.");
  }
  const writtenWorkflow = await fs.readFile(path.join(tempRoot, ".github/workflows/agent-ready.yml"), "utf8");
  if (!writtenWorkflow.includes("actions/upload-artifact@v4") || !writtenWorkflow.includes("agent-ready-status.json")) {
    fail("CLI add-to-ci write smoke did not create receipt artifact steps.");
  }

  await fs.rm(tempRoot, { recursive: true, force: true });
}

async function main() {
  const packageJson = await readJson(path.join(process.cwd(), "package.json"));
  await assertManifest(packageJson);
  await assertCliBin(packageJson);
  await assertSchemas();
  await assertDocs();
  await assertTempRepoSmoke(packageJson);
  console.log("Package smoke check passed.");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
