function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value) {
  return typeof value === "string" && value.length > 0;
}

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function addIssue(issues, path, message) {
  issues.push(`${path}: ${message}`);
}

function requireString(issues, data, path, key) {
  if (!isString(data?.[key])) {
    addIssue(issues, `${path}.${key}`, "expected non-empty string");
  }
}

function requireNumber(issues, data, path, key) {
  if (!isNumber(data?.[key])) {
    addIssue(issues, `${path}.${key}`, "expected number");
  }
}

function requireBoolean(issues, data, path, key) {
  if (typeof data?.[key] !== "boolean") {
    addIssue(issues, `${path}.${key}`, "expected boolean");
  }
}

function requireArray(issues, data, path, key) {
  if (!Array.isArray(data?.[key])) {
    addIssue(issues, `${path}.${key}`, "expected array");
  }
}

function validateNamedConfidenceItems(issues, items, path) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      addIssue(issues, itemPath, "expected object");
      return;
    }
    requireString(issues, item, itemPath, "name");
    if ("confidence" in item && (!isNumber(item.confidence) || item.confidence < 0 || item.confidence > 1)) {
      addIssue(issues, `${itemPath}.confidence`, "expected number between 0 and 1");
    }
  });
}

function validatePathRoleItems(issues, items, path) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      addIssue(issues, itemPath, "expected object");
      return;
    }
    requireString(issues, item, itemPath, "path");
    if ("role" in item && typeof item.role !== "string") {
      addIssue(issues, `${itemPath}.role`, "expected string");
    }
    if ("kind" in item && typeof item.kind !== "string") {
      addIssue(issues, `${itemPath}.kind`, "expected string");
    }
  });
}

export function validateCommandsMetadata(data) {
  const issues = [];

  if (!isObject(data)) {
    return ["$: expected object"];
  }

  requireString(issues, data, "$", "schemaVersion");
  requireString(issues, data, "$", "generatedAt");
  requireArray(issues, data, "$", "commands");

  if (Array.isArray(data.commands)) {
    data.commands.forEach((item, index) => {
      const path = `$.commands[${index}]`;
      if (!isObject(item)) {
        addIssue(issues, path, "expected object");
        return;
      }

      requireString(issues, item, path, "name");
      requireString(issues, item, path, "command");
      requireString(issues, item, path, "source");
      requireNumber(issues, item, path, "confidence");
      requireBoolean(issues, item, path, "requiresNetwork");
      requireBoolean(issues, item, path, "writesFiles");
      requireString(issues, item, path, "risk");

      if (isNumber(item.confidence) && (item.confidence < 0 || item.confidence > 1)) {
        addIssue(issues, `${path}.confidence`, "expected number between 0 and 1");
      }

      if (isString(item.risk) && !["low", "medium", "high"].includes(item.risk)) {
        addIssue(issues, `${path}.risk`, "expected one of low, medium, high");
      }
    });
  }

  return issues;
}

function validateCommandLikeItems(issues, items, path) {
  if (!Array.isArray(items)) {
    return;
  }

  items.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isObject(item)) {
      addIssue(issues, itemPath, "expected object");
      return;
    }
    requireString(issues, item, itemPath, "name");
    requireString(issues, item, itemPath, "command");
    if ("source" in item && typeof item.source !== "string") {
      addIssue(issues, `${itemPath}.source`, "expected string");
    }
  });
}

