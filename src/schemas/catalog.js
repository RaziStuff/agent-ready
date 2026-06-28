import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, "../..");
const SCHEMAS_ROOT = path.join(PACKAGE_ROOT, "schemas");
const SCHEMA_VERSION = "0.1.0";

export const SCHEMA_DEFINITIONS = Object.freeze([
  {
    id: "config",
    file: "schemas/config.schema.json",
    kind: "configuration",
    description: "Maintainer configuration read from agent-ready.config.json.",
    producedBy: ["agent-ready config init"]
  },
  {
    id: "repo-map",
    file: "schemas/repo-map.schema.json",
    kind: "metadata",
    description: "Generated repository map written to .agents/repo-map.json.",
    producedBy: ["agent-ready init", "agent-ready update"]
  },
  {
    id: "commands",
    file: "schemas/commands.schema.json",
    kind: "metadata",
    description: "Generated command catalog written to .agents/commands.json.",
    producedBy: ["agent-ready init", "agent-ready update"]
  },
  {
    id: "workspaces",
    file: "schemas/workspaces.schema.json",
    kind: "metadata",
    description: "Generated workspace package catalog written to .agents/workspaces.json and printed by the workspaces report.",
    producedBy: ["agent-ready init", "agent-ready update", "agent-ready workspaces --json"]
  },
  {
    id: "affected",
    file: "schemas/affected.schema.json",
    kind: "runtime-report",
    description: "Affected workspace package report for planned paths or current git changes.",
    producedBy: ["agent-ready affected [path...] --json", "agent-ready workspaces --changed --json"]
  },
  {
    id: "impact",
    file: "schemas/impact.schema.json",
    kind: "runtime-report",
    description: "Impact report for planned paths or current git changes.",
    producedBy: ["agent-ready impact <path...> --json", "agent-ready impact --changed --json"]
  },
  {
    id: "handoff",
    file: "schemas/handoff.schema.json",
    kind: "runtime-report",
    description: "Handoff packet for transferring work between agents or maintainers.",
    producedBy: ["agent-ready handoff [path...] --json", "agent-ready handoff --changed --json"]
  },
  {
    id: "preflight",
    file: "schemas/preflight.schema.json",
    kind: "runtime-report",
    description: "One-shot readiness, impact, validation, and handoff guidance.",
    producedBy: ["agent-ready preflight [path...] --json"]
  },
  {
    id: "run-receipt",
    file: "schemas/run-receipt.schema.json",
    kind: "runtime-report",
    description: "Structured receipt for a discovered or configured validation command.",
    producedBy: ["agent-ready run <command-name> --json"]
  },
  {
    id: "status",
    file: "schemas/status.schema.json",
    kind: "runtime-report",
    description: "Compact dashboard for readiness, worktree state, validation, recipes, and CI adoption.",
    producedBy: ["agent-ready status --json"]
  }
]);

function jsonText(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function normalizeSchemaId(value) {
  return String(value ?? "")
    .trim()
    .replace(/^schemas\//, "")
    .replace(/\.schema\.json$/, "");
}

function schemaDefinition(schemaId) {
  const normalized = normalizeSchemaId(schemaId);
  return SCHEMA_DEFINITIONS.find((definition) => definition.id === normalized) ?? null;
}

async function readSchemaFile(definition) {
  return JSON.parse(await fs.readFile(path.join(PACKAGE_ROOT, definition.file), "utf8"));
}

function catalogEntry(definition, schema) {
  return {
    id: definition.id,
    file: definition.file,
    kind: definition.kind,
    title: schema.title ?? definition.id,
    description: definition.description,
    jsonSchemaId: schema.$id ?? null,
    required: schema.required ?? [],
    producedBy: definition.producedBy,
    cli: `agent-ready schemas ${definition.id} --json`,
    mcpResource: `agent-ready://schema/${definition.id}`
  };
}

export function availableSchemaIds() {
  return SCHEMA_DEFINITIONS.map((definition) => definition.id);
}

export async function loadSchemaById(schemaId) {
  const definition = schemaDefinition(schemaId);
  if (!definition) {
    return null;
  }
  const schema = await readSchemaFile(definition);
  return {
    definition,
    schema,
    entry: catalogEntry(definition, schema)
  };
}

export async function loadSchemaCatalog() {
  const schemas = [];
  for (const definition of SCHEMA_DEFINITIONS) {
    const schema = await readSchemaFile(definition);
    schemas.push(catalogEntry(definition, schema));
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    description: "Published JSON Schema contracts for agent-ready configuration, generated metadata, and runtime reports.",
    cli: {
      catalog: "agent-ready schemas --json",
      schema: "agent-ready schemas <schema-id> --json"
    },
    mcp: {
      catalog: "agent-ready://schemas",
      schemaTemplate: "agent-ready://schema/{id}"
    },
    schemas
  };
}

function bulletList(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "- None listed.";
  }
  return items.map((item) => `- \`${item}\``).join("\n");
}

export function formatSchemaCatalog(catalog) {
  const lines = [
    "# Agent Ready JSON Schemas",
    "",
    catalog.description,
    "",
    "## Schemas",
    ""
  ];

  for (const schema of catalog.schemas) {
    lines.push(`- \`${schema.id}\`: ${schema.title} (${schema.kind}; \`${schema.file}\`).`);
  }

  lines.push("");
  lines.push("## Access");
  lines.push("");
  lines.push(`- CLI catalog: \`${catalog.cli.catalog}\``);
  lines.push(`- CLI schema: \`${catalog.cli.schema}\``);
  lines.push(`- MCP catalog: \`${catalog.mcp.catalog}\``);
  lines.push(`- MCP schema: \`${catalog.mcp.schemaTemplate}\``);
  lines.push("");
  lines.push("Print one schema with `agent-ready schemas <schema-id>`.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function formatSchemaDocument({ entry, schema }) {
  const lines = [
    `# ${entry.title}`,
    "",
    `Schema id: \`${entry.id}\``,
    `Kind: \`${entry.kind}\``,
    `File: \`${entry.file}\``,
    entry.jsonSchemaId ? `JSON Schema id: \`${entry.jsonSchemaId}\`` : null,
    `CLI: \`${entry.cli}\``,
    `MCP resource: \`${entry.mcpResource}\``,
    "",
    entry.description,
    "",
    "## Required Fields",
    "",
    bulletList(schema.required ?? []),
    "",
    "## Produced By",
    "",
    bulletList(entry.producedBy),
    ""
  ].filter((line) => line !== null);

  return `${lines.join("\n")}\n`;
}

export async function schemaOutput({ schemaId = null, json = false } = {}) {
  if (schemaId) {
    const result = await loadSchemaById(schemaId);
    if (!result) {
      const payload = {
        ok: false,
        status: "unknown_schema",
        schemaId,
        availableSchemas: availableSchemaIds()
      };
      return {
        ok: false,
        status: "unknown_schema",
        text: json
          ? jsonText(payload)
          : `Unknown schema: ${schemaId}\n\nAvailable schemas:\n${bulletList(payload.availableSchemas)}\n`
      };
    }

    return {
      ok: true,
      status: "schema",
      schemaId: result.definition.id,
      text: json ? jsonText(result.schema) : formatSchemaDocument(result)
    };
  }

  const catalog = await loadSchemaCatalog();
  return {
    ok: true,
    status: "catalog",
    catalog,
    text: json ? jsonText(catalog) : formatSchemaCatalog(catalog)
  };
}

export { SCHEMAS_ROOT };
