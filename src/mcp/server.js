import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import process from "node:process";
import { buildContextPacket, formatContextPacket } from "../context/packet.js";
import { pathExists, readTextFileIfSafe } from "../core/inventory.js";
import { scanRepo } from "../core/scanner.js";
import { buildDoctorReport } from "../doctor/report.js";
import { buildHandoffReport, formatHandoffReport } from "../handoff/report.js";
import { listGitChangedPaths } from "../impact/git-changes.js";
import { buildImpactReport } from "../impact/report.js";
import { buildPreflightReport, formatPreflightReport } from "../preflight/report.js";
import { loadRecipeCatalog, loadRecipeMarkdown } from "../recipes/report.js";
import { loadSchemaById, loadSchemaCatalog } from "../schemas/catalog.js";
import { buildStatusReport, formatStatusReport } from "../status/report.js";
import { generateAgentsMd } from "../writers/agents-md.js";
import { agentIndex, commandCatalog, handoffTemplate, repoMap, riskPolicy, workspaceCatalog } from "../writers/metadata.js";
import {
  buildAffectedWorkspacesReport,
  buildWorkspacesReport,
  formatAffectedWorkspacesReport,
  formatWorkspacesReport
} from "../workspaces/report.js";
import { validateRepo } from "../validators/validate.js";

const SERVER_NAME = "agent-ready";
const SERVER_VERSION = "0.2.5";
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

export const MCP_RESOURCES = [
  {
    uri: "agent-ready://agents-md",
    name: "AGENTS.md",
    description: "Canonical agent operating guide for this repository.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://repo-map",
    name: "repo-map.json",
    description: "Structured repository map, languages, directories, entrypoints, docs, CI, and framework signals.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://commands",
    name: "commands.json",
    description: "Structured command catalog with confidence, risk, and side-effect metadata.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://workspaces",
    name: "workspaces.json",
    description: "Workspace package catalog with workspace-level and package-scoped commands.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://risk-policy",
    name: "risk-policy.md",
    description: "Generated risk areas and default safety rules for coding agents.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://handoff-template",
    name: "handoff-template.md",
    description: "Reusable handoff template for agent-to-agent or agent-to-human transfer.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://agent-index",
    name: "agent-index.md",
    description: "Longer generated index with languages, commands, and scanner evidence.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://doctor",
    name: "doctor.json",
    description: "Agent readiness report covering generated docs, commands, validation, safety, CI, config, and MCP setup.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://context",
    name: "context.md",
    description: "Compact agent onboarding packet combining readiness, docs, commands, risks, CI, and MCP entrypoints.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://status",
    name: "status.json",
    description: "Compact agent dashboard with readiness, current git changes, preflight summary, validation receipts, recipes, and CI adoption hints.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://recipes",
    name: "agent-recipes.md",
    description: "Built-in copy-paste adoption recipes for CLI, MCP, Codex, Claude, Cursor, and terminal agents.",
    mimeType: "text/markdown"
  },
  {
    uri: "agent-ready://recipes-json",
    name: "agent-recipes.json",
    description: "Built-in machine-readable adoption recipes for agents that want command sequences as data.",
    mimeType: "application/json"
  },
  {
    uri: "agent-ready://schemas",
    name: "schemas.json",
    description: "Catalog of published JSON Schema contracts for config, generated metadata, and runtime reports.",
    mimeType: "application/json"
  }
];

export const MCP_RESOURCE_TEMPLATES = [
  {
    uriTemplate: "agent-ready://docs/{path}",
    name: "Repository documentation by path",
    description: "Read a documentation file discovered by agent-ready. The path argument must be a URL-encoded repo-relative path.",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "agent-ready://command/{name}",
    name: "Command metadata by name",
    description: "Read structured metadata for a discovered or configured command by URL-encoded command name.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "agent-ready://risk/{path}",
    name: "Risk metadata by path",
    description: "Read structured risk metadata for a discovered risk path by URL-encoded repo-relative path.",
    mimeType: "application/json"
  },
  {
    uriTemplate: "agent-ready://schema/{id}",
    name: "JSON Schema by id",
    description: "Read a published agent-ready JSON Schema by schema id, such as status, impact, or run-receipt.",
    mimeType: "application/schema+json"
  }
];

