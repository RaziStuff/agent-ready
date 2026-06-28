import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_IGNORE_DIRS,
  SAFE_ENV_EXAMPLE_PATTERNS,
  SECRET_BASENAME_PATTERNS
} from "./constants.js";

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function isSecretLikePath(relPath) {
  const base = path.posix.basename(toPosixPath(relPath));
  if (SAFE_ENV_EXAMPLE_PATTERNS.some((pattern) => pattern.test(base))) {
    return false;
  }
  return SECRET_BASENAME_PATTERNS.some((pattern) => pattern.test(base));
}

export function isSafeEnvExample(relPath) {
  const base = path.posix.basename(toPosixPath(relPath));
  return SAFE_ENV_EXAMPLE_PATTERNS.some((pattern) => pattern.test(base));
}

export async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function readTextFileIfSafe(root, relPath, options = {}) {
  const maxBytes = options.maxReadBytes ?? 128 * 1024;
  if (isSecretLikePath(relPath)) {
    return null;
  }

  const absolute = path.join(root, relPath);
  let stat;
  try {
    stat = await fs.stat(absolute);
  } catch {
    return null;
  }

  if (!stat.isFile() || stat.size > maxBytes) {
    return null;
  }

  try {
    const content = await fs.readFile(absolute, "utf8");
    if (content.includes("\u0000")) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

export async function loadGitignoreRules(root) {
  const gitignorePath = path.join(root, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return [];
  }

  const content = await fs.readFile(gitignorePath, "utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("!"));
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`(^|/)${escaped}($|/)`);
}

export function pathMatchesPattern(relPath, rule) {
  const normalized = toPosixPath(relPath);
  const cleanRule = rule.replace(/^\//, "");

  if (!cleanRule) {
    return false;
  }

  if (cleanRule.endsWith("/**")) {
    const dirRule = cleanRule.slice(0, -3);
    return normalized.startsWith(`${dirRule}/`);
  }

  if (cleanRule.endsWith("/")) {
    const dirRule = cleanRule.slice(0, -1);
    return normalized === dirRule || normalized.startsWith(`${dirRule}/`) || normalized.includes(`/${dirRule}/`);
  }

  if (cleanRule.includes("*")) {
    return globToRegExp(cleanRule).test(normalized);
  }

  if (!cleanRule.includes("/")) {
    return normalized === cleanRule || normalized.startsWith(`${cleanRule}/`) || normalized.endsWith(`/${cleanRule}`) || normalized.includes(`/${cleanRule}/`);
  }

  return normalized === cleanRule || normalized.startsWith(`${cleanRule}/`);
}

export function shouldIgnorePath(relPath, isDirectory, gitignoreRules = []) {
  const normalized = toPosixPath(relPath);
  const base = path.posix.basename(normalized);

  if (isDirectory && DEFAULT_IGNORE_DIRS.has(base)) {
    return true;
  }

  return gitignoreRules.some((rule) => pathMatchesPattern(normalized, rule));
}

export async function walkRepo(root, options = {}) {
  const maxFiles = options.maxFiles ?? 15000;
  const gitignoreRules = await loadGitignoreRules(root);
  const configIgnoreRules = Array.isArray(options.ignore) ? options.ignore : [];
  const ignoreRules = [...gitignoreRules, ...configIgnoreRules];
  const entries = [];
  let limitHit = false;

  async function walk(currentAbs, currentRel) {
    if (entries.length >= maxFiles) {
      limitHit = true;
      return;
    }

    let dirents;
    try {
      dirents = await fs.readdir(currentAbs, { withFileTypes: true });
    } catch {
      return;
    }

    dirents.sort((a, b) => a.name.localeCompare(b.name));

    for (const dirent of dirents) {
      if (entries.length >= maxFiles) {
        limitHit = true;
        return;
      }

      const relPath = currentRel ? `${currentRel}/${dirent.name}` : dirent.name;
      const normalized = toPosixPath(relPath);
      const isDirectory = dirent.isDirectory();

      if (shouldIgnorePath(normalized, isDirectory, ignoreRules)) {
        continue;
      }

      if (dirent.isSymbolicLink()) {
        entries.push({
          path: normalized,
          kind: "symlink",
          contentsRead: false
        });
        continue;
      }

      if (isDirectory) {
        entries.push({
          path: normalized,
          kind: "directory",
          contentsRead: false
        });
        await walk(path.join(currentAbs, dirent.name), normalized);
        continue;
      }

      if (!dirent.isFile()) {
        continue;
      }

      let size = 0;
      try {
        const stat = await fs.stat(path.join(currentAbs, dirent.name));
        size = stat.size;
      } catch {
        size = 0;
      }

      entries.push({
        path: normalized,
        kind: "file",
        size,
        extension: path.extname(dirent.name),
        secretLike: isSecretLikePath(normalized),
        contentsRead: false
      });
    }
  }

  await walk(root, "");
  return {
    entries,
    limitHit,
    gitignoreRuleCount: gitignoreRules.length,
    configIgnoreRuleCount: configIgnoreRules.length
  };
}
