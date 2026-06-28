#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const CLI_PATH = path.join(process.cwd(), "src", "cli", "main.js");
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

function fail(message) {
  throw new Error(message);
}

function request(id, method, params) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params })
  };
}

function initializedNotification() {
  return {
    jsonrpc: "2.0",
    method: "notifications/initialized"
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"]
    });

    let settled = false;
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve({
        status: 124,
        stdout,
        stderr: `${stderr.trim()}\nTimed out after ${options.timeoutMs ?? 10000}ms.`.trim()
      });
    }, options.timeoutMs ?? 10000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status: 127, stdout, stderr: error.message });
    });
    child.on("close", (status) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ status, stdout, stderr });
    });

    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

async function runCli(args, options = {}) {
  const result = await run(process.execPath, [CLI_PATH, ...args], options);
  if (result.status !== 0) {
    fail(`CLI failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result;
}

async function runMcpScenario(name, command, args, messages, options = {}) {
  const expectedResponses = messages.filter((message) => Object.hasOwn(message, "id")).length;
  const input = `${messages.map((message) => JSON.stringify(message)).join("\n")}\n`;
  const result = await run(command, args, {
    ...options,
    input,
    timeoutMs: options.timeoutMs ?? 12000
  });

  if (result.status !== 0) {
    fail(`${name}: MCP process failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  const lines = result.stdout.trim() ? result.stdout.trim().split(/\r?\n/) : [];
  if (lines.length !== expectedResponses) {
    fail(`${name}: expected ${expectedResponses} responses, received ${lines.length}.`);
  }

  const responses = new Map();
  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      fail(`${name}: invalid JSON response ${line}: ${error.message}`);
    }
    if (parsed.error) {
      fail(`${name}: JSON-RPC error for id ${parsed.id}: ${parsed.error.message}`);
    }
    responses.set(parsed.id, parsed);
  }

  return responses;
}

async function writeFile(root, relPath, content) {
  const absolute = path.join(root, relPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, content, "utf8");
}

async function createRepo(parent, name, description) {
  const root = path.join(parent, name);
  await fs.mkdir(root, { recursive: true });
  await writeFile(
    root,
    "package.json",
    JSON.stringify(
      {
        name,
        description,
        scripts: {
          test: "node --test",
          lint: "node --check src/index.js"
        }
      },
      null,
      2
    )
  );
  await writeFile(root, "README.md", `# ${name}\n\n${description}\n`);
  await writeFile(root, "docs/guide.md", `# ${name} Guide\n\nDocs for ${description}\n`);
  await writeFile(
    root,
    ".github/workflows/ci.yml",
    "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n"
  );
  await writeFile(root, "src/index.js", "export const ok = true;\n");
  return root;
}

function response(responses, id, scenario) {
  const item = responses.get(id);
  if (!item) {
    fail(`${scenario}: missing response id ${id}.`);
  }
  return item.result;
}

function readTextContent(result) {
  return result.contents?.[0]?.text ?? "";
}

function readToolJson(result) {
  const text = result.content?.[0]?.text;
  if (!text) {
    fail("Tool response did not include text content.");
  }
  return JSON.parse(text);
}

