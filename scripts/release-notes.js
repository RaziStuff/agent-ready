#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathExists } from "../src/core/inventory.js";

const OUTPUT_FILE = "RELEASE_NOTES.md";
const CLI_COMMANDS = [
  ["scan", "print detected repo facts"],
  ["init", "create AGENTS.md and .agents metadata"],
  ["update", "refresh generated sections while preserving human edits"],
  ["context", "print a compact agent onboarding packet"],
  ["doctor", "diagnose whether a repo is ready for coding agents"],
  ["status", "print a compact dashboard for readiness, current changes, validation, recipes, and CI adoption"],
  ["workspaces", "print workspace package summaries and package-scoped commands"],
  ["affected [path...]", "print workspace packages affected by planned or current git-changed paths"],
  ["impact <path...>", "explain risk, affected workspace packages, and validation guidance for planned changed paths"],
  ["impact --changed", "explain risk, affected workspace packages, and validation guidance for current git changed paths"],
  ["handoff [path...]", "print a handoff packet with changed paths, risks, and validation guidance"],
  ["handoff --changed", "print a handoff packet for current git changed paths"],
  ["preflight [path...]", "check readiness, changed-path impact, affected workspaces, validation, and handoff guidance"],
  ["preflight", "preflight current git changed paths by default"],
  ["run <command-name>", "execute a discovered command by name and print a structured receipt"],
  ["recipes", "print built-in adoption recipes for agents"],
  ["recipes --json", "print built-in adoption recipes as structured JSON"],
  ["schemas", "print published JSON Schema contracts for metadata and runtime reports"],
  ["schemas --json", "print the JSON Schema catalog as structured JSON"],
  ["schemas <schema-id> --json", "print one raw JSON Schema document"],
  ["verify-contract <report-file> --schema <schema-id>", "validate a saved JSON file against a published agent-ready schema"],
  ["ci-status", "summarize status and contract receipt artifacts from an agent-ready CI run"],
  ["add-to-ci", "preview or write a GitHub Actions workflow for agent-ready validation"],
  ["validate", "check that agent docs and metadata exist and are current"],
  ["validate --strict", "fail on warnings as well as errors"],
  ["explain", "show evidence behind scanner decisions"],
  ["config init", "create a starter agent-ready.config.json"],
  ["mcp", "start a read-only stdio MCP server for agent docs and metadata"]
];

const KNOWN_LIMITATIONS = [
  "No LLM-assisted summarization yet; deterministic scanning is the default.",
  "MCP support is read-only and scoped to local repository context; templates expose only discovered docs, commands, workspaces, risk paths, and package-level schemas.",
  "No Homebrew, Docker, or standalone binary distribution yet.",
  "Language and framework detection is intentionally conservative and fixture-driven."
];

function normalize(value) {
  return `${value.trimEnd()}\n`;
}

async function readJson(relPath) {
  return JSON.parse(await fs.readFile(path.join(process.cwd(), relPath), "utf8"));
}

async function readFirstParagraph(readmePath) {
  const content = await fs.readFile(readmePath, "utf8");
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"));
  return lines[0] ?? "No description available.";
}

async function listExampleSummaries() {
  const examplesRoot = path.join(process.cwd(), "examples");
  if (!(await pathExists(examplesRoot))) {
    return [];
  }

  const dirents = await fs.readdir(examplesRoot, { withFileTypes: true });
  const examples = [];
  for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const readmePath = path.join(examplesRoot, dirent.name, "README.md");
    const description = (await pathExists(readmePath))
      ? await readFirstParagraph(readmePath)
      : "No description available.";
    examples.push({ name: dirent.name, description });
  }
  return examples;
}

async function listSchemas() {
  const schemasRoot = path.join(process.cwd(), "schemas");
  if (!(await pathExists(schemasRoot))) {
    return [];
  }

  const files = (await fs.readdir(schemasRoot))
    .filter((file) => file.endsWith(".schema.json"))
    .sort();

  const schemas = [];
  for (const file of files) {
    const schema = await readJson(path.join("schemas", file));
    schemas.push({ file: path.join("schemas", file), title: schema.title ?? file });
  }
  return schemas;
}

