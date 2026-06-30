import fs from "node:fs/promises";
import path from "node:path";
import { scanRepo } from "../src/core/scanner.js";
import { generateAgentsMd } from "../src/writers/agents-md.js";
import { commandCatalog, repoMap } from "../src/writers/metadata.js";

export const FIXED_TIMESTAMP = "2026-01-01T00:00:00.000Z";

export const SNAPSHOT_CASES = [
  "node-next-pnpm",
  "python-fastapi-uv",
  "go-service",
  "rust-cli",
  "rails-api",
  "ruby-gem-rspec",
  "ruby-gem-minitest",
  "laravel-app",
  "symfony-app",
  "php-pest-package",
  "php-composer-library",
  "php-composer-plugin",
  "django-service",
  "spring-boot-api",
  "dotnet-web-api"
];

export function normalizeSnapshot(value) {
  return `${value.trimEnd()}\n`;
}

export function snapshotPath(fixtureName, cwd = process.cwd()) {
  return path.join(cwd, "tests", "snapshots", `${fixtureName}.agents.md`);
}

export function repoMapSnapshotPath(fixtureName, cwd = process.cwd()) {
  return path.join(cwd, "tests", "snapshots", `${fixtureName}.repo-map.json`);
}

export function commandsSnapshotPath(fixtureName, cwd = process.cwd()) {
  return path.join(cwd, "tests", "snapshots", `${fixtureName}.commands.json`);
}

function normalizeJsonSnapshot(value) {
  return normalizeSnapshot(JSON.stringify(value, null, 2));
}

function normalizeScanForSnapshot(scan, root) {
  const normalized = JSON.parse(JSON.stringify(scan));
  normalized.generatedAt = FIXED_TIMESTAMP;
  normalized.root = ".";
  if (normalized.config?.path) {
    const relativeConfigPath = path.relative(root, normalized.config.path);
    normalized.config.path = relativeConfigPath.startsWith("..")
      ? path.basename(normalized.config.path)
      : relativeConfigPath;
  }
  return normalized;
}

async function scanFixture(fixtureName, cwd = process.cwd()) {
  const root = path.join(cwd, "examples", fixtureName);
  const scan = await scanRepo({ root });
  return normalizeScanForSnapshot(scan, root);
}

export async function renderAgentsMdSnapshot(fixtureName, cwd = process.cwd()) {
  const scan = await scanFixture(fixtureName, cwd);
  return normalizeSnapshot(generateAgentsMd(scan));
}

export async function renderRepoMapSnapshot(fixtureName, cwd = process.cwd()) {
  const scan = await scanFixture(fixtureName, cwd);
  return normalizeJsonSnapshot(repoMap(scan));
}

export async function renderCommandsSnapshot(fixtureName, cwd = process.cwd()) {
  const scan = await scanFixture(fixtureName, cwd);
  return normalizeJsonSnapshot(commandCatalog(scan));
}

export async function readSnapshot(fixtureName, cwd = process.cwd()) {
  return normalizeSnapshot(await fs.readFile(snapshotPath(fixtureName, cwd), "utf8"));
}

export async function readRepoMapSnapshot(fixtureName, cwd = process.cwd()) {
  return normalizeSnapshot(await fs.readFile(repoMapSnapshotPath(fixtureName, cwd), "utf8"));
}

export async function readCommandsSnapshot(fixtureName, cwd = process.cwd()) {
  return normalizeSnapshot(await fs.readFile(commandsSnapshotPath(fixtureName, cwd), "utf8"));
}

export async function writeSnapshot(fixtureName, cwd = process.cwd()) {
  const outputPath = snapshotPath(fixtureName, cwd);
  const content = await renderAgentsMdSnapshot(fixtureName, cwd);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
  return outputPath;
}

export async function writeRepoMapSnapshot(fixtureName, cwd = process.cwd()) {
  const outputPath = repoMapSnapshotPath(fixtureName, cwd);
  const content = await renderRepoMapSnapshot(fixtureName, cwd);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
  return outputPath;
}

export async function writeCommandsSnapshot(fixtureName, cwd = process.cwd()) {
  const outputPath = commandsSnapshotPath(fixtureName, cwd);
  const content = await renderCommandsSnapshot(fixtureName, cwd);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
  return outputPath;
}