const MCP_TOOLS = [
  {
    name: "agent_ready_status",
    description: "Return a compact agent dashboard for readiness, current changes, validation receipts, recipes, and CI adoption hints.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        strict: {
          type: "boolean",
          description: "Treat readiness warnings as blockers."
        }
      }
    }
  },
  {
    name: "agent_ready_summary",
    description: "Return a compact JSON summary of the current repository for an agent.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        includeEvidence: {
          type: "boolean",
          description: "Include scanner evidence strings in the summary."
        }
      }
    }
  },
  {
    name: "agent_ready_workspaces",
    description: "Return workspace package summaries with root workspace commands and package-scoped command suggestions.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {}
    }
  },
  {
    name: "agent_ready_affected",
    description: "Return workspace packages affected by planned paths or current git changes, with package-scoped command suggestions.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: {
          type: "array",
          description: "Repo-relative paths the agent plans to edit. If omitted, current git changed paths are used.",
          items: {
            type: "string"
          },
          minItems: 1
        },
        changed: {
          type: "boolean",
          description: "Use current git changed paths from the worktree."
        }
      }
    }
  },
  {
    name: "agent_ready_validate",
    description: "Run agent-ready validation and return errors and warnings.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        strict: {
          type: "boolean",
          description: "Treat warnings as validation failures."
        }
      }
    }
  },
  {
    name: "agent_ready_doctor",
    description: "Return the agent-ready doctor readiness report for the current repository.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        strict: {
          type: "boolean",
          description: "Treat readiness warnings as failures in the returned ok field."
        }
      }
    }
  },
  {
    name: "agent_ready_impact",
    description: "Explain risk and validation guidance for planned changed paths.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: {
          type: "array",
          description: "Repo-relative paths the agent plans to edit.",
          items: {
            type: "string"
          },
          minItems: 1
        },
        changed: {
          type: "boolean",
          description: "Use current git changed paths from the worktree."
        }
      }
    }
  },
  {
    name: "agent_ready_handoff",
    description: "Create a structured handoff packet with changed paths, impact guidance, and validation recommendations.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: {
          type: "array",
          description: "Repo-relative paths to include in the handoff.",
          items: {
            type: "string"
          },
          minItems: 1
        },
        changed: {
          type: "boolean",
          description: "Use current git changed paths from the worktree."
        },
        goal: {
          type: "string",
          description: "Optional goal or workstream label for the handoff."
        }
      }
    }
  },
  {
    name: "agent_ready_preflight",
    description: "Check readiness, changed-path impact, validation recommendations, and handoff guidance.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: {
          type: "array",
          description: "Repo-relative paths to preflight. If omitted, current git changed paths are used.",
          items: {
            type: "string"
          },
          minItems: 1
        },
        changed: {
          type: "boolean",
          description: "Use current git changed paths from the worktree."
        },
        strict: {
          type: "boolean",
          description: "Treat readiness warnings as blockers."
        },
        goal: {
          type: "string",
          description: "Optional goal or workstream label for the handoff command."
        }
      }
    }
  }
];

export const MCP_PROMPTS = [
  {
    name: "agent-ready-orient",
    description: "Orient an agent in this repository before making code changes.",
    arguments: [
      {
        name: "focus",
        description: "Optional area, task, or path to pay extra attention to.",
        required: false
      }
    ]
  },
  {
    name: "agent-ready-handoff",
    description: "Create a concise handoff using the repo's generated guide and metadata.",
    arguments: [
      {
        name: "goal",
        description: "Optional goal or current workstream that the handoff should preserve.",
        required: false
      }
    ]
  },
  {
    name: "agent-ready-risk-review",
    description: "Review planned changes against the repo's risk policy and validation commands.",
    arguments: [
      {
        name: "paths",
        description: "Optional comma-separated paths or globs involved in the planned change.",
        required: false
      }
    ]
  }
];

function jsonText(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function response(id, result) {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function errorResponse(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data })
    }
  };
}

function mcpError(code, message, data) {
  const error = new Error(message);
  error.code = code;
  error.data = data;
  return error;
}

function resourceDefinition(uri) {
  return MCP_RESOURCES.find((resource) => resource.uri === uri) ?? null;
}

