import path from "node:path";
import { scanRepo } from "../core/scanner.js";
import { toPosixPath } from "../core/inventory.js";
import { listGitChangedPaths } from "../impact/git-changes.js";
import { workspaceCatalog } from "../writers/metadata.js";

const PACKAGE_VALIDATION_ORDER = ["test", "lint", "typecheck", "build"];

function nextSteps(report) {
  const steps = [];

  if (!report.monorepo.detected) {
    steps.push("No workspace layout was detected; use `agent-ready context` for the single-package repo loop.");
    return steps;
  }

  if (report.packages.length === 0) {
    steps.push("Workspace tooling was detected, but no package manifests matched the workspace globs.");
  } else {
    steps.push("Pick the package whose path matches the files you plan to edit before choosing validation.");
  }

  if (report.commands.workspace.length > 0) {
    steps.push(`Use \`${report.commands.workspace[0].command}\` when the change may affect multiple packages.`);
  }

  const firstPackageCommand = report.packages.flatMap((workspacePackage) => workspacePackage.commands)[0];
  if (firstPackageCommand) {
    steps.push(`Use package-scoped commands such as \`${firstPackageCommand.command}\` while iterating on local changes.`);
  }

  steps.push("Run `agent-ready preflight <path...>` before handoff to combine workspace context with risk and validation guidance.");
  return steps;
}

export async function buildWorkspacesReport({ root, configPath = null }) {
  const scan = await scanRepo({ root, configPath });
  const catalog = workspaceCatalog(scan);
  const report = {
    ...catalog,
    ok: true,
    status: scan.monorepo.detected ? "workspace" : "single-package"
  };

  return {
    ...report,
    nextSteps: nextSteps(report)
  };
}

function normalizeAffectedPath(root, value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return null;
  }

  const absolute = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(root, raw);
  const relative = path.relative(root, absolute);
  if (relative === "") {
    return {
      input: raw,
      path: ".",
      outsideRoot: false
    };
  }
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return {
      input: raw,
      path: toPosixPath(raw.replace(/^\/+/, "")),
      outsideRoot: true
    };
  }

  return {
    input: raw,
    path: toPosixPath(relative),
    outsideRoot: false
  };
}

function packageContainsPath(workspacePackage, relPath) {
  if (relPath === ".") {
    return true;
  }
  return relPath === workspacePackage.path
    || relPath.startsWith(`${workspacePackage.path}/`)
    || workspacePackage.path.startsWith(`${relPath}/`);
}

function affectedStatus({ ok, monorepoDetected, affectedPackages }) {
  if (!ok) {
    return "blocked";
  }
  if (!monorepoDetected) {
    return "single-package";
  }
  return affectedPackages.length > 0 ? "affected" : "unaffected";
}

function packageRecommendations(affectedPackages) {
  const commands = [];
  for (const workspacePackage of affectedPackages) {
    for (const commandName of PACKAGE_VALIDATION_ORDER) {
      const command = workspacePackage.commands.find((item) => item.name === commandName);
      if (!command) {
        continue;
      }
      commands.push({
        packagePath: workspacePackage.path,
        packageName: workspacePackage.name,
        name: `${workspacePackage.name} ${command.name}`,
        command: command.command,
        reason: `Affected package ${workspacePackage.name}.`
      });
    }
  }
  return commands;
}

function affectedNextSteps(report) {
  const steps = [];

  if (report.status === "blocked") {
    steps.push("Remove paths outside the repository root before using affected workspace guidance.");
    return steps;
  }
  if (report.status === "single-package") {
    steps.push("No workspace layout was detected; use `agent-ready impact <path...>` or `agent-ready status` for this repo.");
    return steps;
  }
  if (report.paths.length === 0) {
    steps.push("No paths were found; confirm there are no current git changes or provide planned paths explicitly.");
    return steps;
  }
  if (report.affectedPackages.length === 0) {
    steps.push("No workspace packages matched these paths; use root-level validation or `agent-ready impact <path...>`.");
    return steps;
  }

  steps.push("Use package-scoped commands while iterating on affected packages.");
  steps.push("Run `agent-ready preflight <path...>` before handoff when risk and validation guidance are needed together.");
  return steps;
}

