import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { handleMcpRequest, MCP_PROMPTS, MCP_RESOURCES, MCP_RESOURCE_TEMPLATES, readMcpResource } from "../src/mcp/server.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-mcp-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeInitializedFixture() {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "MCP smoke target",
      scripts: {
        test: "node --test"
      }
    }),
    "README.md": "# MCP Smoke\n\nMCP smoke target for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nRead this before changing the smoke target.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
  });
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  return root;
}

function request(id, method, params) {
  return {
    jsonrpc: "2.0",
    id,
    method,
    ...(params === undefined ? {} : { params })
  };
}

function runCli(args, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
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
    child.stdin.write(input);
    child.stdin.end();
  });
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

test("MCP lists agent-ready resources", async () => {
  const root = await makeInitializedFixture();
  const result = await handleMcpRequest(
    { root },
    request(1, "resources/list")
  );

  assert.equal(result.result.resources.length, MCP_RESOURCES.length);
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://agents-md"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://repo-map"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://commands"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://workspaces"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://doctor"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://status"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://context"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://recipes"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://recipes-json"));
  assert.ok(result.result.resources.some((resource) => resource.uri === "agent-ready://schemas"));
});

test("MCP lists and reads templated resources", async () => {
  const root = await makeInitializedFixture();
  const templatesResult = await handleMcpRequest(
    { root },
    request(1, "resources/templates/list")
  );

  assert.equal(templatesResult.result.resourceTemplates.length, MCP_RESOURCE_TEMPLATES.length);
  assert.ok(templatesResult.result.resourceTemplates.some((template) => template.uriTemplate === "agent-ready://docs/{path}"));
  assert.ok(templatesResult.result.resourceTemplates.some((template) => template.uriTemplate === "agent-ready://command/{name}"));
  assert.ok(templatesResult.result.resourceTemplates.some((template) => template.uriTemplate === "agent-ready://risk/{path}"));
  assert.ok(templatesResult.result.resourceTemplates.some((template) => template.uriTemplate === "agent-ready://schema/{id}"));

  const docsResult = await handleMcpRequest(
    { root },
    request(2, "resources/read", { uri: "agent-ready://docs/docs%2Fguide.md" })
  );
  assert.equal(docsResult.result.contents[0].mimeType, "text/markdown");
  assert.ok(docsResult.result.contents[0].text.includes("Read this before changing"));

  const commandResult = await handleMcpRequest(
    { root },
    request(3, "resources/read", { uri: "agent-ready://command/test" })
  );
  const command = JSON.parse(commandResult.result.contents[0].text);
  assert.equal(command.name, "test");
  assert.equal(command.command, "npm test");

  const riskResult = await handleMcpRequest(
    { root },
    request(4, "resources/read", { uri: "agent-ready://risk/.github%2Fworkflows" })
  );
  const risk = JSON.parse(riskResult.result.contents[0].text);
  assert.equal(risk.path, ".github/workflows");
  assert.ok(risk.risks.some((item) => item.category === "ci"));

  const schemaResult = await handleMcpRequest(
    { root },
    request(5, "resources/read", { uri: "agent-ready://schema/status" })
  );
  const schema = JSON.parse(schemaResult.result.contents[0].text);
  assert.equal(schemaResult.result.contents[0].mimeType, "application/schema+json");
  assert.equal(schema.title, "agent-ready status report");
});

