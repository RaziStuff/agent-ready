import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, "../..");
const RECIPES_MARKDOWN_PATH = path.join(PACKAGE_ROOT, "docs", "agent-recipes.md");
const RECIPES_JSON_PATH = path.join(PACKAGE_ROOT, "docs", "agent-recipes.json");

function jsonText(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function bulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "- None listed.";
  }
  return items.map((item) => `- ${item}`).join("\n");
}

function stepCommand(step) {
  if (step.command) {
    return `Command: \`${step.command}\``;
  }
  if (step.mcp?.resource) {
    return `MCP resource: \`${step.mcp.resource}\``;
  }
  if (step.mcp?.tool) {
    return `MCP tool: \`${step.mcp.tool}\` with \`${JSON.stringify(step.mcp.arguments ?? {})}\``;
  }
  if (step.mcp?.prompt) {
    return `MCP prompt: \`${step.mcp.prompt}\` with \`${JSON.stringify(step.mcp.arguments ?? {})}\``;
  }
  return "Action: see recipe metadata.";
}

export async function loadRecipeCatalog() {
  return JSON.parse(await fs.readFile(RECIPES_JSON_PATH, "utf8"));
}

export async function loadRecipeMarkdown() {
  return fs.readFile(RECIPES_MARKDOWN_PATH, "utf8");
}

export async function findRecipe(recipeId) {
  const catalog = await loadRecipeCatalog();
  return catalog.recipes.find((recipe) => recipe.id === recipeId || recipe.title === recipeId) ?? null;
}

export function formatRecipeCatalog(catalog) {
  const lines = [
    "# Agent Adoption Recipes",
    "",
    catalog.description,
    "",
    "## Recipes",
    ""
  ];

  for (const recipe of catalog.recipes) {
    lines.push(`- \`${recipe.id}\`: ${recipe.title} (${recipe.transport}).`);
  }

  lines.push("");
  lines.push("## Safety Rules");
  lines.push("");
  lines.push(bulletList(catalog.safetyRules));
  lines.push("");
  lines.push("Print one recipe with `agent-ready recipes <recipe-id>`.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function formatRecipe(recipe) {
  const lines = [
    `# ${recipe.title}`,
    "",
    `Recipe id: \`${recipe.id}\``,
    `Transport: \`${recipe.transport}\``,
    `Audience: ${recipe.audience.map((item) => `\`${item}\``).join(", ")}`,
    ""
  ];

  if (recipe.server) {
    lines.push("## MCP Server");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(recipe.server, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Steps");
  lines.push("");
  for (const [index, step] of recipe.steps.entries()) {
    lines.push(`${index + 1}. ${step.phase}`);
    lines.push(`   ${stepCommand(step)}`);
    lines.push(`   Expect: ${step.expect}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export async function recipeOutput({ recipeId = null, json = false } = {}) {
  const catalog = await loadRecipeCatalog();

  if (recipeId) {
    const recipe = catalog.recipes.find((item) => item.id === recipeId || item.title === recipeId);
    const availableRecipes = catalog.recipes.map((item) => item.id);
    if (!recipe) {
      const payload = {
        ok: false,
        status: "unknown_recipe",
        recipeId,
        availableRecipes
      };
      return {
        ok: false,
        status: "unknown_recipe",
        recipeId,
        availableRecipes,
        text: json ? jsonText(payload) : `Unknown recipe: ${recipeId}\n\nAvailable recipes:\n${bulletList(availableRecipes.map((item) => `\`${item}\``))}\n`
      };
    }
    return {
      ok: true,
      status: "found",
      recipe,
      text: json ? jsonText(recipe) : formatRecipe(recipe)
    };
  }

  return {
    ok: true,
    status: "catalog",
    catalog,
    text: json ? jsonText(catalog) : await loadRecipeMarkdown().catch(() => formatRecipeCatalog(catalog))
  };
}
