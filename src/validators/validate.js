import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../core/inventory.js";
import { scanRepo } from "../core/scanner.js";
import { validateCommandsMetadata, validateRepoMapMetadata, validateWorkspacesMetadata } from "./metadata-schema.js";

function commandKey(command) {
  return `${command.name}:${command.command}`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function addSchemaWarnings(warnings, label, issues) {
  for (const issue of issues) {
    warnings.push(`${label} schema warning: ${issue}`);
  }
}

const LOCAL_PATH_PREFIXES = new Set([
  ".agents",
  ".github",
  "app",
  "apps",
  "assets",
  "cmd",
  "components",
  "config",
  "database",
  "db",
  "docs",
  "examples",
  "infra",
  "internal",
  "lib",
  "libs",
  "packages",
  "pages",
  "prisma",
  "public",
  "schemas",
  "scripts",
  "services",
  "src",
  "test",
  "tests"
]);

const EXTENSIONLESS_FILE_NAMES = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "Dockerfile",
  "Gemfile",
  "Jenkinsfile",
  "LICENSE",
  "Makefile",
  "Procfile",
  "README.md",
  "SECURITY.md",
  "Taskfile",
  "justfile",
  "Justfile"
]);

function withoutFencedCodeBlocks(content) {
  return content.replace(/```[\s\S]*?```/g, "");
}

function normalizeReferenceTarget(rawTarget) {
  let target = String(rawTarget ?? "").trim();
  if (!target) {
    return null;
  }

  if (target.startsWith("<") && target.endsWith(">")) {
    target = target.slice(1, -1).trim();
  } else {
    target = target.split(/\s+/)[0];
  }

  target = target
    .replace(/^['"]|['"]$/g, "")
    .replace(/[.,;!?]+$/g, "")
    .trim();

  if (target.startsWith("#")) {
    return null;
  }

  const hashIndex = target.indexOf("#");
  if (hashIndex > 0) {
    target = target.slice(0, hashIndex);
  }

  const queryIndex = target.indexOf("?");
  if (queryIndex > 0) {
    target = target.slice(0, queryIndex);
  }

  target = target.replace(/:\d+(?::\d+)?$/, "");
  return target.trim() || null;
}

function hasFileExtension(target) {
  return /\.[A-Za-z0-9]{1,12}$/.test(path.posix.basename(target));
}

function looksLikeLocalReference(target) {
  if (!target || target === "." || target === "..") {
    return false;
  }

  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) {
    return false;
  }

  if (target.startsWith("@") || target.startsWith("~")) {
    return false;
  }

  if (/[\s*{}$|&;<>\[\]]/.test(target)) {
    return false;
  }

  const repoRelative = target.replace(/^\/+/, "").replace(/^\.\//, "");
  const firstSegment = repoRelative.split("/")[0];
  const basename = path.posix.basename(repoRelative.replace(/\/$/, ""));

  if (target.endsWith("/")) {
    return true;
  }

  if (EXTENSIONLESS_FILE_NAMES.has(basename)) {
    return true;
  }

  if (hasFileExtension(repoRelative)) {
    return true;
  }

  if (target.startsWith("./") || target.startsWith("../") || target.startsWith("/") || firstSegment.startsWith(".")) {
    return true;
  }

  return target.includes("/") && LOCAL_PATH_PREFIXES.has(firstSegment);
}

export function extractAgentsMdReferences(content) {
  const markdown = withoutFencedCodeBlocks(content);
  const references = new Map();
  const addReference = (rawTarget) => {
    const target = normalizeReferenceTarget(rawTarget);
    if (target && looksLikeLocalReference(target)) {
      references.set(target, target);
    }
  };

  for (const match of markdown.matchAll(/!?\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
    addReference(match[1]);
  }

  for (const match of markdown.matchAll(/^\s*\[[^\]\n]+\]:\s+(\S+)/gm)) {
    addReference(match[1]);
  }

  for (const match of markdown.matchAll(/`([^`\n]+)`/g)) {
    addReference(match[1]);
  }

  return [...references.values()].sort();
}

function resolveRepoReference(root, reference) {
  const repoRelative = reference.replace(/^\/+/, "");
  const absolute = path.resolve(root, repoRelative);
  const relative = path.relative(root, absolute);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return absolute;
}

async function addAgentsReferenceWarnings(warnings, root, content) {
  for (const reference of extractAgentsMdReferences(content)) {
    const absolute = resolveRepoReference(root, reference);
    if (!absolute) {
      continue;
    }
    if (!(await pathExists(absolute))) {
      warnings.push(`AGENTS.md references missing local path: ${reference}.`);
    }
  }
}

export async function validateRepo({ root, configPath = null, strict = false }) {
  const scan = await scanRepo({ root, configPath });
  const errors = [];
  const warnings = [];

  const agentsPath = path.join(root, "AGENTS.md");
  const repoMapPath = path.join(root, ".agents", "repo-map.json");
  const commandsPath = path.join(root, ".agents", "commands.json");
  const workspacesPath = path.join(root, ".agents", "workspaces.json");

  if (!(await pathExists(agentsPath))) {
    errors.push("AGENTS.md is missing. Run `agent-ready init`.");
  } else {
    const content = await fs.readFile(agentsPath, "utf8");
    if (!content.includes("agent-ready:start")) {
      warnings.push("AGENTS.md has no agent-ready markers, so update cannot preserve generated sections automatically.");
    }
    await addAgentsReferenceWarnings(warnings, root, content);
  }

  for (const warning of scan.config.warnings) {
    warnings.push(warning);
  }

  if (!(await pathExists(repoMapPath))) {
    errors.push(".agents/repo-map.json is missing. Run `agent-ready init` or `agent-ready update`.");
  } else {
    try {
      const repoMap = await readJson(repoMapPath);
      addSchemaWarnings(warnings, ".agents/repo-map.json", validateRepoMapMetadata(repoMap));
    } catch {
      errors.push(".agents/repo-map.json is not valid JSON.");
    }
  }

  if (!(await pathExists(commandsPath))) {
    errors.push(".agents/commands.json is missing. Run `agent-ready init` or `agent-ready update`.");
  } else {
    try {
      const currentCommands = new Set(scan.commands.map(commandKey));
      const previous = await readJson(commandsPath);
      addSchemaWarnings(warnings, ".agents/commands.json", validateCommandsMetadata(previous));
      const previousCommands = new Set((previous.commands ?? []).map(commandKey));
      for (const item of currentCommands) {
        if (!previousCommands.has(item)) {
          warnings.push(`Command metadata is stale or incomplete: ${item}. Run \`agent-ready update\`.`);
        }
      }
    } catch {
      errors.push(".agents/commands.json is not valid JSON.");
    }
  }

  if (await pathExists(workspacesPath)) {
    try {
      const workspaces = await readJson(workspacesPath);
      addSchemaWarnings(warnings, ".agents/workspaces.json", validateWorkspacesMetadata(workspaces));
    } catch {
      errors.push(".agents/workspaces.json is not valid JSON.");
    }
  } else if (scan.monorepo.detected) {
    warnings.push(".agents/workspaces.json is missing for a workspace repo. Run `agent-ready update`.");
  }

  const nodeManagers = scan.packageManagers
    .map((manager) => manager.name)
    .filter((name) => ["pnpm", "yarn", "npm", "bun"].includes(name));
  if (nodeManagers.length > 1) {
    warnings.push(`Multiple Node package managers detected: ${nodeManagers.join(", ")}.`);
  }

  return {
    ok: errors.length === 0 && (!strict || warnings.length === 0),
    strict,
    errors,
    warnings,
    scan
  };
}
