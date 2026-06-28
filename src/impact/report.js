import path from "node:path";
import { RISK_PATH_RULES } from "../core/constants.js";
import { isSecretLikePath, pathExists, toPosixPath } from "../core/inventory.js";
import { scanRepo } from "../core/scanner.js";
import { workspaceCatalog } from "../writers/metadata.js";

const SEVERITY_SCORE = {
  low: 1,
  medium: 2,
  high: 3
};

const VALIDATION_COMMAND_ORDER = ["verify", "test", "check", "ci", "lint", "typecheck", "build"];

function normalizeImpactPath(root, value) {
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

function maxSeverity(items) {
  return items.reduce((highest, item) => {
    return SEVERITY_SCORE[item.severity] > SEVERITY_SCORE[highest] ? item.severity : highest;
  }, "low");
}

function relatedRisk(risk, relPath) {
  return risk.path === relPath || relPath.startsWith(`${risk.path}/`) || risk.path.startsWith(`${relPath}/`);
}

function dedupeRisks(risks) {
  const seen = new Set();
  const result = [];
  for (const risk of risks) {
    const key = `${risk.path}:${risk.category}:${risk.reason}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(risk);
  }
  return result;
}

function ruleRisksForPath(relPath) {
  const risks = [];
  if (isSecretLikePath(relPath)) {
    risks.push({
      path: relPath,
      category: "secret_like_file",
      severity: "high",
      reason: "file name looks like it may contain secrets; contents should not be read"
    });
  }

  for (const rule of RISK_PATH_RULES) {
    if (rule.pattern.test(relPath)) {
      risks.push({
        path: relPath,
        category: rule.category,
        severity: rule.severity,
        reason: rule.reason
      });
      break;
    }
  }

  return risks;
}

async function pathImpact(root, scan, item) {
  if (item.outsideRoot) {
    return {
      input: item.input,
      path: item.path,
      exists: false,
      outsideRoot: true,
      severity: "high",
      categories: ["outside_repo"],
      risks: [
        {
          path: item.path,
          category: "outside_repo",
          severity: "high",
          reason: "path resolves outside the repository root"
        }
      ],
      notes: ["Do not edit paths outside the selected repository root."]
    };
  }

  const exists = await pathExists(path.join(root, item.path));
  const risks = dedupeRisks([
    ...ruleRisksForPath(item.path),
    ...scan.risks.filter((risk) => relatedRisk(risk, item.path))
  ]);
  const severity = risks.length > 0 ? maxSeverity(risks) : "low";
  const categories = [...new Set(risks.map((risk) => risk.category))];
  const notes = [];

  if (!exists) {
    notes.push("Path does not currently exist; treat this as a planned new file or directory.");
  }
  if (categories.includes("secret_like_file")) {
    notes.push("Do not read, print, or expose secret-like file contents.");
  }
  if (categories.includes("generated") || categories.includes("configured_generated")) {
    notes.push("Prefer changing the source generator and regenerating outputs.");
  }
  if (categories.includes("database_migration")) {
    notes.push("Database migrations can affect persisted data; verify rollback and deployment expectations.");
  }
  if (categories.includes("infrastructure") || categories.includes("deployment")) {
    notes.push("Infrastructure and deployment changes should get extra review before handoff.");
  }
  if (categories.includes("ci")) {
    notes.push("CI changes can alter validation and release behavior; verify the workflow commands still match project expectations.");
  }

  return {
    input: item.input,
    path: item.path,
    exists,
    outsideRoot: false,
    severity,
    categories,
    risks,
    notes
  };
}

function commandByName(scan, name) {
  return scan.commands.find((command) => command.name === name)
    ?? scan.commands.find((command) => command.name === `workspace ${name}`)
    ?? null;
}

function addCommand(recommendations, scan, name, reason) {
  const command = commandByName(scan, name);
  if (!command) {
    return;
  }
  if (recommendations.some((item) => item.name === command.name && item.command === command.command)) {
    return;
  }
  recommendations.push({
    name: command.name,
    command: command.command,
    reason,
    risk: command.risk,
    requiresNetwork: command.requiresNetwork,
    writesFiles: command.writesFiles
  });
}

function addRecommendedCommand(recommendations, command) {
  if (recommendations.some((item) => item.name === command.name && item.command === command.command)) {
    return;
  }
  recommendations.push(command);
}

function packageCommandRisk(commandName) {
  if (commandName === "build") {
    return { risk: "low", requiresNetwork: false, writesFiles: true };
  }
  return { risk: "low", requiresNetwork: false, writesFiles: false };
}

function packageValidationCommands(affectedPackages) {
  const commands = [];
  const order = ["test", "lint", "typecheck", "build"];
  for (const affectedPackage of affectedPackages) {
    for (const commandName of order) {
      const command = affectedPackage.commands.find((item) => item.name === commandName);
      if (!command) {
        continue;
      }
      commands.push({
        name: `${affectedPackage.name} ${command.name}`,
        command: command.command,
        reason: `Package-scoped ${command.name} for ${affectedPackage.name}.`,
        ...packageCommandRisk(command.name),
        packagePath: affectedPackage.path,
        packageName: affectedPackage.name
      });
    }
  }
  return commands;
}

function selectRecommendedCommands(scan, impacts, affectedPackages) {
  const recommendations = [];
  if (impacts.length === 0) {
    return recommendations;
  }

  for (const command of packageValidationCommands(affectedPackages)) {
    addRecommendedCommand(recommendations, command);
  }

  const categories = new Set(impacts.flatMap((impact) => impact.categories));
  const highest = maxSeverity(impacts);

  for (const name of VALIDATION_COMMAND_ORDER.slice(0, 4)) {
    const previousCount = recommendations.length;
    addCommand(recommendations, scan, name, "Primary validation before handoff.");
    if (recommendations.length > previousCount) {
      break;
    }
  }

  if (highest !== "low") {
    addCommand(recommendations, scan, "lint", "Medium or high impact paths changed.");
    addCommand(recommendations, scan, "typecheck", "Medium or high impact paths changed.");
    addCommand(recommendations, scan, "build", "Medium or high impact paths changed.");
  }

  if (categories.has("lockfile")) {
    addCommand(recommendations, scan, "install", "Lockfile or dependency metadata changed.");
  }

  if (categories.has("ci")) {
    addCommand(recommendations, scan, "verify", "CI configuration changed.");
    addCommand(recommendations, scan, "test", "CI configuration changed.");
  }

  return recommendations.slice(0, 8);
}

function packageContainsPath(workspacePackage, relPath) {
  if (relPath === ".") {
    return true;
  }
  return relPath === workspacePackage.path
    || relPath.startsWith(`${workspacePackage.path}/`)
    || workspacePackage.path.startsWith(`${relPath}/`);
}

function workspacePackagesForPath(workspaces, relPath) {
  if (!workspaces.monorepo.detected) {
    return [];
  }
  return workspaces.packages
    .filter((workspacePackage) => packageContainsPath(workspacePackage, relPath))
    .map((workspacePackage) => ({
      path: workspacePackage.path,
      name: workspacePackage.name
    }));
}

function affectedWorkspacePackages(workspaces, impacts) {
  if (!workspaces.monorepo.detected) {
    return [];
  }

  const changedPathsByPackage = new Map();
  for (const impact of impacts) {
    for (const workspacePackage of workspaces.packages) {
      if (packageContainsPath(workspacePackage, impact.path)) {
        const changedPaths = changedPathsByPackage.get(workspacePackage.path) ?? [];
        changedPaths.push(impact.path);
        changedPathsByPackage.set(workspacePackage.path, changedPaths);
      }
    }
  }

  return workspaces.packages
    .filter((workspacePackage) => changedPathsByPackage.has(workspacePackage.path))
    .map((workspacePackage) => ({
      path: workspacePackage.path,
      name: workspacePackage.name,
      private: workspacePackage.private,
      scripts: workspacePackage.scripts,
      commands: workspacePackage.commands,
      changedPaths: [...new Set(changedPathsByPackage.get(workspacePackage.path) ?? [])]
    }));
}

function relevantDocs(scan) {
  return scan.docs.slice(0, 8);
}

function nextSteps(report) {
  const steps = [];
  if (report.status === "high") {
    steps.push("Get maintainer review before handing off high-impact changes.");
  }
  if (report.impacts.some((impact) => impact.categories.includes("secret_like_file"))) {
    steps.push("Do not read or expose secret-like file contents.");
  }
  if (report.affectedPackages.length > 0) {
    steps.push("Use affected package guidance to choose package-scoped validation before broad workspace checks.");
  }
  if (report.recommendedCommands.length > 0) {
    steps.push("Run the recommended validation command list before handoff.");
  } else {
    steps.push("No validation command was detected; document manual verification in the handoff.");
  }
  steps.push("Summarize changed paths, validation results, and remaining risk in the final handoff.");
  return steps;
}

export async function buildImpactReport({ root, paths, configPath = null, pathSource = "provided" }) {
  const normalized = [...new Set((paths ?? []).map((item) => normalizeImpactPath(root, item)).filter(Boolean).map((item) => JSON.stringify(item)))]
    .map((item) => JSON.parse(item));
  const scan = await scanRepo({ root, configPath });
  const workspaces = workspaceCatalog(scan);
  const impacts = [];

  for (const item of normalized) {
    const impact = await pathImpact(root, scan, item);
    impacts.push({
      ...impact,
      workspacePackages: workspacePackagesForPath(workspaces, impact.path)
    });
  }

  const affectedPackages = affectedWorkspacePackages(workspaces, impacts);
  const status = impacts.length > 0 ? maxSeverity(impacts) : "low";
  const report = {
    root,
    status,
    ok: impacts.every((impact) => !impact.outsideRoot),
    pathSource,
    paths: normalized.map((item) => item.path),
    impacts,
    affectedPackages,
    recommendedCommands: selectRecommendedCommands(scan, impacts, affectedPackages),
    relevantDocs: relevantDocs(scan),
    ci: scan.ci,
    summary: scan.summary
  };

  return {
    ...report,
    nextSteps: nextSteps(report)
  };
}

export function formatImpactReport(report) {
  const lines = [
    "# Agent Change Impact",
    "",
    `Status: ${report.status}`,
    `Root: ${report.root}`,
    `Purpose: ${report.summary.purpose}`,
    "",
    "## Paths",
    ""
  ];

  if (report.impacts.length === 0) {
    lines.push(report.pathSource === "git_changed" ? "- No changed paths detected by git." : "- No paths provided.");
  } else {
    for (const impact of report.impacts) {
      const categories = impact.categories.length > 0 ? impact.categories.join(", ") : "none";
      lines.push(`- \`${impact.path}\` (${impact.severity}; categories: ${categories})`);
      for (const risk of impact.risks.slice(0, 4)) {
        lines.push(`  - ${risk.reason}.`);
      }
      for (const note of impact.notes.slice(0, 4)) {
        lines.push(`  - ${note}`);
      }
    }
  }

  lines.push("");
  lines.push("## Affected Workspaces");
  lines.push("");
  if (report.affectedPackages.length === 0) {
    lines.push("- No workspace packages matched these paths.");
  } else {
    for (const workspacePackage of report.affectedPackages.slice(0, 12)) {
      lines.push(`- \`${workspacePackage.path}/\` (${workspacePackage.name})`);
      if (workspacePackage.changedPaths.length > 0) {
        lines.push(`  - Paths: ${workspacePackage.changedPaths.slice(0, 6).map((item) => `\`${item}\``).join(", ")}.`);
      }
      for (const command of workspacePackage.commands.filter((item) => ["test", "lint", "typecheck", "build"].includes(item.name)).slice(0, 4)) {
        lines.push(`  - ${command.name}: \`${command.command}\`.`);
      }
    }
    const hiddenCount = report.affectedPackages.length - 12;
    if (hiddenCount > 0) {
      lines.push(`- ...and ${hiddenCount} more affected workspace package${hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Recommended Validation");
  lines.push("");
  if (report.recommendedCommands.length === 0) {
    lines.push("- No validation commands were detected.");
  } else {
    for (const command of report.recommendedCommands) {
      lines.push(`- \`${command.command}\` (${command.reason})`);
    }
  }

  lines.push("");
  lines.push("## Relevant Docs");
  lines.push("");
  if (report.relevantDocs.length === 0) {
    lines.push("- No docs discovered.");
  } else {
    for (const doc of report.relevantDocs) {
      lines.push(`- \`${doc.path}\` (${doc.role})`);
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
