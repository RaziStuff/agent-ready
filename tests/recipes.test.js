import { spawn } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { loadRecipeCatalog, recipeOutput } from "../src/recipes/report.js";

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

test("recipe catalog loads built-in adoption loops", async () => {
  const catalog = await loadRecipeCatalog();

  assert.equal(catalog.schemaVersion, "0.1.0");
  assert.ok(catalog.recipes.some((recipe) => recipe.id === "cli-task-loop"));
  assert.ok(catalog.recipes.some((recipe) => recipe.id === "mcp-first-loop"));
  assert.ok(catalog.recipes.some((recipe) => recipe.id === "final-answer-loop"));
  assert.ok(JSON.stringify(catalog).includes("agent-ready run"));
});

test("recipe output returns markdown and JSON", async () => {
  const markdown = await recipeOutput();
  assert.equal(markdown.ok, true);
  assert.ok(markdown.text.includes("# Agent Adoption Recipes"));

  const json = await recipeOutput({ json: true });
  assert.equal(json.ok, true);
  const catalog = JSON.parse(json.text);
  assert.ok(catalog.recipes.some((recipe) => recipe.id === "cli-task-loop"));

  const recipe = await recipeOutput({ recipeId: "mcp-first-loop" });
  assert.equal(recipe.ok, true);
  assert.ok(recipe.text.includes("# MCP-first agent loop"));
  assert.ok(recipe.text.includes("agent-ready://context"));
});

test("recipe output rejects unknown recipe ids", async () => {
  const output = await recipeOutput({ recipeId: "missing-loop", json: true });
  const payload = JSON.parse(output.text);

  assert.equal(output.ok, false);
  assert.equal(payload.status, "unknown_recipe");
  assert.ok(payload.availableRecipes.includes("cli-task-loop"));
});

test("recipes CLI returns catalog, one recipe, and nonzero unknown status", async () => {
  const catalogResult = await runCli(["recipes", "--json"]);
  const catalog = JSON.parse(catalogResult.stdout);
  assert.equal(catalogResult.status, 0);
  assert.ok(catalog.recipes.some((recipe) => recipe.id === "cli-task-loop"));

  const recipeResult = await runCli(["recipes", "mcp-first-loop"]);
  assert.equal(recipeResult.status, 0);
  assert.ok(recipeResult.stdout.includes("# MCP-first agent loop"));

  const missingResult = await runCli(["recipes", "missing-loop", "--json"]);
  const missing = JSON.parse(missingResult.stdout);
  assert.equal(missingResult.status, 1);
  assert.equal(missing.status, "unknown_recipe");
});
