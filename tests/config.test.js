import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG_FILE, loadAgentReadyConfig, starterConfig, writeStarterConfig } from "../src/core/config.js";
import { pathExists } from "../src/core/inventory.js";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-config-"));
}

test("starter config has normalized defaults", () => {
  assert.deepEqual(starterConfig(), {
    schemaVersion: "0.1.0",
    profiles: ["generic"],
    ignore: [],
    riskPaths: [],
    generatedPaths: [],
    directoryRoles: {},
    commands: {},
    sections: {
      purpose: "Describe this repo for agents.",
      conventions: []
    }
  });
});

test("writeStarterConfig dry run returns JSON without writing a file", async () => {
  const root = await makeTempRoot();
  const result = await writeStarterConfig({ root, dryRun: true });

  assert.equal(result.written, false);
  assert.equal(await pathExists(path.join(root, DEFAULT_CONFIG_FILE)), false);
  assert.deepEqual(JSON.parse(result.content), starterConfig());
});

test("writeStarterConfig writes a config loadAgentReadyConfig can read", async () => {
  const root = await makeTempRoot();
  const result = await writeStarterConfig({ root });

  assert.equal(result.written, true);
  assert.equal(result.path, path.join(root, DEFAULT_CONFIG_FILE));

  const loaded = await loadAgentReadyConfig(root);
  assert.equal(loaded.loaded, true);
  assert.deepEqual(loaded.config, starterConfig());
});

test("writeStarterConfig does not overwrite existing config without force", async () => {
  const root = await makeTempRoot();
  const configPath = path.join(root, DEFAULT_CONFIG_FILE);
  await fs.writeFile(configPath, "{\"schemaVersion\":\"custom\"}\n", "utf8");

  await assert.rejects(
    writeStarterConfig({ root }),
    /already exists/
  );

  assert.equal(await fs.readFile(configPath, "utf8"), "{\"schemaVersion\":\"custom\"}\n");
});

test("writeStarterConfig replaces existing config with force", async () => {
  const root = await makeTempRoot();
  const configPath = path.join(root, DEFAULT_CONFIG_FILE);
  await fs.writeFile(configPath, "{\"schemaVersion\":\"custom\"}\n", "utf8");

  const result = await writeStarterConfig({ root, force: true });

  assert.equal(result.written, true);
  assert.deepEqual(JSON.parse(await fs.readFile(configPath, "utf8")), starterConfig());
});