async function readFileIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return fs.readFile(filePath, "utf8");
}

async function scanForContext(root, configPath) {
  return scanRepo({ root, configPath });
}

async function readSchemaResource(uri) {
  if (uri === "agent-ready://schemas") {
    return {
      uri,
      mimeType: "application/json",
      text: jsonText(await loadSchemaCatalog())
    };
  }

  if (uri.startsWith("agent-ready://schema/")) {
    const schemaId = decodeTemplateValue(uri.slice("agent-ready://schema/".length), "schema id");
    const result = await loadSchemaById(schemaId);
    if (!result) {
      throw mcpError(-32602, `Unknown schema id: ${schemaId}`);
    }
    return {
      uri,
      mimeType: "application/schema+json",
      text: jsonText(result.schema)
    };
  }

  return null;
}

function decodeTemplateValue(value, label) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw mcpError(-32602, `Invalid URL encoding for ${label}.`);
  }
}

function isMarkdownPath(relPath) {
  return [".md", ".mdx", ".markdown"].includes(path.extname(relPath).toLowerCase());
}

async function readTemplatedResource({ root }, uri, scan) {
  if (uri.startsWith("agent-ready://docs/")) {
    const docPath = decodeTemplateValue(uri.slice("agent-ready://docs/".length), "docs path");
    const doc = scan.docs.find((item) => item.path === docPath);
    if (!doc) {
      throw mcpError(-32602, `Unknown docs path: ${docPath}`);
    }

    const text = await readTextFileIfSafe(root, doc.path);
    if (text === null) {
      throw mcpError(-32602, `Documentation file is not readable through MCP: ${doc.path}`);
    }

    return {
      uri,
      mimeType: isMarkdownPath(doc.path) ? "text/markdown" : "text/plain",
      text
    };
  }

  if (uri.startsWith("agent-ready://command/")) {
    const commandName = decodeTemplateValue(uri.slice("agent-ready://command/".length), "command name");
    const command = scan.commands.find((item) => item.name === commandName);
    if (!command) {
      throw mcpError(-32602, `Unknown command name: ${commandName}`);
    }

    return {
      uri,
      mimeType: "application/json",
      text: jsonText(command)
    };
  }

  if (uri.startsWith("agent-ready://risk/")) {
    const riskPath = decodeTemplateValue(uri.slice("agent-ready://risk/".length), "risk path");
    const risks = scan.risks.filter((item) => item.path === riskPath);
    if (risks.length === 0) {
      throw mcpError(-32602, `Unknown risk path: ${riskPath}`);
    }

    return {
      uri,
      mimeType: "application/json",
      text: jsonText({ path: riskPath, risks })
    };
  }

  return null;
}

export async function readMcpResource({ root, configPath = null }, uri) {
  const schemaResource = await readSchemaResource(uri);
  if (schemaResource) {
    return schemaResource;
  }

  const resource = resourceDefinition(uri);
  const scan = await scanForContext(root, configPath);

  if (!resource) {
    const templated = await readTemplatedResource({ root }, uri, scan);
    if (templated) {
      return templated;
    }
    throw mcpError(-32602, `Unknown resource URI: ${uri}`);
  }

  const agentsDir = path.join(root, ".agents");
  let text = null;

  if (uri === "agent-ready://agents-md") {
    text = await readFileIfExists(path.join(root, "AGENTS.md"));
    if (!text) {
      text = generateAgentsMd(scan);
    }
  } else if (uri === "agent-ready://repo-map") {
    text = await readFileIfExists(path.join(agentsDir, "repo-map.json"));
    if (!text) {
      text = jsonText(repoMap(scan));
    }
  } else if (uri === "agent-ready://commands") {
    text = await readFileIfExists(path.join(agentsDir, "commands.json"));
    if (!text) {
      text = jsonText(commandCatalog(scan));
    }
  } else if (uri === "agent-ready://workspaces") {
    text = await readFileIfExists(path.join(agentsDir, "workspaces.json"));
    if (!text) {
      text = jsonText(workspaceCatalog(scan));
    }
  } else if (uri === "agent-ready://risk-policy") {
    text = await readFileIfExists(path.join(agentsDir, "risk-policy.md"));
    if (!text) {
      text = riskPolicy(scan);
    }
  } else if (uri === "agent-ready://handoff-template") {
    text = await readFileIfExists(path.join(agentsDir, "handoff-template.md"));
    if (!text) {
      text = handoffTemplate();
    }
  } else if (uri === "agent-ready://agent-index") {
    text = await readFileIfExists(path.join(agentsDir, "agent-index.md"));
    if (!text) {
      text = agentIndex(scan);
    }
  } else if (uri === "agent-ready://doctor") {
    text = jsonText(await buildDoctorReport({ root, configPath, strict: false }));
  } else if (uri === "agent-ready://context") {
    text = formatContextPacket(await buildContextPacket({ root, configPath, strict: false }));
  } else if (uri === "agent-ready://status") {
    text = jsonText(await buildStatusReport({ root, configPath, strict: false }));
  } else if (uri === "agent-ready://recipes") {
    text = await loadRecipeMarkdown();
  } else if (uri === "agent-ready://recipes-json") {
    text = jsonText(await loadRecipeCatalog());
  }

  return {
    uri,
    mimeType: resource.mimeType,
    text: text ?? ""
  };
}