test("MCP reads generated resources", async () => {
  const root = await makeInitializedFixture();
  const repoMapResource = await readMcpResource({ root }, "agent-ready://repo-map");
  const repoMap = JSON.parse(repoMapResource.text);

  assert.equal(repoMap.summary.purpose, "MCP smoke target for agent-ready.");
  assert.equal(repoMapResource.mimeType, "application/json");

  const agentsResource = await readMcpResource({ root }, "agent-ready://agents-md");
  assert.equal(agentsResource.mimeType, "text/markdown");
  assert.ok(agentsResource.text.includes("# AGENTS.md"));

  const doctorResource = await readMcpResource({ root }, "agent-ready://doctor");
  const doctor = JSON.parse(doctorResource.text);
  assert.equal(doctorResource.mimeType, "application/json");
  assert.equal(doctor.ok, true);
  assert.equal(doctor.status, "ready");
  assert.ok(doctor.checks.some((item) => item.id === "agent-docs" && item.status === "ok"));

  const statusResource = await readMcpResource({ root }, "agent-ready://status");
  const status = JSON.parse(statusResource.text);
  assert.equal(statusResource.mimeType, "application/json");
  assert.equal(status.doctor.status, "ready");
  assert.ok(status.adoption.recipes.cli.includes("recipes"));

  const workspacesResource = await readMcpResource({ root }, "agent-ready://workspaces");
  const workspaces = JSON.parse(workspacesResource.text);
  assert.equal(workspacesResource.mimeType, "application/json");
  assert.equal(workspaces.monorepo.detected, false);
  assert.equal(workspaces.summary.packageCount, 0);

  const contextResource = await readMcpResource({ root }, "agent-ready://context");
  assert.equal(contextResource.mimeType, "text/markdown");
  assert.ok(contextResource.text.startsWith("# Agent Context Packet"));
  assert.ok(contextResource.text.includes("MCP smoke target for agent-ready."));

  const recipesResource = await readMcpResource({ root }, "agent-ready://recipes");
  assert.equal(recipesResource.mimeType, "text/markdown");
  assert.ok(recipesResource.text.includes("# Agent Adoption Recipes"));

  const recipesJsonResource = await readMcpResource({ root }, "agent-ready://recipes-json");
  const recipes = JSON.parse(recipesJsonResource.text);
  assert.equal(recipesJsonResource.mimeType, "application/json");
  assert.ok(recipes.recipes.some((recipe) => recipe.id === "cli-task-loop"));

  const schemasResource = await readMcpResource({ root }, "agent-ready://schemas");
  const schemas = JSON.parse(schemasResource.text);
  assert.equal(schemasResource.mimeType, "application/json");
  assert.ok(schemas.schemas.some((schema) => schema.id === "run-receipt"));
});

test("MCP falls back to generated resources before init", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Uninitialized MCP target",
      scripts: {
        test: "node --test"
      }
    }),
    "src/index.js": "export const ok = true;\n"
  });

  const result = await handleMcpRequest(
    { root },
    request(1, "resources/read", { uri: "agent-ready://commands" })
  );
  const commands = JSON.parse(result.result.contents[0].text);

  assert.ok(commands.commands.some((command) => command.command === "npm test"));
});

test("MCP lists and returns prompts", async () => {
  const root = await makeInitializedFixture();
  const promptsResult = await handleMcpRequest(
    { root },
    request(1, "prompts/list")
  );

  assert.equal(promptsResult.result.prompts.length, MCP_PROMPTS.length);
  assert.ok(promptsResult.result.prompts.some((prompt) => prompt.name === "agent-ready-orient"));
  assert.ok(promptsResult.result.prompts.some((prompt) => prompt.name === "agent-ready-handoff"));

  const promptResult = await handleMcpRequest(
    { root },
    request(2, "prompts/get", {
      name: "agent-ready-orient",
      arguments: {
        focus: "tests"
      }
    })
  );

  const message = promptResult.result.messages[0];
  assert.equal(message.role, "user");
  assert.ok(message.content.text.includes("agent-ready://context"));
  assert.ok(message.content.text.includes("agent-ready://doctor"));
  assert.ok(message.content.text.includes("agent_ready_doctor"));
  assert.ok(message.content.text.includes("agent-ready://agents-md"));
  assert.ok(message.content.text.includes("agent-ready://workspaces"));
  assert.ok(message.content.text.includes("agent_ready_workspaces"));
  assert.ok(message.content.text.includes("agent_ready_affected"));
  assert.ok(message.content.text.includes("Focus especially on: tests"));
});