export async function buildAffectedWorkspacesReport({ root, configPath = null, paths = [], changed = false }) {
  const useGitChanged = changed || paths.length === 0;
  const rawPaths = useGitChanged ? await listGitChangedPaths(root) : paths;
  const normalized = [...new Set(rawPaths
    .map((item) => normalizeAffectedPath(root, item))
    .filter(Boolean)
    .map((item) => JSON.stringify(item)))]
    .map((item) => JSON.parse(item));
  const scan = await scanRepo({ root, configPath });
  const catalog = workspaceCatalog(scan);
  const changedPathsByPackage = new Map();
  const unmatchedPaths = [];

  for (const item of normalized) {
    if (item.outsideRoot) {
      unmatchedPaths.push({
        path: item.path,
        reason: "Path resolves outside the repository root.",
        outsideRoot: true
      });
      continue;
    }

    const matches = catalog.packages.filter((workspacePackage) => packageContainsPath(workspacePackage, item.path));
    if (matches.length === 0) {
      unmatchedPaths.push({
        path: item.path,
        reason: catalog.monorepo.detected
          ? "No workspace package matched this path."
          : "No workspace layout was detected.",
        outsideRoot: false
      });
      continue;
    }

    for (const workspacePackage of matches) {
      const changedPaths = changedPathsByPackage.get(workspacePackage.path) ?? [];
      changedPaths.push(item.path);
      changedPathsByPackage.set(workspacePackage.path, changedPaths);
    }
  }

  const affectedPackages = catalog.packages
    .filter((workspacePackage) => changedPathsByPackage.has(workspacePackage.path))
    .map((workspacePackage) => ({
      path: workspacePackage.path,
      name: workspacePackage.name,
      private: workspacePackage.private,
      scripts: workspacePackage.scripts,
      commands: workspacePackage.commands,
      changedPaths: [...new Set(changedPathsByPackage.get(workspacePackage.path) ?? [])]
    }));
  const ok = unmatchedPaths.every((item) => item.outsideRoot === false);
  const baseReport = {
    schemaVersion: scan.schemaVersion,
    generatedAt: scan.generatedAt,
    root,
    ok,
    pathSource: useGitChanged ? "git_changed" : "provided",
    paths: normalized.filter((item) => !item.outsideRoot).map((item) => item.path),
    monorepo: catalog.monorepo,
    affectedPackages,
    unmatchedPaths,
    recommendedCommands: packageRecommendations(affectedPackages)
  };
  const report = {
    ...baseReport,
    status: affectedStatus({
      ok,
      monorepoDetected: catalog.monorepo.detected,
      affectedPackages
    })
  };

  return {
    ...report,
    nextSteps: affectedNextSteps(report)
  };
}

function inlineCode(value) {
  return `\`${value}\``;
}

function listOrNone(lines, items, emptyText, mapper) {
  if (items.length === 0) {
    lines.push(`- ${emptyText}`);
    return;
  }

  for (const item of items) {
    lines.push(`- ${mapper(item)}`);
  }
}

export function formatWorkspacesReport(report) {
  const tools = report.monorepo.tools.map((tool) => tool.name).join(", ") || "none";
  const lines = [
    "# Agent Ready Workspaces",
    "",
    `Status: ${report.status}`,
    `Root: ${report.root}`,
    `Purpose: ${report.summary.purpose}`,
    `Packages: ${report.summary.packageCount}`,
    `Tools: ${tools}`,
    "",
    "## Workspace Globs",
    ""
  ];

  listOrNone(lines, report.monorepo.workspaceGlobs, "No workspace globs detected.", (item) => `${inlineCode(item.pattern)} from ${item.source}.`);

  lines.push("");
  lines.push("## Workspace Commands");
  lines.push("");
  listOrNone(lines, report.commands.workspace, "No root workspace commands detected.", (command) => `${inlineCode(command.name)}: ${inlineCode(command.command)}.`);

  lines.push("");
  lines.push("## Packages");
  lines.push("");
  if (report.packages.length === 0) {
    lines.push("- No workspace packages detected.");
  } else {
    for (const workspacePackage of report.packages) {
      const scripts = workspacePackage.scripts.length > 0
        ? workspacePackage.scripts.slice(0, 8).map(inlineCode).join(", ")
        : "none";
      lines.push(`- ${inlineCode(`${workspacePackage.path}/`)}: ${inlineCode(workspacePackage.name)}; scripts: ${scripts}.`);
      for (const command of workspacePackage.commands.slice(0, 5)) {
        lines.push(`  - ${inlineCode(command.name)}: ${inlineCode(command.command)}.`);
      }
    }
  }

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  for (const [index, step] of report.nextSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

export function formatAffectedWorkspacesReport(report) {
  const lines = [
    "# Agent Ready Affected Workspaces",
    "",
    `Status: ${report.status}`,
    `Root: ${report.root}`,
    `Path source: ${report.pathSource}`,
    `Paths: ${report.paths.length}`,
    "",
    "## Affected Packages",
    ""
  ];

  if (report.affectedPackages.length === 0) {
    lines.push("- No workspace packages matched these paths.");
  } else {
    for (const workspacePackage of report.affectedPackages) {
      lines.push(`- ${inlineCode(`${workspacePackage.path}/`)}: ${inlineCode(workspacePackage.name)}.`);
      if (workspacePackage.changedPaths.length > 0) {
        lines.push(`  - Paths: ${workspacePackage.changedPaths.slice(0, 8).map(inlineCode).join(", ")}.`);
      }
      for (const command of workspacePackage.commands.filter((item) => PACKAGE_VALIDATION_ORDER.includes(item.name)).slice(0, 4)) {
        lines.push(`  - ${command.name}: ${inlineCode(command.command)}.`);
      }
    }
  }

  lines.push("");
  lines.push("## Unmatched Paths");
  lines.push("");
  if (report.unmatchedPaths.length === 0) {
    lines.push("- None.");
  } else {
    for (const item of report.unmatchedPaths.slice(0, 20)) {
      lines.push(`- ${inlineCode(item.path)}: ${item.reason}`);
    }
  }

  lines.push("");
  lines.push("## Recommended Commands");
  lines.push("");
  if (report.recommendedCommands.length === 0) {
    lines.push("- No package-scoped commands were detected for affected packages.");
  } else {
    for (const command of report.recommendedCommands.slice(0, 12)) {
      lines.push(`- ${inlineCode(command.command)} (${command.reason})`);
    }
  }

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  for (const [index, step] of report.nextSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