function compactSummary(scan, includeEvidence = false) {
  return {
    root: scan.root,
    summary: scan.summary,
    inventory: scan.inventory,
    languages: scan.languages,
    packageManagers: scan.packageManagers,
    frameworks: scan.frameworks,
    monorepo: scan.monorepo,
    commands: scan.commands,
    risks: scan.risks.slice(0, 50),
    docs: scan.docs,
    ci: scan.ci,
    ...(includeEvidence ? { evidence: scan.evidence } : {})
  };
}

async function callTool({ root, configPath = null }, name, args = {}) {
  if (name === "agent_ready_status") {
    if (args.strict !== undefined && typeof args.strict !== "boolean") {
      throw mcpError(-32602, "agent_ready_status arguments.strict must be a boolean when provided.");
    }
    const result = await buildStatusReport({ root, configPath, strict: args.strict === true });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ...result,
            markdown: formatStatusReport(result)
          })
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_summary") {
    const scan = await scanForContext(root, configPath);
    return {
      content: [
        {
          type: "text",
          text: jsonText(compactSummary(scan, args.includeEvidence === true))
        }
      ]
    };
  }

  if (name === "agent_ready_workspaces") {
    const result = await buildWorkspacesReport({ root, configPath });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ...result,
            markdown: formatWorkspacesReport(result)
          })
        }
      ]
    };
  }

  if (name === "agent_ready_affected") {
    const hasPaths = Array.isArray(args.paths) && args.paths.length > 0;
    if (args.paths !== undefined && (!hasPaths || !args.paths.every((item) => typeof item === "string"))) {
      throw mcpError(-32602, "agent_ready_affected arguments.paths must be a non-empty string array when provided.");
    }
    if (args.changed !== undefined && typeof args.changed !== "boolean") {
      throw mcpError(-32602, "agent_ready_affected arguments.changed must be a boolean when provided.");
    }
    const result = await buildAffectedWorkspacesReport({
      root,
      configPath,
      paths: hasPaths ? args.paths : [],
      changed: args.changed === true || !hasPaths
    });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ...result,
            markdown: formatAffectedWorkspacesReport(result)
          })
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_validate") {
    const result = await validateRepo({ root, configPath, strict: args.strict === true });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ok: result.ok,
            strict: result.strict,
            errors: result.errors,
            warnings: result.warnings
          })
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_doctor") {
    const result = await buildDoctorReport({ root, configPath, strict: args.strict === true });
    return {
      content: [
        {
          type: "text",
          text: jsonText(result)
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_impact") {
    const hasPaths = Array.isArray(args.paths) && args.paths.length > 0;
    if (args.paths !== undefined && (!hasPaths || !args.paths.every((item) => typeof item === "string"))) {
      throw mcpError(-32602, "agent_ready_impact arguments.paths must be a non-empty string array when provided.");
    }
    if (args.changed !== undefined && typeof args.changed !== "boolean") {
      throw mcpError(-32602, "agent_ready_impact arguments.changed must be a boolean when provided.");
    }
    if (!hasPaths && args.changed !== true) {
      throw mcpError(-32602, "agent_ready_impact requires arguments.paths or arguments.changed: true.");
    }
    const changedPaths = args.changed === true ? await listGitChangedPaths(root) : [];
    const result = await buildImpactReport({
      root,
      configPath,
      paths: [...changedPaths, ...(hasPaths ? args.paths : [])],
      pathSource: args.changed === true ? "git_changed" : "provided"
    });
    return {
      content: [
        {
          type: "text",
          text: jsonText(result)
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_handoff") {
    const hasPaths = Array.isArray(args.paths) && args.paths.length > 0;
    if (args.paths !== undefined && (!hasPaths || !args.paths.every((item) => typeof item === "string"))) {
      throw mcpError(-32602, "agent_ready_handoff arguments.paths must be a non-empty string array when provided.");
    }
    if (args.changed !== undefined && typeof args.changed !== "boolean") {
      throw mcpError(-32602, "agent_ready_handoff arguments.changed must be a boolean when provided.");
    }
    if (args.goal !== undefined && typeof args.goal !== "string") {
      throw mcpError(-32602, "agent_ready_handoff arguments.goal must be a string when provided.");
    }
    const result = await buildHandoffReport({
      root,
      configPath,
      paths: hasPaths ? args.paths : [],
      changed: args.changed === true,
      goal: args.goal ?? ""
    });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ...result,
            markdown: formatHandoffReport(result)
          })
        }
      ],
      isError: !result.ok
    };
  }

  if (name === "agent_ready_preflight") {
    const hasPaths = Array.isArray(args.paths) && args.paths.length > 0;
    if (args.paths !== undefined && (!hasPaths || !args.paths.every((item) => typeof item === "string"))) {
      throw mcpError(-32602, "agent_ready_preflight arguments.paths must be a non-empty string array when provided.");
    }
    if (args.changed !== undefined && typeof args.changed !== "boolean") {
      throw mcpError(-32602, "agent_ready_preflight arguments.changed must be a boolean when provided.");
    }
    if (args.strict !== undefined && typeof args.strict !== "boolean") {
      throw mcpError(-32602, "agent_ready_preflight arguments.strict must be a boolean when provided.");
    }
    if (args.goal !== undefined && typeof args.goal !== "string") {
      throw mcpError(-32602, "agent_ready_preflight arguments.goal must be a string when provided.");
    }
    const result = await buildPreflightReport({
      root,
      configPath,
      paths: hasPaths ? args.paths : [],
      changed: args.changed === true,
      strict: args.strict === true,
      goal: args.goal ?? ""
    });
    return {
      content: [
        {
          type: "text",
          text: jsonText({
            ...result,
            markdown: formatPreflightReport(result)
          })
        }
      ],
      isError: !result.ok
    };
  }

  throw mcpError(-32602, `Unknown tool: ${name}`);
}