export function validateWorkspacesMetadata(data) {
  const issues = [];

  if (!isObject(data)) {
    return ["$: expected object"];
  }

  requireString(issues, data, "$", "schemaVersion");
  requireString(issues, data, "$", "generatedAt");
  requireString(issues, data, "$", "root");
  requireArray(issues, data, "$", "packages");

  if (!isObject(data.summary)) {
    addIssue(issues, "$.summary", "expected object");
  } else {
    requireString(issues, data.summary, "$.summary", "purpose");
    requireBoolean(issues, data.summary, "$.summary", "monorepo");
    requireArray(issues, data.summary, "$.summary", "packageManagers");
    requireNumber(issues, data.summary, "$.summary", "packageCount");
  }

  if (!isObject(data.monorepo)) {
    addIssue(issues, "$.monorepo", "expected object");
  } else {
    requireBoolean(issues, data.monorepo, "$.monorepo", "detected");
    requireString(issues, data.monorepo, "$.monorepo", "kind");
    requireArray(issues, data.monorepo, "$.monorepo", "tools");
    requireArray(issues, data.monorepo, "$.monorepo", "workspaceGlobs");
    requireNumber(issues, data.monorepo, "$.monorepo", "packageCount");
  }

  if (!isObject(data.commands)) {
    addIssue(issues, "$.commands", "expected object");
  } else {
    requireArray(issues, data.commands, "$.commands", "workspace");
    requireArray(issues, data.commands, "$.commands", "packageScoped");
    validateCommandLikeItems(issues, data.commands.workspace, "$.commands.workspace");
    validateCommandLikeItems(issues, data.commands.packageScoped, "$.commands.packageScoped");
  }

  if (Array.isArray(data.packages)) {
    data.packages.forEach((item, index) => {
      const itemPath = `$.packages[${index}]`;
      if (!isObject(item)) {
        addIssue(issues, itemPath, "expected object");
        return;
      }
      requireString(issues, item, itemPath, "path");
      requireString(issues, item, itemPath, "name");
      requireBoolean(issues, item, itemPath, "private");
      requireArray(issues, item, itemPath, "scripts");
      requireArray(issues, item, itemPath, "commands");
      validateCommandLikeItems(issues, item.commands, `${itemPath}.commands`);
    });
  }

  return issues;
}

export function validateRepoMapMetadata(data) {
  const issues = [];

  if (!isObject(data)) {
    return ["$: expected object"];
  }

  requireString(issues, data, "$", "schemaVersion");
  requireString(issues, data, "$", "generatedAt");
  requireString(issues, data, "$", "root");
  requireArray(issues, data, "$", "languages");
  requireArray(issues, data, "$", "packageManagers");
  requireArray(issues, data, "$", "frameworks");
  requireArray(issues, data, "$", "directories");
  requireArray(issues, data, "$", "entrypoints");
  requireArray(issues, data, "$", "docs");
  requireArray(issues, data, "$", "ci");
  requireArray(issues, data, "$", "generatedHints");

  if (!isObject(data.summary)) {
    addIssue(issues, "$.summary", "expected object");
  } else {
    requireString(issues, data.summary, "$.summary", "purpose");
    requireArray(issues, data.summary, "$.summary", "packageManagers");
    requireArray(issues, data.summary, "$.summary", "frameworks");
    if ("primaryLanguage" in data.summary && data.summary.primaryLanguage !== null && typeof data.summary.primaryLanguage !== "string") {
      addIssue(issues, "$.summary.primaryLanguage", "expected string or null");
    }
  }

  if (!isObject(data.inventory)) {
    addIssue(issues, "$.inventory", "expected object");
  } else {
    requireNumber(issues, data.inventory, "$.inventory", "fileCount");
    requireNumber(issues, data.inventory, "$.inventory", "directoryCount");
    requireNumber(issues, data.inventory, "$.inventory", "symlinkCount");
    requireBoolean(issues, data.inventory, "$.inventory", "limitHit");
  }

  validateNamedConfidenceItems(issues, data.languages, "$.languages");
  validateNamedConfidenceItems(issues, data.packageManagers, "$.packageManagers");
  validateNamedConfidenceItems(issues, data.frameworks, "$.frameworks");
  validatePathRoleItems(issues, data.directories, "$.directories");
  validatePathRoleItems(issues, data.entrypoints, "$.entrypoints");
  validatePathRoleItems(issues, data.docs, "$.docs");

  if (Array.isArray(data.generatedHints)) {
    data.generatedHints.forEach((item, index) => {
      if (typeof item !== "string") {
        addIssue(issues, `$.generatedHints[${index}]`, "expected string");
      }
    });
  }

  return issues;
}
