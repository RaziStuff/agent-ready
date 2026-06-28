import { spawn } from "node:child_process";
import { toPosixPath } from "../core/inventory.js";

function runGit(root, args) {
  return new Promise((resolve) => {
    const child = spawn("git", ["-C", root, ...args], {
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
    child.on("error", (error) => {
      resolve({ status: 127, stdout, stderr: error.message });
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}

function dedupePaths(paths) {
  return [...new Set(paths.map((item) => toPosixPath(item)).filter(Boolean))];
}

export function parseGitStatusPorcelainZ(output) {
  const fields = output.split("\0").filter(Boolean);
  const paths = [];

  for (let index = 0; index < fields.length; index += 1) {
    const entry = fields[index];
    if (entry.length < 4) {
      continue;
    }

    const status = entry.slice(0, 2);
    const relPath = entry.slice(3);
    if (relPath) {
      paths.push(relPath);
    }

    if (status.includes("R") || status.includes("C")) {
      index += 1;
    }
  }

  return dedupePaths(paths);
}

export async function listGitChangedPaths(root) {
  const result = await runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || "git status failed";
    throw new Error(`Could not read git changed paths: ${detail}`);
  }
  return parseGitStatusPorcelainZ(result.stdout);
}