function promptText(name, args = {}) {
  if (name === "agent-ready-orient") {
    const focus = typeof args.focus === "string" && args.focus.trim() ? `\n\nFocus especially on: ${args.focus.trim()}` : "";
    return [
      "Orient yourself in this repository before making changes.",
      "Read `agent-ready://context` first for the compact onboarding packet.",
      "Then read `agent-ready://doctor`, `agent-ready://agents-md`, `agent-ready://repo-map`, `agent-ready://workspaces`, and `agent-ready://commands` as needed.",
      "Call `agent_ready_preflight` before handoff to check readiness, changed-path impact, validation, and handoff guidance.",
      "Call `agent_ready_workspaces` in monorepos before choosing package-local validation commands.",
      "Call `agent_ready_affected` when you only need affected workspace packages for planned or current changes.",
      "Call `agent_ready_doctor` with `strict: true` when you need machine-readable readiness status.",
      "Use `agent_ready_validate` to understand whether the generated agent docs are current.",
      "Summarize the repo purpose, key commands, risky paths, and the smallest safe next step before editing.",
      focus
    ].join("\n");
  }

  if (name === "agent-ready-handoff") {
    const goal = typeof args.goal === "string" && args.goal.trim() ? `\n\nCurrent goal: ${args.goal.trim()}` : "";
    return [
      "Create a handoff for the next agent or human maintainer.",
      "Call `agent_ready_preflight` first to identify changed-path impact and validation recommendations.",
      "Call `agent_ready_handoff` with `changed: true` when the current worktree should drive the handoff.",
      "Read `agent-ready://handoff-template`, `agent-ready://agents-md`, `agent-ready://repo-map`, and `agent-ready://commands`.",
      "Include completed work, changed files, verification commands and results, open risks, and precise next steps.",
      "Keep the handoff concise enough to paste into a new agent thread.",
      goal
    ].join("\n");
  }

  if (name === "agent-ready-risk-review") {
    const paths = typeof args.paths === "string" && args.paths.trim() ? `\n\nPlanned paths: ${args.paths.trim()}` : "";
    return [
      "Review the planned change against this repository's safety model.",
      "Read `agent-ready://risk-policy`, `agent-ready://commands`, and `agent-ready://repo-map`.",
      "Call `agent_ready_impact` with the planned repo-relative paths when they are known, or with `changed: true` before handoff.",
      "Call `agent_ready_validate` and identify which tests or checks are most relevant.",
      "Flag risky paths, generated files, migrations, CI/deployment files, lockfiles, and secret-like files before editing.",
      paths
    ].join("\n");
  }

  throw mcpError(-32602, `Unknown prompt: ${name}`);
}

