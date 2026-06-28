import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "./inventory.js";

export const DEFAULT_CONFIG_FILE = "agent-ready.config.json";

export function starterConfig() {
  return {
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
  };
}

export function formatConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function stringArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function stringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof key !== "string" || !key.trim()) {
      continue;
    }
    if (typeof item === "string" && item.trim()) {
      result[key.trim()] = item.trim();
      continue;
    }
    if (item && typeof item === "object" && typeof item.command === "string" && item.command.trim()) {
      result[key.trim()] = {
        command: item.command.trim(),
        requiresNetwork: typeof item.requiresNetwork === "boolean" ? item.requiresNetwork : undefined,
        writesFiles: typeof item.writesFiles === "boolean" ? item.writesFiles : undefined,
        risk: typeof item.risk === "string" ? item.risk : undefined
      };
    }
  }
  return result;
}

function sectionConfig(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const sections = {};
  if (typeof value.purpose === "string" && value.purpose.trim()) {
    sections.purpose = value.purpose.trim();
  }
  if (Array.isArray(value.conventions)) {
    sections.conventions = value.conventions
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim());
  }
  return sections;
}

function normalizeConfig(raw = {}) {
  const profiles = stringArray(raw.profiles ?? raw.profile);
  return {
    schemaVersion: typeof raw.schemaVersion === "string" ? raw.schemaVersion : "0.1.0",
    ignore: stringArray(raw.ignore),
    riskPaths: stringArray(raw.riskPaths),
    generatedPaths: stringArray(raw.generatedPaths),
    profiles,
    commands: stringMap(raw.commands),
    sections: sectionConfig(raw.sections),
    directoryRoles: stringMap(raw.directoryRoles)
  };
}

export async function writeStarterConfig({ root, configPath, force = false, dryRun = false }) {
  const resolvedPath = configPath
    ? path.resolve(root, configPath)
    : path.join(root, DEFAULT_CONFIG_FILE);
  const content = formatConfig(starterConfig());

  if (dryRun) {
    return {
      path: resolvedPath,
      content,
      written: false,
      message: `Would write ${path.relative(root, resolvedPath) || DEFAULT_CONFIG_FILE}.`
    };
  }

  if (!force && await pathExists(resolvedPath)) {
    throw new Error(`${path.relative(root, resolvedPath) || DEFAULT_CONFIG_FILE} already exists. Use --force to replace it.`);
  }

  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, content, "utf8");

  return {
    path: resolvedPath,
    content,
    written: true,
    message: `Wrote ${path.relative(root, resolvedPath) || DEFAULT_CONFIG_FILE}.`
  };
}

export async function loadAgentReadyConfig(root, configPath) {
  const resolvedPath = configPath
    ? path.resolve(root, configPath)
    : path.join(root, DEFAULT_CONFIG_FILE);

  if (!(await pathExists(resolvedPath))) {
    return {
      path: resolvedPath,
      loaded: false,
      config: normalizeConfig(),
      warnings: []
    };
  }

  try {
    const raw = JSON.parse(await fs.readFile(resolvedPath, "utf8"));
    return {
      path: resolvedPath,
      loaded: true,
      config: normalizeConfig(raw),
      warnings: []
    };
  } catch (error) {
    return {
      path: resolvedPath,
      loaded: false,
      config: normalizeConfig(),
      warnings: [`Could not read ${path.basename(resolvedPath)}: ${error.message}`]
    };
  }
}