test("MCP tools return status, summary, workspaces, affected packages, doctor, impact, handoff, preflight, and validation results", async () => {
  const root = await makeInitializedFixture();
  const statusResult = await handleMcpRequest(
    { root },
    request(0, "tools/call", {
      name: "agent_ready_status",
      arguments: {
        strict: true
      }
    })
  );
  const status = JSON.parse(statusResult.result.content[0].text);

  assert.equal(status.doctor.status, "ready");
  assert.equal(status.strict, true);
  assert.ok(status.markdown.includes("# Agent Ready Status"));

  const summaryResult = await handleMcpRequest(
    { root },
    request(1, "tools/call", {
      name: "agent_ready_summary",
      arguments: {
        includeEvidence: true
      }
    })
  );
  const summary = JSON.parse(summaryResult.result.content[0].text);

  assert.equal(summary.summary.purpose, "MCP smoke target for agent-ready.");
  assert.ok(summary.evidence.length > 0);

  const workspacesResult = await handleMcpRequest(
    { root },
    request(8, "tools/call", {
      name: "agent_ready_workspaces",
      arguments: {}
    })
  );
  const workspaces = JSON.parse(workspacesResult.result.content[0].text);

  assert.equal(workspaces.status, "single-package");
  assert.ok(workspaces.markdown.includes("# Agent Ready Workspaces"));

  const affectedResult = await handleMcpRequest(
    { root },
    request(9, "tools/call", {
      name: "agent_ready_affected",
      arguments: {
        paths: ["src/index.js"]
      }
    })
  );
  const affected = JSON.parse(affectedResult.result.content[0].text);

  assert.equal(affected.status, "single-package");
  assert.equal(affected.pathSource, "provided");
  assert.ok(affected.markdown.includes("# Agent Ready Affected Workspaces"));

  const doctorResult = await handleMcpRequest(
    { root },
    request(2, "tools/call", {
      name: "agent_ready_doctor",
      arguments: {
        strict: true
      }
    })
  );
  const doctor = JSON.parse(doctorResult.result.content[0].text);

  assert.equal(doctor.ok, true);
  assert.equal(doctor.strict, true);
  assert.equal(doctor.status, "ready");
  assert.equal(doctorResult.result.isError, false);

  const impactResult = await handleMcpRequest(
    { root },
    request(3, "tools/call", {
      name: "agent_ready_impact",
      arguments: {
        paths: [".github/workflows/ci.yml", "db/migrate/001_create_users.rb"]
      }
    })
  );
  const impact = JSON.parse(impactResult.result.content[0].text);

  assert.equal(impact.status, "high");
  assert.ok(impact.impacts.some((item) => item.categories.includes("ci")));
  assert.ok(impact.impacts.some((item) => item.categories.includes("database_migration")));

  const gitInit = await runCommand("git", ["init"], { cwd: root });
  assert.equal(gitInit.status, 0, gitInit.stderr);
  const changedImpactResult = await handleMcpRequest(
    { root },
    request(5, "tools/call", {
      name: "agent_ready_impact",
      arguments: {
        changed: true
      }
    })
  );
  const changedImpact = JSON.parse(changedImpactResult.result.content[0].text);

  assert.equal(changedImpact.pathSource, "git_changed");
  assert.equal(changedImpact.status, "medium");
  assert.ok(changedImpact.paths.includes(".github/workflows/ci.yml"));

  const handoffResult = await handleMcpRequest(
    { root },
    request(6, "tools/call", {
      name: "agent_ready_handoff",
      arguments: {
        paths: [".github/workflows/ci.yml"],
        goal: "MCP handoff"
      }
    })
  );
  const handoff = JSON.parse(handoffResult.result.content[0].text);

  assert.equal(handoff.goal, "MCP handoff");
  assert.equal(handoff.impact.status, "medium");
  assert.ok(handoff.markdown.includes("# Agent Handoff Packet"));

  const preflightResult = await handleMcpRequest(
    { root },
    request(7, "tools/call", {
      name: "agent_ready_preflight",
      arguments: {
        paths: [".github/workflows/ci.yml"],
        goal: "MCP preflight"
      }
    })
  );
  const preflight = JSON.parse(preflightResult.result.content[0].text);

  assert.equal(preflight.goal, "MCP preflight");
  assert.equal(preflight.status, "needs_validation");
  assert.ok(preflight.markdown.includes("# Agent Preflight"));

  const validateResult = await handleMcpRequest(
    { root },
    request(4, "tools/call", {
      name: "agent_ready_validate",
      arguments: {
        strict: true
      }
    })
  );
  const validation = JSON.parse(validateResult.result.content[0].text);

  assert.equal(validation.ok, true);
  assert.equal(validation.strict, true);
});

