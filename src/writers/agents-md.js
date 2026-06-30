import fs from "node:fs/promises";
import path from "node:path";
import { pathExists } from "../core/inventory.js";

const MARKERS = [
  "purpose",
  "repo-map",
  "setup",
  "commands",
  "validation",
  "conventions",
  "risks",
  "environment",
  "metadata"
];

function markerStart(name) {
  return `<!-- agent-ready:start ${name} -->`;
}

function markerEnd(name) {
  return `<!-- agent-ready:end ${name} -->`;
}

function marked(name, lines) {
  const content = Array.isArray(lines) ? lines.join("\n") : lines;
  return `${markerStart(name)}\n${content || "_No high-confidence data detected yet._"}\n${markerEnd(name)}`;
}

function bullet(value) {
  return `- ${value}`;
}

function inlineCode(value) {
  return `\`${value}\``;
}

function formatConfidence(item) {
  if (typeof item.confidence !== "number") {
    return "";
  }
  if (item.confidence >= 0.9) {
    return "";
  }
  return " (likely)";
}

function setupLines(scan) {
  const lines = [];
  for (const manager of scan.packageManagers) {
    lines.push(bullet(`Package manager${formatConfidence(manager)}: ${manager.name}.`));
  }

  if (scan.monorepo?.detected) {
    const tools = scan.monorepo.tools.map((tool) => tool.name).join(", ") || "workspace layout";
    lines.push(bullet(`Monorepo/workspace detected: ${tools}.`));
    if (scan.monorepo.workspaceGlobs.length > 0) {
      lines.push(bullet(`Workspace globs: ${scan.monorepo.workspaceGlobs.map((item) => inlineCode(item.pattern)).join(", ")}.`));
    }
  }

  const install = scan.commands.find((item) => item.name === "install");
  if (install) {
    lines.push(bullet(`Install dependencies with ${inlineCode(install.command)}.`));
  }

  if (scan.packageManagers.length > 1) {
    lines.push(bullet("Multiple package manager signals were detected; confirm the intended install path before changing dependencies."));
  }

  return lines;
}

function commandLines(scan) {
  return scan.commands.map((item) => {
    const label = item.name.charAt(0).toUpperCase() + item.name.slice(1);
    return bullet(`${label}: ${inlineCode(item.command)}.`);
  });
}

function validationLines(scan) {
  const lines = [];
  const test = scan.commands.find((item) => item.name === "test" || item.name === "unit tests" || item.name === "workspace test");
  const lint = scan.commands.find((item) => item.name === "lint" || item.name === "workspace lint");
  const typecheck = scan.commands.find((item) => item.name === "typecheck" || item.name === "workspace typecheck");
  const build = scan.commands.find((item) => item.name === "build" || item.name === "workspace build");

  if (test) lines.push(bullet(`Tests: ${inlineCode(test.command)}.`));
  if (lint) lines.push(bullet(`Lint: ${inlineCode(lint.command)}.`));
  if (typecheck) lines.push(bullet(`Typecheck: ${inlineCode(typecheck.command)}.`));
  if (build) lines.push(bullet(`Build: ${inlineCode(build.command)}.`));

  if (lines.length > 0) {
    lines.push("");
    lines.push("Before handing off, run the smallest validation command that covers your change and report what passed or failed.");
  }

  return lines;
}

function repoMapLines(scan) {
  const lines = [];

  for (const directory of scan.directories.slice(0, 20)) {
    lines.push(bullet(`${inlineCode(directory.path + "/")}: ${directory.role}.`));
  }

  for (const entrypoint of scan.entrypoints.slice(0, 10)) {
    lines.push(bullet(`${inlineCode(entrypoint.path)}: ${entrypoint.kind}.`));
  }

  if (scan.monorepo?.detected && scan.monorepo.packages.length > 0) {
    for (const workspacePackage of scan.monorepo.packages.slice(0, 12)) {
      const scriptSummary = workspacePackage.scripts.length > 0
        ? ` scripts: ${workspacePackage.scripts.slice(0, 6).map((script) => inlineCode(script)).join(", ")}`
        : " no common scripts detected";
      lines.push(bullet(`${inlineCode(workspacePackage.path + "/")}: workspace package ${inlineCode(workspacePackage.name)};${scriptSummary}.`));
    }
    if (scan.monorepo.packages.length > 12) {
      lines.push(bullet(`...and ${scan.monorepo.packages.length - 12} more workspace package${scan.monorepo.packages.length - 12 === 1 ? "" : "s"}.`));
    }
  }

  return lines;
}

function conventionLines(scan) {
  const lines = [];
  if (scan.summary.primaryLanguage) {
    lines.push(bullet(`Primary language appears to be ${scan.summary.primaryLanguage}.`));
  }
  if (scan.frameworks.length > 0) {
    lines.push(bullet(`Detected frameworks: ${scan.frameworks.map((item) => item.name).join(", ")}.`));
  }
  if (scan.monorepo?.detected) {
    lines.push(bullet("For workspace changes, identify the package owner first and prefer package-local commands unless a root orchestration command is already configured."));
  }
  for (const guidance of scan.guidance ?? []) {
    lines.push(bullet(guidance.message));
  }
  if (scan.docs.length > 0) {
    lines.push(bullet(`Read local docs before large changes: ${scan.docs.map((doc) => inlineCode(doc.path)).join(", ")}.`));
  }
  for (const convention of scan.configuredConventions ?? []) {
    lines.push(bullet(convention));
  }
  lines.push(bullet("Follow nearby code style and existing helper APIs before introducing new abstractions."));
  lines.push(bullet("Keep generated outputs and lockfiles scoped to dependency or generator changes."));
  return lines;
}