function verificationLines(packageJson) {
  const scripts = packageJson.scripts ?? {};
  const preferred = [
    ["ci", "full local release gate"],
    ["test", "unit and snapshot tests"],
    ["snapshots:check", "generated AGENTS.md and metadata snapshot drift check"],
    ["validate:strict", "strict generated metadata validation"],
    ["doctor:strict", "strict agent readiness diagnostics"],
    ["mcp:compat", "MCP schema discovery, status, workspaces, affected packages, context, doctor, explicit-path and git-changed impact, handoff, preflight, stdio compatibility, and multi-repo isolation smoke check"],
    ["package:check", "package manifest, bin, schema, and temp-repo smoke check with status, workspaces, affected packages, impact, handoff, preflight, run, recipes, schemas, contract verification, CI status summaries, and CI workflow coverage"],
    ["package:install-smoke", "local tarball install and installed-bin smoke check with status, workspaces, affected packages, impact, handoff, preflight, run, recipes, schemas, contract verification, CI status summaries, and CI workflow coverage"]
  ];

  return preferred
    .filter(([name]) => scripts[name])
    .map(([name, description]) => `- \`npm run ${name}\`: ${description}.`);
}

function packageSurfaceLines(packageJson) {
  const bin = packageJson.bin?.["agent-ready"] ?? "not configured";
  const files = Array.isArray(packageJson.files) ? packageJson.files : [];
  return [
    `- Package name: \`${packageJson.name}\`.`,
    `- CLI bin: \`agent-ready\` -> \`${bin}\`.`,
    `- Node engine: \`${packageJson.engines?.node ?? "not specified"}\`.`,
    `- Repository: \`${packageJson.repository?.url ?? "not specified"}\`.`,
    `- Homepage: \`${packageJson.homepage ?? "not specified"}\`.`,
    `- Publish access: \`${packageJson.publishConfig?.access ?? "not specified"}\`.`,
    `- Published file allowlist: ${files.map((item) => `\`${item}\``).join(", ")}.`
  ];
}

export async function generateReleaseNotes() {
  const packageJson = await readJson("package.json");
  const examples = await listExampleSummaries();
  const schemas = await listSchemas();
  const verification = verificationLines(packageJson);
  const packageSurface = packageSurfaceLines(packageJson);

  const lines = [
    `# ${packageJson.name} v${packageJson.version}`,
    "",
    packageJson.description,
    "",
    "## Highlights",
    "",
    "- Generates `AGENTS.md` as the canonical repo operating guide for AI coding agents.",
    "- Writes structured `.agents` metadata for repo maps, commands, risk policy, and handoffs.",
    "- Prints compact onboarding packets with `agent-ready context` for agents that need one high-signal starting brief.",
    "- Diagnoses agent readiness with `agent-ready doctor`, including generated docs, commands, CI, safety, and MCP setup.",
    "- Prints compact status dashboards with `agent-ready status`, combining readiness, current git changes, preflight summary, validation receipts, recipes, and CI adoption hints.",
    "- Prints first-class workspace package summaries with `agent-ready workspaces`, including root workspace commands and package-scoped command suggestions.",
    "- Prints direct affected package lookups with `agent-ready affected` and `agent-ready workspaces --changed`.",
    "- Explains planned-path and current-worktree risk guidance with `agent-ready impact <path...>` and `agent-ready impact --changed`, including affected workspace package mapping.",
    "- Produces paste-ready transfer notes with `agent-ready handoff` and `agent-ready handoff --changed`.",
    "- Runs one-shot handoff readiness checks with `agent-ready preflight`, combining doctor status, impact guidance, affected workspace packages, validation recommendations, and transfer guidance.",
    "- Records structured validation receipts with `agent-ready run <command-name>` for commands discovered or configured in the repo.",
    "- Prints built-in adoption recipes with `agent-ready recipes` and `agent-ready recipes --json`.",
    "- Prints JSON Schema contracts with `agent-ready schemas`, `agent-ready schemas --json`, and `agent-ready schemas <schema-id> --json`.",
    "- Validates saved JSON reports with `agent-ready verify-contract <report-file> --schema <schema-id>`.",
    "- Summarizes downloaded CI receipt artifacts with `agent-ready ci-status`.",
    "- Generates GitHub Actions validation workflows with `agent-ready add-to-ci`, including safe preview, explicit write mode, and receipt artifacts for status plus contract verification.",
    "- Exposes `AGENTS.md`, `.agents` metadata, workspace catalogs, schema contracts, status dashboards, context packets, doctor readiness, explicit-path and git-changed impact guidance, handoff packets, preflight guidance, resource templates, prompts, summaries, and validation through a read-only stdio MCP server.",
    "- Exposes built-in adoption recipes through `agent-ready://recipes` and `agent-ready://recipes-json` MCP resources.",
    "- Exposes JSON Schema contracts through `agent-ready://schemas` and `agent-ready://schema/{id}` MCP resources.",
    "- Includes MCP client recipes for installed-package, source-checkout, multi-repo, and command/args host setups.",
    "- Includes a maintainer adoption playbook from first scan through CI receipt summaries.",
    "- Includes copy-paste and machine-readable adoption recipes for Codex, Claude, Cursor, MCP-capable hosts, and terminal agents.",
    "- Provides deterministic scanners for common repo facts without requiring network access or an API key.",
    "- Detects npm, pnpm, and Yarn workspaces, plus Turborepo and Nx monorepo signals.",
    "- Detects Makefile, justfile, Taskfile, and common CI provider commands.",
    "- Covers Rails, Django, Spring Boot, and ASP.NET Core fixture repos with snapshots.",
    "- Snapshot-tests `AGENTS.md`, `repo-map.json`, and `commands.json` for every fixture.",
    "- Warns when `AGENTS.md` references stale local files, with strict mode support for CI.",
    "- Supports strict validation, metadata and runtime report schemas, fixture snapshots, MCP compatibility checks, package smoke checks, and a GitHub Action.",
    "",
    "## CLI Surface",
    ""
  ];

  for (const [command, description] of CLI_COMMANDS) {
    lines.push(`- \`agent-ready ${command}\`: ${description}.`);
  }

  lines.push("");
  lines.push("## Example Coverage");
  lines.push("");
  for (const example of examples) {
    lines.push(`- \`${example.name}\`: ${example.description}`);
  }

  lines.push("");
  lines.push("## JSON Schemas");
  lines.push("");
  for (const schema of schemas) {
    lines.push(`- \`${schema.file}\`: ${schema.title}.`);
  }

  lines.push("");
  lines.push("## Package Surface");
  lines.push("");
  lines.push(...packageSurface);

  lines.push("");
  lines.push("## Verification");
  lines.push("");
  lines.push(...verification);
  lines.push("- `pnpm pack --dry-run`: inspect the publish tarball contents before release.");

  lines.push("");
  lines.push("## Known Limitations");
  lines.push("");
  for (const limitation of KNOWN_LIMITATIONS) {
    lines.push(`- ${limitation}`);
  }

  lines.push("");
  lines.push("## Publish Checklist");
  lines.push("");
  lines.push("- Run `npm run ci`.");
  lines.push("- Run `pnpm pack --dry-run` or `npm pack --dry-run` and review the tarball contents.");
  lines.push("- Confirm `agent-ready --version` matches `package.json`.");
  lines.push("- Publish only from a clean working tree.");
  lines.push("- Tag the release after the registry accepts it.");
  lines.push("");
  lines.push("_Generated by `npm run release:notes:write`._");

  return normalize(lines.join("\n"));
}

async function main() {
  const args = process.argv.slice(2);
  const outputPath = path.join(process.cwd(), OUTPUT_FILE);
  const generated = await generateReleaseNotes();

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`agent-ready release notes helper

Usage:
  node scripts/release-notes.js
  node scripts/release-notes.js --write
  node scripts/release-notes.js --check
`);
    return;
  }

  if (args.includes("--write")) {
    await fs.writeFile(outputPath, generated, "utf8");
    console.log(`Wrote ${outputPath}`);
    return;
  }

  if (args.includes("--check")) {
    if (!(await pathExists(outputPath))) {
      console.error(`${OUTPUT_FILE} is missing. Run \`npm run release:notes:write\`.`);
      process.exitCode = 1;
      return;
    }
    const current = normalize(await fs.readFile(outputPath, "utf8"));
    if (current !== generated) {
      console.error(`${OUTPUT_FILE} is stale. Run \`npm run release:notes:write\`.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${OUTPUT_FILE} is current.`);
    return;
  }

  process.stdout.write(generated);
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
