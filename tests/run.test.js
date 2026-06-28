import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { runCommandReceipt, formatRunReceipt } from "../src/run/report.js";

async function makeRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-run-"));
  const nodeCommand = JSON.stringify(process.execPath);
  await fs.writeFile(
    path.join(root, "agent-ready.config.json"),
    JSON.stringify(
      {
        commands: {
          quick: `${nodeCommand} -e "console.log('ok receipt')"`,
          writey: {
            command: `${nodeCommand} -e "console.log('writes ok')"`,
            writesFiles: true,
            requiresNetwork: false,
            risk: "low"
          },
          networky: {
            command: `${nodeCommand} -e "console.log('network ok')"`,
            writesFiles: false,
            requiresNetwork: true,
            risk: "medium"
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(path.join(root, "README.md"), "# Run Target\n\nRun target repo.\n", "utf8");
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

test("run command receipt executes a configured low-risk command", async () => {
  const root = await makeRepo();
  const receipt = await runCommandReceipt({ root, name: "quick" });

  assert.equal(receipt.ok, true);
  assert.equal(receipt.status, "passed");
  assert.equal(receipt.exitCode, 0);
  assert.ok(receipt.stdout.includes("ok receipt"));
});

test("run command receipt refuses side effects without explicit approval", async () => {
  const root = await makeRepo();
  const writes = await runCommandReceipt({ root, name: "writey" });
  const network = await runCommandReceipt({ root, name: "networky" });

  assert.equal(writes.ok, false);
  assert.equal(writes.status, "refused");
  assert.ok(writes.refusalReasons.some((reason) => reason.includes("--allow-writes")));
  assert.equal(network.ok, false);
  assert.equal(network.status, "refused");
  assert.ok(network.refusalReasons.some((reason) => reason.includes("--allow-network")));
});

test("run command receipt runs side-effect command when approved", async () => {
  const root = await makeRepo();
  const receipt = await runCommandReceipt({ root, name: "writey", allowWrites: true });

  assert.equal(receipt.ok, true);
  assert.equal(receipt.status, "passed");
  assert.ok(receipt.stdout.includes("writes ok"));
});

test("run formatter returns markdown receipt", async () => {
  const root = await makeRepo();
  const receipt = await runCommandReceipt({ root, name: "quick" });
  const text = formatRunReceipt(receipt);

  assert.ok(text.startsWith("# Agent Command Receipt"));
  assert.ok(text.includes("Status: passed"));
  assert.ok(text.includes("ok receipt"));
});

test("run CLI returns JSON receipt and nonzero for refusal", async () => {
  const root = await makeRepo();
  const result = await runCli(["run", "--root", root, "--json", "quick"]);
  const receipt = JSON.parse(result.stdout);

  assert.equal(result.status, 0);
  assert.equal(receipt.status, "passed");

  const refused = await runCli(["run", "--root", root, "--json", "writey"]);
  const refusedReceipt = JSON.parse(refused.stdout);

  assert.equal(refused.status, 1);
  assert.equal(refusedReceipt.status, "refused");
});