function compactRisks(risks) {
  const sorted = [...risks].sort((a, b) => a.path.length - b.path.length || a.path.localeCompare(b.path));
  const compacted = [];

  for (const risk of sorted) {
    const covered = compacted.some((existing) => {
      return existing.category === risk.category && (risk.path === existing.path || risk.path.startsWith(`${existing.path}/`));
    });
    if (!covered) {
      compacted.push(risk);
    }
  }

  return compacted.sort((a, b) => a.path.localeCompare(b.path));
}

function riskLines(scan) {
  return compactRisks(scan.risks).slice(0, 30).map((risk) => {
    return bullet(`${inlineCode(risk.path)}: ${risk.reason}.`);
  });
}

function environmentLines(scan) {
  const lines = [];
  if (scan.environment.examples.length > 0) {
    lines.push(bullet(`Environment examples: ${scan.environment.examples.map((file) => inlineCode(file)).join(", ")}.`));
  }
  if (scan.environment.secretLikeFiles.length > 0) {
    lines.push(bullet(`Secret-like files exist and should not be read or committed: ${scan.environment.secretLikeFiles.map((file) => inlineCode(file)).join(", ")}.`));
  } else {
    lines.push(bullet("No secret-like env files were detected by path."));
  }
  return lines;
}

function metadataLines(scan) {
  const lines = [
    bullet(`Generated at: ${scan.generatedAt}.`),
    bullet("Structured repo map: `.agents/repo-map.json`."),
    bullet("Command catalog: `.agents/commands.json`."),
    bullet("Workspace catalog: `.agents/workspaces.json`."),
    bullet("Risk policy: `.agents/risk-policy.md`."),
    bullet("Handoff template: `.agents/handoff-template.md`.")
  ];

  if (scan.inventory.limitHit) {
    lines.push(bullet("The scanner hit its file limit; rerun with a higher limit if needed."));
  }

  return lines;
}

export function generateAgentsMd(scan) {
  return `# AGENTS.md

## Purpose

${marked("purpose", scan.summary.purpose)}

## Repo Map

${marked("repo-map", repoMapLines(scan))}

## Setup

${marked("setup", setupLines(scan))}

## Common Commands

${marked("commands", commandLines(scan))}

## Validation

${marked("validation", validationLines(scan))}

## Conventions

${marked("conventions", conventionLines(scan))}

## Risky Areas

${marked("risks", riskLines(scan))}

## Environment

${marked("environment", environmentLines(scan))}

## Agent Workflow

1. Read this file before editing.
2. Inspect nearby code and tests before changing behavior.
3. Prefer the smallest relevant validation command while iterating.
4. Do not read secret-like files unless the user explicitly provides them.
5. Summarize changed files, validation, and remaining risks in the final handoff.

## Generated Metadata

${marked("metadata", metadataLines(scan))}
`;
}

function extractMarkedBlock(content, name) {
  const pattern = new RegExp(`${markerStart(name)}[\\s\\S]*?${markerEnd(name)}`);
  const match = content.match(pattern);
  return match?.[0] ?? null;
}

export function updateMarkedSections(existingContent, generatedContent) {
  let updated = existingContent;
  let replacements = 0;

  for (const marker of MARKERS) {
    const nextBlock = extractMarkedBlock(generatedContent, marker);
    if (!nextBlock) {
      continue;
    }

    const previousBlock = extractMarkedBlock(updated, marker);
    if (!previousBlock) {
      continue;
    }

    updated = updated.replace(previousBlock, nextBlock);
    replacements += 1;
  }

  return {
    content: updated,
    replacements
  };
}

export async function writeAgentsMd({ root, scan, force = false, dryRun = false, updateOnly = false }) {
  const agentsPath = path.join(root, "AGENTS.md");
  const generated = generateAgentsMd(scan);
  const exists = await pathExists(agentsPath);

  if (dryRun) {
    return {
      path: agentsPath,
      content: generated,
      wrote: false,
      message: "Dry run; no AGENTS.md written."
    };
  }

  if (!exists || force) {
    await fs.writeFile(agentsPath, generated, "utf8");
    return {
      path: agentsPath,
      wrote: true,
      message: exists && force ? "Replaced AGENTS.md." : "Created AGENTS.md."
    };
  }

  const existing = await fs.readFile(agentsPath, "utf8");
  const updated = updateMarkedSections(existing, generated);
  if (updated.replacements === 0) {
    if (updateOnly) {
      throw new Error("AGENTS.md exists but no agent-ready markers were found. Use --force to replace it.");
    }
    throw new Error("AGENTS.md already exists. Use update to refresh markers or --force to replace it.");
  }

  await fs.writeFile(agentsPath, updated.content, "utf8");
  return {
    path: agentsPath,
    wrote: true,
    message: `Updated ${updated.replacements} generated AGENTS.md section${updated.replacements === 1 ? "" : "s"}.`
  };
}
