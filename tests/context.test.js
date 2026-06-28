import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { scanRepo } from "../src/core/scanner.js";
import { buildContextPacket, formatContextPacket } from "../src/context/packet.js";
import { writeAgentsMd } from "../src/writers/agents-md.js";
import { writeMetadata } from "../src/writers/metadata.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-context-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

async function makeInitializedRepo() {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      description: "Context packet target",
      scripts: {
        test: "node --test",
        lint: "node --check src/index.js"
      }
    }),
    "README.md": "# Context Target\n\nContext packet target for agent-ready.\n",
    "docs/guide.md": "# Guide\n\nContext guide.\n",
    ".github/workflows/ci.yml": "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n",
    "src/index.js": "export const ok = true;\n"
  });
  const scan = await scanRepo({ root });
  await writeAgentsMd({ root, scan, force: true });
  await writeMetadata({ root, scan });
  return root;
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

test("context packet summarizes readiness, docs, commands, and risks", async () => {
  const root = await makeInitializedRepo();
  const packet = await buildContextPacket({ root });

  assert.equal(packet.ok, true);
  assert.equal(packet.status, "ready");
  assert.equal(packet.summary.purpose, "Context packet target for agent-ready.");
  assert.ok(packet.docs.some((doc) => doc.path === "docs/guide.md"));
  assert.ok(packet.commands.some((command) => command.name === "test"));
  assert.ok(packet.risks.some((risk) => risk.path === ".github/workflows"));
  assert.ok(packet.mcp.resources.includes("agent-ready://status"));
  assert.ok(packet.mcp.tools.includes("agent_ready_status"));
  assert.ok(packet.mcp.resources.includes("agent-ready://context"));
  assert.ok(packet.mcp.resources.includes("agent-ready://workspaces"));
  assert.ok(packet.mcp.tools.includes("agent_ready_workspaces"));
  assert.ok(packet.mcp.tools.includes("agent_ready_affected"));
});

test("context packet formatter returns markdown onboarding packet", async () => {
  const root = await makeInitializedRepo();
  const packet = await buildContextPacket({ root });
  const text = formatContextPacket(packet);

  assert.ok(text.startsWith("# Agent Context Packet"));
  assert.ok(text.includes("## Start Here"));
  assert.ok(text.includes("`test`: `npm test`"));
  assert.ok(text.includes("agent-ready://context"));
  assert.ok(text.includes("agent-ready://workspaces"));
  assert.ok(text.includes("agent_ready_affected"));
});

test("context CLI returns JSON and markdown", async () => {
  const root = await makeInitializedRepo();
  const jsonResult = await runCli(["context", "--root", root, "--json"]);
  const packet = JSON.parse(jsonResult.stdout);

  assert.equal(jsonResult.status, 0);
  assert.equal(packet.status, "ready");
  assert.ok(packet.recommendedWorkflow.length > 0);

  const textResult = await runCli(["context", "--root", root]);
  assert.equal(textResult.status, 0);
  assert.ok(textResult.stdout.includes("# Agent Context Packet"));
  assert.ok(textResult.stdout.includes("Context packet target for agent-ready."));
});