function getPrompt(name, args = {}) {
  const prompt = MCP_PROMPTS.find((item) => item.name === name);
  if (!prompt) {
    throw mcpError(-32602, `Unknown prompt: ${name}`);
  }

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: promptText(name, args)
        }
      }
    ]
  };
}

export async function handleMcpRequest(context, request) {
  if (!request || request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return errorResponse(request?.id, -32600, "Invalid JSON-RPC request.");
  }

  if (!("id" in request)) {
    return null;
  }

  try {
    if (request.method === "initialize") {
      return response(request.id, {
        protocolVersion: request.params?.protocolVersion ?? DEFAULT_PROTOCOL_VERSION,
        capabilities: {
          resources: {},
          tools: {},
          prompts: {}
        },
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION
        },
        instructions: "Use resources/list and resources/read to load AGENTS.md and generated agent-ready metadata."
      });
    }

    if (request.method === "ping") {
      return response(request.id, {});
    }

    if (request.method === "resources/list") {
      return response(request.id, { resources: MCP_RESOURCES });
    }

    if (request.method === "resources/read") {
      const uri = request.params?.uri;
      if (typeof uri !== "string") {
        throw mcpError(-32602, "resources/read requires params.uri.");
      }
      const content = await readMcpResource(context, uri);
      return response(request.id, { contents: [content] });
    }

    if (request.method === "resources/templates/list") {
      return response(request.id, { resourceTemplates: MCP_RESOURCE_TEMPLATES });
    }

    if (request.method === "tools/list") {
      return response(request.id, { tools: MCP_TOOLS });
    }

    if (request.method === "tools/call") {
      const name = request.params?.name;
      if (typeof name !== "string") {
        throw mcpError(-32602, "tools/call requires params.name.");
      }
      return response(request.id, await callTool(context, name, request.params?.arguments ?? {}));
    }

    if (request.method === "prompts/list") {
      return response(request.id, { prompts: MCP_PROMPTS });
    }

    if (request.method === "prompts/get") {
      const name = request.params?.name;
      if (typeof name !== "string") {
        throw mcpError(-32602, "prompts/get requires params.name.");
      }
      return response(request.id, getPrompt(name, request.params?.arguments ?? {}));
    }

    throw mcpError(-32601, `Method not found: ${request.method}`);
  } catch (error) {
    return errorResponse(request.id, error.code ?? -32603, error.message, error.data);
  }
}

export async function runStdioMcpServer({ root, configPath = null, input = process.stdin, output = process.stdout }) {
  const context = { root: path.resolve(root), configPath };
  const lines = readline.createInterface({
    input,
    crlfDelay: Infinity,
    terminal: false
  });

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let request;
    try {
      request = JSON.parse(line);
    } catch (error) {
      output.write(`${JSON.stringify(errorResponse(null, -32700, `Parse error: ${error.message}`))}\n`);
      continue;
    }

    const result = await handleMcpRequest(context, request);
    if (result) {
      output.write(`${JSON.stringify(result)}\n`);
    }
  }
}