test("CLI MCP stdio serves line-delimited JSON-RPC", async () => {
  const root = await makeInitializedFixture();
  const input = [
    JSON.stringify(request(1, "initialize", { protocolVersion: "2024-11-05" })),
    JSON.stringify(request(2, "resources/list")),
    JSON.stringify(request(3, "resources/read", { uri: "agent-ready://agents-md" })),
    JSON.stringify(request(4, "prompts/list")),
    JSON.stringify(request(5, "resources/read", { uri: "agent-ready://doctor" })),
    JSON.stringify(request(6, "tools/call", {
      name: "agent_ready_doctor",
      arguments: {
        strict: true
      }
    })),
    JSON.stringify(request(7, "resources/read", { uri: "agent-ready://status" })),
    JSON.stringify(request(8, "tools/call", {
      name: "agent_ready_status",
      arguments: {
        strict: true
      }
    })),
    JSON.stringify(request(9, "resources/read", { uri: "agent-ready://context" })),
    JSON.stringify(request(10, "resources/read", { uri: "agent-ready://recipes" })),
    JSON.stringify(request(11, "resources/read", { uri: "agent-ready://recipes-json" })),
    JSON.stringify(request(12, "resources/read", { uri: "agent-ready://schemas" })),
    JSON.stringify(request(13, "resources/read", { uri: "agent-ready://schema/status" })),
    JSON.stringify(request(14, "resources/read", { uri: "agent-ready://workspaces" })),
    JSON.stringify(request(15, "tools/call", {
      name: "agent_ready_workspaces",
      arguments: {}
    })),
    JSON.stringify(request(16, "tools/call", {
      name: "agent_ready_affected",
      arguments: {
        paths: ["src/index.js"]
      }
    })),
    JSON.stringify(request(17, "tools/call", {
      name: "agent_ready_impact",
      arguments: {
        paths: [".github/workflows/ci.yml"]
      }
    })),
    JSON.stringify(request(18, "tools/call", {
      name: "agent_ready_handoff",
      arguments: {
        paths: [".github/workflows/ci.yml"]
      }
    })),
    JSON.stringify(request(19, "tools/call", {
      name: "agent_ready_preflight",
      arguments: {
        paths: [".github/workflows/ci.yml"]
      }
    })),
    ""
  ].join("\n");
  const result = await runCli(["src/cli/main.js", "mcp", "--root", root], input);
  const responses = result.stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line));

  assert.equal(result.status, 0);
  assert.equal(responses[0].result.serverInfo.name, "agent-ready");
  assert.ok(responses[0].result.capabilities.prompts);
  assert.ok(responses[1].result.resources.some((resource) => resource.uri === "agent-ready://risk-policy"));
  assert.ok(responses[2].result.contents[0].text.includes("# AGENTS.md"));
  assert.ok(responses[3].result.prompts.some((prompt) => prompt.name === "agent-ready-risk-review"));
  assert.equal(JSON.parse(responses[4].result.contents[0].text).status, "ready");
  assert.equal(JSON.parse(responses[5].result.content[0].text).strict, true);
  assert.equal(JSON.parse(responses[6].result.contents[0].text).doctor.status, "ready");
  assert.ok(JSON.parse(responses[7].result.content[0].text).markdown.includes("# Agent Ready Status"));
  assert.ok(responses[8].result.contents[0].text.includes("# Agent Context Packet"));
  assert.ok(responses[9].result.contents[0].text.includes("# Agent Adoption Recipes"));
  assert.ok(JSON.parse(responses[10].result.contents[0].text).recipes.some((recipe) => recipe.id === "cli-task-loop"));
  assert.ok(JSON.parse(responses[11].result.contents[0].text).schemas.some((schema) => schema.id === "status"));
  assert.equal(JSON.parse(responses[12].result.contents[0].text).title, "agent-ready status report");
  assert.equal(JSON.parse(responses[13].result.contents[0].text).summary.packageCount, 0);
  assert.ok(JSON.parse(responses[14].result.content[0].text).markdown.includes("# Agent Ready Workspaces"));
  assert.ok(JSON.parse(responses[15].result.content[0].text).markdown.includes("# Agent Ready Affected Workspaces"));
  assert.equal(JSON.parse(responses[16].result.content[0].text).status, "medium");
  assert.ok(JSON.parse(responses[17].result.content[0].text).markdown.includes("# Agent Handoff Packet"));
  assert.ok(JSON.parse(responses[18].result.content[0].text).markdown.includes("# Agent Preflight"));
});