function assertPrimaryTranscript(responses, description) {
  const scenario = "source checkout";
  const initialized = response(responses, 1, scenario);
  if (!initialized.capabilities?.resources || !initialized.capabilities?.tools || !initialized.capabilities?.prompts) {
    fail(`${scenario}: initialize did not advertise resources, tools, and prompts.`);
  }

  const resources = response(responses, 2, scenario).resources ?? [];
  if (!resources.some((resource) => resource.uri === "agent-ready://repo-map")) {
    fail(`${scenario}: repo-map resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://status")) {
    fail(`${scenario}: status resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://workspaces")) {
    fail(`${scenario}: workspaces resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://recipes")) {
    fail(`${scenario}: recipes resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://schemas")) {
    fail(`${scenario}: schemas resource missing.`);
  }

  const templates = response(responses, 3, scenario).resourceTemplates ?? [];
  if (!templates.some((template) => template.uriTemplate === "agent-ready://docs/{path}")) {
    fail(`${scenario}: docs resource template missing.`);
  }
  if (!templates.some((template) => template.uriTemplate === "agent-ready://schema/{id}")) {
    fail(`${scenario}: schema resource template missing.`);
  }

  const prompts = response(responses, 4, scenario).prompts ?? [];
  if (!prompts.some((prompt) => prompt.name === "agent-ready-orient")) {
    fail(`${scenario}: orientation prompt missing.`);
  }

  const promptMessage = response(responses, 5, scenario).messages?.[0]?.content?.text ?? "";
  if (!promptMessage.includes("Focus especially on: compatibility")) {
    fail(`${scenario}: prompt arguments were not reflected in prompt text.`);
  }
  if (!promptMessage.includes("agent-ready://workspaces") || !promptMessage.includes("agent_ready_workspaces")) {
    fail(`${scenario}: prompt did not mention workspace orientation.`);
  }
  if (!promptMessage.includes("agent_ready_affected")) {
    fail(`${scenario}: prompt did not mention affected workspace guidance.`);
  }

  if (!readTextContent(response(responses, 6, scenario)).includes("# AGENTS.md")) {
    fail(`${scenario}: AGENTS.md resource did not return markdown.`);
  }

  if (!readTextContent(response(responses, 7, scenario)).includes("# Agent Adoption Recipes")) {
    fail(`${scenario}: recipes resource did not return adoption recipes.`);
  }

  const recipesJson = JSON.parse(readTextContent(response(responses, 8, scenario)));
  if (!recipesJson.recipes?.some((recipe) => recipe.id === "cli-task-loop")) {
    fail(`${scenario}: recipes-json resource did not return the CLI task loop.`);
  }

  if (!readTextContent(response(responses, 9, scenario)).includes(description)) {
    fail(`${scenario}: docs template did not read the expected guide.`);
  }

  const command = JSON.parse(readTextContent(response(responses, 10, scenario)));
  if (command.name !== "test" || command.command !== "npm test") {
    fail(`${scenario}: command template returned the wrong command.`);
  }

  const risk = JSON.parse(readTextContent(response(responses, 11, scenario)));
  if (!risk.risks?.some((item) => item.category === "ci")) {
    fail(`${scenario}: risk template did not return CI risk metadata.`);
  }

  const summary = readToolJson(response(responses, 12, scenario));
  if (summary.summary?.purpose !== description) {
    fail(`${scenario}: summary purpose did not match target repo.`);
  }

  const validation = readToolJson(response(responses, 13, scenario));
  if (validation.ok !== true || validation.strict !== true) {
    fail(`${scenario}: strict validation did not pass for initialized repo.`);
  }

  const doctorResource = JSON.parse(readTextContent(response(responses, 14, scenario)));
  if (doctorResource.status !== "ready" || doctorResource.ok !== true) {
    fail(`${scenario}: doctor resource did not report a ready repo.`);
  }

  const doctorTool = readToolJson(response(responses, 15, scenario));
  if (doctorTool.status !== "ready" || doctorTool.strict !== true) {
    fail(`${scenario}: doctor tool did not report strict readiness.`);
  }

  const statusResource = JSON.parse(readTextContent(response(responses, 16, scenario)));
  if (statusResource.doctor?.status !== "ready" || !statusResource.adoption?.recipes?.cli) {
    fail(`${scenario}: status resource did not return readiness and adoption guidance.`);
  }

  const statusTool = readToolJson(response(responses, 17, scenario));
  if (!statusTool.markdown?.includes("# Agent Ready Status") || statusTool.strict !== true) {
    fail(`${scenario}: status tool did not return markdown strict status.`);
  }

  const contextPacket = readTextContent(response(responses, 18, scenario));
  if (!contextPacket.includes("# Agent Context Packet") || !contextPacket.includes(description)) {
    fail(`${scenario}: context packet resource did not return the expected onboarding packet.`);
  }

  const impact = readToolJson(response(responses, 19, scenario));
  if (impact.status !== "medium" || !impact.impacts?.some((item) => item.categories?.includes("ci"))) {
    fail(`${scenario}: impact tool did not return CI path guidance.`);
  }

  const changedImpact = readToolJson(response(responses, 20, scenario));
  if (changedImpact.pathSource !== "git_changed" || !changedImpact.paths?.includes(".github/workflows/ci.yml")) {
    fail(`${scenario}: changed impact tool did not return git changed path guidance.`);
  }

  const handoff = readToolJson(response(responses, 21, scenario));
  if (!handoff.markdown?.includes("# Agent Handoff Packet") || handoff.impact?.status !== "medium") {
    fail(`${scenario}: handoff tool did not return markdown handoff guidance.`);
  }

  const preflight = readToolJson(response(responses, 22, scenario));
  if (!preflight.markdown?.includes("# Agent Preflight") || preflight.status !== "needs_validation") {
    fail(`${scenario}: preflight tool did not return markdown preflight guidance.`);
  }

  const schemas = JSON.parse(readTextContent(response(responses, 23, scenario)));
  if (!schemas.schemas?.some((schema) => schema.id === "status")) {
    fail(`${scenario}: schemas resource did not return the status schema catalog entry.`);
  }

  const statusSchema = JSON.parse(readTextContent(response(responses, 24, scenario)));
  if (statusSchema.title !== "agent-ready status report") {
    fail(`${scenario}: schema template did not return the status schema.`);
  }

  const workspacesResource = JSON.parse(readTextContent(response(responses, 25, scenario)));
  if (!Array.isArray(workspacesResource.packages) || workspacesResource.monorepo?.detected !== false) {
    fail(`${scenario}: workspaces resource did not return workspace metadata.`);
  }

  const workspacesTool = readToolJson(response(responses, 26, scenario));
  if (!workspacesTool.markdown?.includes("# Agent Ready Workspaces") || workspacesTool.status !== "single-package") {
    fail(`${scenario}: workspaces tool did not return markdown workspace guidance.`);
  }

  const affectedTool = readToolJson(response(responses, 27, scenario));
  if (!affectedTool.markdown?.includes("# Agent Ready Affected Workspaces") || affectedTool.status !== "single-package") {
    fail(`${scenario}: affected tool did not return markdown affected workspace guidance.`);
  }
}

function assertAbsoluteCommandTranscript(responses) {
  const scenario = "absolute command";
  const resources = response(responses, 2, scenario).resources ?? [];
  const tools = response(responses, 3, scenario).tools ?? [];
  const prompts = response(responses, 4, scenario).prompts ?? [];

  if (!resources.some((resource) => resource.uri === "agent-ready://commands")) {
    fail(`${scenario}: commands resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://doctor")) {
    fail(`${scenario}: doctor resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://context")) {
    fail(`${scenario}: context resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://status")) {
    fail(`${scenario}: status resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://workspaces")) {
    fail(`${scenario}: workspaces resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://recipes-json")) {
    fail(`${scenario}: recipes-json resource missing.`);
  }
  if (!resources.some((resource) => resource.uri === "agent-ready://schemas")) {
    fail(`${scenario}: schemas resource missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_status")) {
    fail(`${scenario}: status tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_summary")) {
    fail(`${scenario}: summary tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_workspaces")) {
    fail(`${scenario}: workspaces tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_affected")) {
    fail(`${scenario}: affected tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_impact")) {
    fail(`${scenario}: impact tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_handoff")) {
    fail(`${scenario}: handoff tool missing.`);
  }
  if (!tools.some((tool) => tool.name === "agent_ready_preflight")) {
    fail(`${scenario}: preflight tool missing.`);
  }
  if (!prompts.some((prompt) => prompt.name === "agent-ready-risk-review")) {
    fail(`${scenario}: risk review prompt missing.`);
  }
}

async function assertMultiRepoIsolation(tempRoot) {
  const repoA = await createRepo(tempRoot, "compat-api", "API compatibility target.");
  const repoB = await createRepo(tempRoot, "compat-web", "Web compatibility target.");

  const messages = [
    request(1, "tools/call", {
      name: "agent_ready_summary",
      arguments: {}
    })
  ];
  const [responsesA, responsesB] = await Promise.all([
    runMcpScenario("multi repo api", process.execPath, [CLI_PATH, "mcp", "--root", repoA], messages),
    runMcpScenario("multi repo web", process.execPath, [CLI_PATH, "mcp", "--root", repoB], messages)
  ]);

  const summaryA = readToolJson(response(responsesA, 1, "multi repo api"));
  const summaryB = readToolJson(response(responsesB, 1, "multi repo web"));
  if (summaryA.summary?.purpose !== "API compatibility target.") {
    fail("multi repo api: summary purpose leaked or did not match.");
  }
  if (summaryB.summary?.purpose !== "Web compatibility target.") {
    fail("multi repo web: summary purpose leaked or did not match.");
  }
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-mcp-compat-"));
  try {
    const description = "Primary MCP compatibility target.";
    const primaryRoot = await createRepo(tempRoot, "compat-primary", description);
    await runCli(["init", "--root", primaryRoot]);
    const gitInit = await run("git", ["init"], { cwd: primaryRoot });
    if (gitInit.status !== 0) {
      fail(`source checkout: git init failed: ${gitInit.stderr.trim() || gitInit.stdout.trim()}`);
    }

    const primaryResponses = await runMcpScenario(
      "source checkout",
      process.execPath,
      [CLI_PATH, "mcp", "--root", primaryRoot],
      [
        request(1, "initialize", { protocolVersion: DEFAULT_PROTOCOL_VERSION }),
        initializedNotification(),
        request(2, "resources/list"),
        request(3, "resources/templates/list"),
        request(4, "prompts/list"),
        request(5, "prompts/get", {
          name: "agent-ready-orient",
          arguments: {
            focus: "compatibility"
          }
        }),
        request(6, "resources/read", { uri: "agent-ready://agents-md" }),
        request(7, "resources/read", { uri: "agent-ready://recipes" }),
        request(8, "resources/read", { uri: "agent-ready://recipes-json" }),
        request(9, "resources/read", { uri: "agent-ready://docs/docs%2Fguide.md" }),
        request(10, "resources/read", { uri: "agent-ready://command/test" }),
        request(11, "resources/read", { uri: "agent-ready://risk/.github%2Fworkflows" }),
        request(12, "tools/call", {
          name: "agent_ready_summary",
          arguments: {}
        }),
        request(13, "tools/call", {
          name: "agent_ready_validate",
          arguments: {
            strict: true
          }
        }),
        request(14, "resources/read", { uri: "agent-ready://doctor" }),
        request(15, "tools/call", {
          name: "agent_ready_doctor",
          arguments: {
            strict: true
          }
        }),
        request(16, "resources/read", { uri: "agent-ready://status" }),
        request(17, "tools/call", {
          name: "agent_ready_status",
          arguments: {
            strict: true
          }
        }),
        request(18, "resources/read", { uri: "agent-ready://context" }),
        request(19, "tools/call", {
          name: "agent_ready_impact",
          arguments: {
            paths: [".github/workflows/ci.yml"]
          }
        }),
        request(20, "tools/call", {
          name: "agent_ready_impact",
          arguments: {
            changed: true
          }
        }),
        request(21, "tools/call", {
          name: "agent_ready_handoff",
          arguments: {
            paths: [".github/workflows/ci.yml"],
            goal: "compat handoff"
          }
        }),
        request(22, "tools/call", {
          name: "agent_ready_preflight",
          arguments: {
            paths: [".github/workflows/ci.yml"],
            goal: "compat preflight"
          }
        }),
        request(23, "resources/read", { uri: "agent-ready://schemas" }),
        request(24, "resources/read", { uri: "agent-ready://schema/status" }),
        request(25, "resources/read", { uri: "agent-ready://workspaces" }),
        request(26, "tools/call", {
          name: "agent_ready_workspaces",
          arguments: {}
        }),
        request(27, "tools/call", {
          name: "agent_ready_affected",
          arguments: {
            paths: ["src/index.js"]
          }
        })
      ]
    );
    assertPrimaryTranscript(primaryResponses, description);

    const absoluteResponses = await runMcpScenario(
      "absolute command",
      process.execPath,
      [CLI_PATH, "mcp", "--root", primaryRoot],
      [
        request(1, "initialize", { protocolVersion: DEFAULT_PROTOCOL_VERSION }),
        request(2, "resources/list"),
        request(3, "tools/list"),
        request(4, "prompts/list")
      ],
      {
        cwd: tempRoot
      }
    );
    assertAbsoluteCommandTranscript(absoluteResponses);

    await assertMultiRepoIsolation(tempRoot);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }

  console.log("MCP compatibility smoke check passed.");
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
