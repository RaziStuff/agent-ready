#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathExists } from "../src/core/inventory.js";

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function assertReleaseMetadata(packageJson) {
  if (!packageJson.homepage?.startsWith("https://github.com/RaziStuff/agent-ready")) {
    fail("package.json homepage must point to the public GitHub repository.");
  }
  if (packageJson.repository?.type !== "git" || !packageJson.repository.url?.includes("github.com/RaziStuff/agent-ready")) {
    fail("package.json repository must point to the public GitHub repository.");
  }
  if (!packageJson.bugs?.url?.startsWith("https://github.com/RaziStuff/agent-ready/issues")) {
    fail("package.json bugs.url must point to GitHub issues.");
  }
  if (packageJson.publishConfig?.access !== "public") {
    fail('package.json publishConfig.access must be "public".');
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
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

function basename(command) {
  return path.basename(command).toLowerCase();
}

function packageManagerFromCommand(command) {
  const name = basename(command);
  if (name.includes("pnpm")) return "pnpm";
  if (name.includes("npm")) return "npm";
  return null;
}

async function candidateWorks(candidate) {
  const result = await run(candidate.command, [...candidate.baseArgs, "--version"]);
  return result.status === 0;
}

async function findPackageManager() {
  if (process.env.AGENT_READY_PACKAGE_MANAGER) {
    const explicitName = packageManagerFromCommand(process.env.AGENT_READY_PACKAGE_MANAGER);
    if (!explicitName) {
      fail("AGENT_READY_PACKAGE_MANAGER must point to npm or pnpm.");
    }
    const candidate = {
      name: explicitName,
      command: process.env.AGENT_READY_PACKAGE_MANAGER,
      baseArgs: []
    };
    if (!(await candidateWorks(candidate))) {
      fail(`Configured package manager did not run: ${process.env.AGENT_READY_PACKAGE_MANAGER}`);
    }
    return candidate;
  }

  if (process.env.npm_execpath) {
    const name = packageManagerFromCommand(process.env.npm_execpath);
    if (name) {
      const candidate = {
        name,
        command: process.execPath,
        baseArgs: [process.env.npm_execpath]
      };
      if (await candidateWorks(candidate)) {
        return candidate;
      }
    }
  }

  for (const command of ["npm", "pnpm"]) {
    const name = packageManagerFromCommand(command);
    const candidate = { name, command, baseArgs: [] };
    if (await candidateWorks(candidate)) {
      return candidate;
    }
  }

  fail("Could not find npm or pnpm. Set AGENT_READY_PACKAGE_MANAGER to an npm or pnpm executable.");
}

async function packTarball(packageManager, packDir) {
  const args = [...packageManager.baseArgs, "pack", "--pack-destination", packDir];
  const result = await run(packageManager.command, args);
  if (result.status !== 0) {
    fail(`Package pack failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  const files = await fs.readdir(packDir);
  const tarballs = files.filter((file) => file.endsWith(".tgz"));
  if (tarballs.length !== 1) {
    fail(`Expected exactly one tarball in ${packDir}, found ${tarballs.length}.`);
  }

  return path.join(packDir, tarballs[0]);
}

function installArgs(packageManager, tarballPath) {
  if (packageManager.name === "pnpm") {
    return [...packageManager.baseArgs, "add", tarballPath, "--ignore-scripts"];
  }

  return [
    ...packageManager.baseArgs,
    "install",
    tarballPath,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund"
  ];
}

function binPath(installRoot) {
  if (process.platform === "win32") {
    return path.join(installRoot, "node_modules", ".bin", "agent-ready.cmd");
  }
  return path.join(installRoot, "node_modules", ".bin", "agent-ready");
}

async function createTargetRepo(targetRoot) {
  await fs.writeFile(
    path.join(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: "agent-ready-installed-target",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(path.join(targetRoot, "README.md"), "# Installed Target\n\nTiny install smoke target.\n", "utf8");
  await fs.mkdir(path.join(targetRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(targetRoot, "src", "index.js"), "export const ok = true;\n", "utf8");
  await fs.mkdir(path.join(targetRoot, "scripts"), { recursive: true });
  await fs.writeFile(path.join(targetRoot, "scripts", "quick.js"), "console.log('installed quick ok');\n", "utf8");
}

async function assertInstalledBinWorks(cliBin, packageJson, targetRoot) {
  const binEnv = {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`
  };
  const gitInit = await run("git", ["init"], { cwd: targetRoot, env: binEnv });
  if (gitInit.status !== 0) {
    fail(`Installed bin target git init failed: ${gitInit.stderr.trim() || gitInit.stdout.trim()}`);
  }

  const version = await run(cliBin, ["--version"], { env: binEnv });
  if (version.status !== 0) {
    fail(`Installed bin --version failed: ${version.stderr.trim() || version.stdout.trim()}`);
  }
  if (version.stdout.trim() !== packageJson.version) {
    fail(`Installed bin returned ${version.stdout.trim()}, expected ${packageJson.version}.`);
  }

  const recipesResult = await run(cliBin, ["recipes", "--json"], { env: binEnv });
  if (recipesResult.status !== 0) {
    fail(`Installed bin recipes --json failed: ${recipesResult.stderr.trim() || recipesResult.stdout.trim()}`);
  }
  const recipes = JSON.parse(recipesResult.stdout);
  if (!recipes.recipes?.some((recipe) => recipe.id === "cli-task-loop")) {
    fail("Installed bin recipes --json did not return the built-in CLI task loop.");
  }

  const recipeResult = await run(cliBin, ["recipes", "mcp-first-loop"], { env: binEnv });
  if (recipeResult.status !== 0 || !recipeResult.stdout.includes("# MCP-first agent loop")) {
    fail("Installed bin recipes mcp-first-loop did not return the expected Markdown recipe.");
  }

  const schemasResult = await run(cliBin, ["schemas", "--json"], { env: binEnv });
  if (schemasResult.status !== 0) {
    fail(`Installed bin schemas --json failed: ${schemasResult.stderr.trim() || schemasResult.stdout.trim()}`);
  }
  const schemas = JSON.parse(schemasResult.stdout);
  if (!schemas.schemas?.some((schema) => schema.id === "status")) {
    fail("Installed bin schemas --json did not return the status schema catalog entry.");
  }

  const statusSchemaResult = await run(cliBin, ["schemas", "status", "--json"], { env: binEnv });
  if (statusSchemaResult.status !== 0) {
    fail(`Installed bin schemas status --json failed: ${statusSchemaResult.stderr.trim() || statusSchemaResult.stdout.trim()}`);
  }
  const statusSchema = JSON.parse(statusSchemaResult.stdout);
  if (statusSchema.title !== "agent-ready status report") {
    fail("Installed bin schemas status --json did not return the status schema.");
  }

  const workspaceSchemaResult = await run(cliBin, ["schemas", "workspaces", "--json"], { env: binEnv });
  if (workspaceSchemaResult.status !== 0) {
    fail(`Installed bin schemas workspaces --json failed: ${workspaceSchemaResult.stderr.trim() || workspaceSchemaResult.stdout.trim()}`);
  }
  const workspaceSchema = JSON.parse(workspaceSchemaResult.stdout);
  if (workspaceSchema.title !== "agent-ready workspace catalog") {
    fail("Installed bin schemas workspaces --json did not return the workspace schema.");
  }

  const affectedSchemaResult = await run(cliBin, ["schemas", "affected", "--json"], { env: binEnv });
  if (affectedSchemaResult.status !== 0) {
    fail(`Installed bin schemas affected --json failed: ${affectedSchemaResult.stderr.trim() || affectedSchemaResult.stdout.trim()}`);
  }
  const affectedSchema = JSON.parse(affectedSchemaResult.stdout);
  if (affectedSchema.title !== "agent-ready affected workspaces report") {
    fail("Installed bin schemas affected --json did not return the affected schema.");
  }

  const ciPreviewResult = await run(cliBin, ["add-to-ci", "--root", targetRoot, "--json", "--uses", "acme/agent-ready@v1"], { env: binEnv });
  if (ciPreviewResult.status !== 0) {
    fail(`Installed bin add-to-ci preview failed: ${ciPreviewResult.stderr.trim() || ciPreviewResult.stdout.trim()}`);
  }
  const ciPreview = JSON.parse(ciPreviewResult.stdout);
  if (
    ciPreview.status !== "preview"
    || ciPreview.artifacts !== true
    || !ciPreview.content?.includes("uses: acme/agent-ready@v1")
    || !ciPreview.content?.includes("agent-ready-status.json")
    || !ciPreview.content?.includes("verify-contract")
    || !ciPreview.content?.includes("actions/upload-artifact@v4")
  ) {
    fail("Installed bin add-to-ci preview did not return workflow content.");
  }

  const ciWriteResult = await run(cliBin, ["add-to-ci", "--root", targetRoot, "--write", "--mode", "advisory", "--no-strict", "--json"], { env: binEnv });
  if (ciWriteResult.status !== 0) {
    fail(`Installed bin add-to-ci write failed: ${ciWriteResult.stderr.trim() || ciWriteResult.stdout.trim()}`);
  }
  const ciWrite = JSON.parse(ciWriteResult.stdout);
  if (ciWrite.status !== "written" || ciWrite.mode !== "advisory" || ciWrite.strict !== false) {
    fail("Installed bin add-to-ci write did not return write metadata.");
  }
  if (!(await pathExists(path.join(targetRoot, ".github/workflows/agent-ready.yml")))) {
    fail("Installed bin add-to-ci write did not create workflow file.");
  }
  const writtenWorkflow = await fs.readFile(path.join(targetRoot, ".github/workflows/agent-ready.yml"), "utf8");
  if (!writtenWorkflow.includes("actions/upload-artifact@v4") || !writtenWorkflow.includes("agent-ready-contract.json")) {
    fail("Installed bin add-to-ci write did not create receipt artifact steps.");
  }

  const config = await run(cliBin, ["config", "init", "--root", targetRoot], { env: binEnv });
  if (config.status !== 0) {
    fail(`Installed bin config init failed: ${config.stderr.trim() || config.stdout.trim()}`);
  }
  if (!(await pathExists(path.join(targetRoot, "agent-ready.config.json")))) {
    fail("Installed bin config init did not create agent-ready.config.json.");
  }
  const smokeConfigPath = path.join(targetRoot, "agent-ready.config.json");
  const smokeConfig = await readJson(smokeConfigPath);
  smokeConfig.commands = {
    ...(smokeConfig.commands ?? {}),
    quick: "node scripts/quick.js"
  };
  await fs.writeFile(smokeConfigPath, `${JSON.stringify(smokeConfig, null, 2)}\n`, "utf8");

  const init = await run(cliBin, ["init", "--root", targetRoot], { env: binEnv });
  if (init.status !== 0) {
    fail(`Installed bin init failed: ${init.stderr.trim() || init.stdout.trim()}`);
  }

  for (const relPath of ["AGENTS.md", ".agents/repo-map.json", ".agents/commands.json", ".agents/workspaces.json"]) {
    if (!(await pathExists(path.join(targetRoot, relPath)))) {
      fail(`Installed bin init did not create ${relPath}.`);
    }
  }

  const validate = await run(cliBin, ["validate", "--root", targetRoot, "--strict"], { env: binEnv });
  if (validate.status !== 0) {
    fail(`Installed bin validate --strict failed: ${validate.stderr.trim() || validate.stdout.trim()}`);
  }

  const doctorResult = await run(cliBin, ["doctor", "--root", targetRoot, "--json"], { env: binEnv });
  if (doctorResult.status !== 0) {
    fail(`Installed bin doctor failed: ${doctorResult.stderr.trim() || doctorResult.stdout.trim()}`);
  }
  const doctor = JSON.parse(doctorResult.stdout);
  if (doctor.ok !== true || !["ready", "needs_attention"].includes(doctor.status)) {
    fail("Installed bin doctor did not return a usable readiness report.");
  }

  const contextResult = await run(cliBin, ["context", "--root", targetRoot], { env: binEnv });
  if (contextResult.status !== 0) {
    fail(`Installed bin context failed: ${contextResult.stderr.trim() || contextResult.stdout.trim()}`);
  }
  if (!contextResult.stdout.includes("# Agent Context Packet")) {
    fail("Installed bin context did not return an agent context packet.");
  }

  const workspacesResult = await run(cliBin, ["workspaces", "--root", targetRoot, "--json"], { env: binEnv });
  if (workspacesResult.status !== 0) {
    fail(`Installed bin workspaces failed: ${workspacesResult.stderr.trim() || workspacesResult.stdout.trim()}`);
  }
  const workspaces = JSON.parse(workspacesResult.stdout);
  if (workspaces.status !== "single-package" || !Array.isArray(workspaces.packages) || !workspaces.nextSteps?.length) {
    fail("Installed bin workspaces did not return a usable workspace report.");
  }
  const affectedResult = await run(cliBin, ["affected", "--root", targetRoot, "--json", "src/index.js"], { env: binEnv });
  if (affectedResult.status !== 0) {
    fail(`Installed bin affected failed: ${affectedResult.stderr.trim() || affectedResult.stdout.trim()}`);
  }
  const affected = JSON.parse(affectedResult.stdout);
  if (affected.status !== "single-package" || affected.pathSource !== "provided" || !Array.isArray(affected.unmatchedPaths)) {
    fail("Installed bin affected did not return a usable affected workspace report.");
  }

  const statusResult = await run(cliBin, ["status", "--root", targetRoot, "--json"], { env: binEnv });
  if (statusResult.status !== 0) {
    fail(`Installed bin status failed: ${statusResult.stderr.trim() || statusResult.stdout.trim()}`);
  }
  const status = JSON.parse(statusResult.stdout);
  if (status.worktree?.available !== true || !status.adoption?.recipes?.cli?.includes("recipes")) {
    fail("Installed bin status did not return worktree and adoption guidance.");
  }
  const statusReportPath = path.join(targetRoot, "status-report.json");
  await fs.writeFile(statusReportPath, statusResult.stdout, "utf8");
  const contractResult = await run(cliBin, ["verify-contract", statusReportPath, "--schema", "status", "--json"], { env: binEnv });
  if (contractResult.status !== 0) {
    fail(`Installed bin verify-contract failed: ${contractResult.stderr.trim() || contractResult.stdout.trim()}`);
  }
  const contract = JSON.parse(contractResult.stdout);
  if (contract.status !== "valid" || contract.schema?.id !== "status") {
    fail("Installed bin verify-contract did not validate the saved status report.");
  }
  const contractReportPath = path.join(targetRoot, "contract-report.json");
  await fs.writeFile(contractReportPath, contractResult.stdout, "utf8");
  const ciStatusResult = await run(cliBin, [
    "ci-status",
    "--status-file",
    statusReportPath,
    "--contract-file",
    contractReportPath,
    "--json"
  ], { env: binEnv });
  if (ciStatusResult.status !== 0) {
    fail(`Installed bin ci-status failed: ${ciStatusResult.stderr.trim() || ciStatusResult.stdout.trim()}`);
  }
  const ciStatus = JSON.parse(ciStatusResult.stdout);
  if (ciStatus.contract?.status !== "valid" || ciStatus.readiness?.status === "unknown" || !ciStatus.artifacts?.statusFile) {
    fail("Installed bin ci-status did not summarize status and contract receipts.");
  }

  const impactResult = await run(cliBin, ["impact", "--root", targetRoot, "--json", "src/index.js"], { env: binEnv });
  if (impactResult.status !== 0) {
    fail(`Installed bin impact failed: ${impactResult.stderr.trim() || impactResult.stdout.trim()}`);
  }
  const impact = JSON.parse(impactResult.stdout);
  if (!Array.isArray(impact.impacts) || impact.impacts.length !== 1) {
    fail("Installed bin impact did not return path impact data.");
  }

  const changedImpactResult = await run(cliBin, ["impact", "--root", targetRoot, "--changed", "--json"], { env: binEnv });
  if (changedImpactResult.status !== 0) {
    fail(`Installed bin changed impact failed: ${changedImpactResult.stderr.trim() || changedImpactResult.stdout.trim()}`);
  }
  const changedImpact = JSON.parse(changedImpactResult.stdout);
  if (changedImpact.pathSource !== "git_changed" || !changedImpact.paths?.includes("src/index.js")) {
    fail("Installed bin changed impact did not return git changed path data.");
  }

  const handoffResult = await run(cliBin, ["handoff", "--root", targetRoot, "--json", "src/index.js"], { env: binEnv });
  if (handoffResult.status !== 0) {
    fail(`Installed bin handoff failed: ${handoffResult.stderr.trim() || handoffResult.stdout.trim()}`);
  }
  const handoff = JSON.parse(handoffResult.stdout);
  if (handoff.impact?.status !== "low" || !handoff.recommendedValidation?.some((command) => command.command === "npm test")) {
    fail("Installed bin handoff did not return validation guidance.");
  }

  const changedHandoffResult = await run(cliBin, ["handoff", "--root", targetRoot, "--changed", "--json"], { env: binEnv });
  if (changedHandoffResult.status !== 0) {
    fail(`Installed bin changed handoff failed: ${changedHandoffResult.stderr.trim() || changedHandoffResult.stdout.trim()}`);
  }
  const changedHandoff = JSON.parse(changedHandoffResult.stdout);
  if (changedHandoff.impact?.pathSource !== "git_changed" || !changedHandoff.impact?.paths?.includes("src/index.js")) {
    fail("Installed bin changed handoff did not return git changed path data.");
  }

  const preflightResult = await run(cliBin, ["preflight", "--root", targetRoot, "--json", "src/index.js"], { env: binEnv });
  if (preflightResult.status !== 0) {
    fail(`Installed bin preflight failed: ${preflightResult.stderr.trim() || preflightResult.stdout.trim()}`);
  }
  const preflight = JSON.parse(preflightResult.stdout);
  if (preflight.status !== "needs_validation" || !preflight.recommendedValidation?.some((command) => command.command === "npm test")) {
    fail("Installed bin preflight did not return validation guidance.");
  }

  const changedPreflightResult = await run(cliBin, ["preflight", "--root", targetRoot, "--json"], { env: binEnv });
  if (changedPreflightResult.status !== 0) {
    fail(`Installed bin changed preflight failed: ${changedPreflightResult.stderr.trim() || changedPreflightResult.stdout.trim()}`);
  }
  const changedPreflight = JSON.parse(changedPreflightResult.stdout);
  if (changedPreflight.pathSource !== "git_changed" || !changedPreflight.impact?.paths?.includes("src/index.js")) {
    fail("Installed bin changed preflight did not return git changed path data.");
  }

  const runResult = await run(cliBin, ["run", "--root", targetRoot, "--json", "quick"], { env: binEnv });
  if (runResult.status !== 0) {
    fail(`Installed bin run failed: ${runResult.stderr.trim() || runResult.stdout.trim()}`);
  }
  const runReceipt = JSON.parse(runResult.stdout);
  if (runReceipt.status !== "passed" || !runReceipt.stdout?.includes("installed quick ok")) {
    fail("Installed bin run did not return a passing command receipt.");
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
  const mcp = await run(cliBin, ["mcp", "--root", targetRoot], { env: binEnv, input: mcpInput });
  if (mcp.status !== 0) {
    fail(`Installed bin MCP smoke failed: ${mcp.stderr.trim() || mcp.stdout.trim()}`);
  }
  const mcpResponses = mcp.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));
  const mcpResponse = mcpResponses.find((item) => item.id === 1);
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://repo-map")) {
    fail("Installed bin MCP smoke did not list repo-map resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://doctor")) {
    fail("Installed bin MCP smoke did not list doctor resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://context")) {
    fail("Installed bin MCP smoke did not list context resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://status")) {
    fail("Installed bin MCP smoke did not list status resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://workspaces")) {
    fail("Installed bin MCP smoke did not list workspaces resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://recipes")) {
    fail("Installed bin MCP smoke did not list recipes resource.");
  }
  if (!mcpResponse.result?.resources?.some((resource) => resource.uri === "agent-ready://schemas")) {
    fail("Installed bin MCP smoke did not list schemas resource.");
  }
  const templateResponse = mcpResponses.find((item) => item.id === 2);
  if (!templateResponse.result?.resourceTemplates?.some((template) => template.uriTemplate === "agent-ready://docs/{path}")) {
    fail("Installed bin MCP smoke did not list docs resource template.");
  }
  if (!templateResponse.result?.resourceTemplates?.some((template) => template.uriTemplate === "agent-ready://schema/{id}")) {
    fail("Installed bin MCP smoke did not list schema resource template.");
  }
  const promptsResponse = mcpResponses.find((item) => item.id === 3);
  if (!promptsResponse.result?.prompts?.some((prompt) => prompt.name === "agent-ready-orient")) {
    fail("Installed bin MCP smoke did not list orientation prompt.");
  }
  const doctorResourceResponse = mcpResponses.find((item) => item.id === 4);
  if (JSON.parse(doctorResourceResponse.result?.contents?.[0]?.text ?? "{}").ok !== true) {
    fail("Installed bin MCP smoke doctor resource did not report ok.");
  }
  const doctorToolResponse = mcpResponses.find((item) => item.id === 5);
  if (JSON.parse(doctorToolResponse.result?.content?.[0]?.text ?? "{}").strict !== true) {
    fail("Installed bin MCP smoke doctor tool did not honor strict argument.");
  }
  const statusResourceResponse = mcpResponses.find((item) => item.id === 6);
  if (!["ready", "needs_attention"].includes(JSON.parse(statusResourceResponse.result?.contents?.[0]?.text ?? "{}").doctor?.status)) {
    fail("Installed bin MCP smoke status resource did not return readiness data.");
  }
  const statusToolResponse = mcpResponses.find((item) => item.id === 7);
  if (!JSON.parse(statusToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Status")) {
    fail("Installed bin MCP smoke status tool did not return status markdown.");
  }
  const contextResourceResponse = mcpResponses.find((item) => item.id === 8);
  if (!contextResourceResponse.result?.contents?.[0]?.text?.includes("# Agent Context Packet")) {
    fail("Installed bin MCP smoke context resource did not return a context packet.");
  }
  const recipesResourceResponse = mcpResponses.find((item) => item.id === 9);
  if (!recipesResourceResponse.result?.contents?.[0]?.text?.includes("# Agent Adoption Recipes")) {
    fail("Installed bin MCP smoke recipes resource did not return adoption recipes.");
  }
  const recipesJsonResponse = mcpResponses.find((item) => item.id === 10);
  if (!JSON.parse(recipesJsonResponse.result?.contents?.[0]?.text ?? "{}").recipes?.some((recipe) => recipe.id === "cli-task-loop")) {
    fail("Installed bin MCP smoke recipes-json resource did not return recipe JSON.");
  }
  const impactToolResponse = mcpResponses.find((item) => item.id === 11);
  if (!Array.isArray(JSON.parse(impactToolResponse.result?.content?.[0]?.text ?? "{}").impacts)) {
    fail("Installed bin MCP smoke impact tool did not return path impact data.");
  }
  const changedImpactToolResponse = mcpResponses.find((item) => item.id === 12);
  const changedImpactTool = JSON.parse(changedImpactToolResponse.result?.content?.[0]?.text ?? "{}");
  if (changedImpactTool.pathSource !== "git_changed" || !changedImpactTool.paths?.includes("src/index.js")) {
    fail("Installed bin MCP smoke changed impact tool did not return git changed path data.");
  }
  const handoffToolResponse = mcpResponses.find((item) => item.id === 13);
  const handoffTool = JSON.parse(handoffToolResponse.result?.content?.[0]?.text ?? "{}");
  if (!handoffTool.markdown?.includes("# Agent Handoff Packet")) {
    fail("Installed bin MCP smoke handoff tool did not return handoff markdown.");
  }
  const preflightToolResponse = mcpResponses.find((item) => item.id === 14);
  const preflightTool = JSON.parse(preflightToolResponse.result?.content?.[0]?.text ?? "{}");
  if (!preflightTool.markdown?.includes("# Agent Preflight")) {
    fail("Installed bin MCP smoke preflight tool did not return preflight markdown.");
  }
  const schemasResourceResponse = mcpResponses.find((item) => item.id === 15);
  if (!JSON.parse(schemasResourceResponse.result?.contents?.[0]?.text ?? "{}").schemas?.some((schema) => schema.id === "run-receipt")) {
    fail("Installed bin MCP smoke schemas resource did not return schema catalog data.");
  }
  const statusSchemaResourceResponse = mcpResponses.find((item) => item.id === 16);
  if (JSON.parse(statusSchemaResourceResponse.result?.contents?.[0]?.text ?? "{}").title !== "agent-ready status report") {
    fail("Installed bin MCP smoke schema template did not return the status schema.");
  }
  const workspacesResourceResponse = mcpResponses.find((item) => item.id === 17);
  const workspacesResource = JSON.parse(workspacesResourceResponse.result?.contents?.[0]?.text ?? "{}");
  if (!Array.isArray(workspacesResource.packages) || workspacesResource.monorepo?.detected !== false) {
    fail("Installed bin MCP smoke workspaces resource did not return workspace metadata.");
  }
  const workspacesToolResponse = mcpResponses.find((item) => item.id === 18);
  if (!JSON.parse(workspacesToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Workspaces")) {
    fail("Installed bin MCP smoke workspaces tool did not return workspace markdown.");
  }
  const affectedToolResponse = mcpResponses.find((item) => item.id === 19);
  if (!JSON.parse(affectedToolResponse.result?.content?.[0]?.text ?? "{}").markdown?.includes("# Agent Ready Affected Workspaces")) {
    fail("Installed bin MCP smoke affected tool did not return affected workspace markdown.");
  }
}

async function main() {
  const packageJson = await readJson(path.join(process.cwd(), "package.json"));
  assertReleaseMetadata(packageJson);
  const packageManager = await findPackageManager();
  const smokeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-install-smoke-"));
  const packDir = path.join(smokeRoot, "pack");
  const installRoot = path.join(smokeRoot, "install");
  const targetRoot = path.join(smokeRoot, "target");

  await fs.mkdir(packDir, { recursive: true });
  await fs.mkdir(installRoot, { recursive: true });
  await fs.mkdir(targetRoot, { recursive: true });

  try {
    const tarballPath = await packTarball(packageManager, packDir);
    await fs.writeFile(
      path.join(installRoot, "package.json"),
      JSON.stringify({ name: "agent-ready-install-smoke", private: true }, null, 2),
      "utf8"
    );

    const install = await run(packageManager.command, installArgs(packageManager, tarballPath), { cwd: installRoot });
    if (install.status !== 0) {
      fail(`Tarball install failed: ${install.stderr.trim() || install.stdout.trim()}`);
    }

    const cliBin = binPath(installRoot);
    if (!(await pathExists(cliBin))) {
      fail(`Installed bin not found at ${cliBin}`);
    }

    await createTargetRepo(targetRoot);
    await assertInstalledBinWorks(cliBin, packageJson, targetRoot);
    console.log(`Package install smoke check passed using ${packageManager.name}.`);
  } finally {
    await fs.rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
