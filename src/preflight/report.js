import { buildContextPacket } from "../context/packet.js";
import { listGitChangedPaths } from "../impact/git-changes.js";
import { buildImpactReport } from "../impact/report.js";

function compactImpact(impact) {
  return {
    status: impact.status,
    ok: impact.ok,
    pathSource: impact.pathSource,
    paths: impact.paths,
    impacts: impact.impacts,
    affectedPackages: impact.affectedPackages,
    recommendedCommands: impact.recommendedCommands,
    nextSteps: impact.nextSteps
  };
}

function preflightStatus({ context, impact }) {
  if (!context.ok || !impact.ok) {
    return "blocked";
  }
  if (impact.status === "high") {
    return "needs_review";
  }
  if (impact.recommendedCommands.length > 0) {
    return "needs_validation";
  }
  return "ready";
}

function handoffCommand({ changed, paths, goal }) {
  const args = ["agent-ready", "handoff"];
  if (changed) {
    args.push("--changed");
  }
  for (const item of paths) {
    args.push(item);
  }
  if (goal) {
    args.push("--goal", JSON.stringify(goal));
  }
  return args.join(" ");
}

function nextSteps(report) {
  const steps = [];
  if (report.doctor.status !== "ready") {
    steps.push("Resolve doctor warnings or blockers before handoff.");
  }
  if (report.impact.status === "high") {
    steps.push("Get maintainer review for high-impact changed paths.");
  }
  if (report.recommendedValidation.length > 0) {
    steps.push("Run or explicitly defer the recommended validation commands.");
  } else if (report.impact.paths.length === 0) {
    steps.push("No changed paths detected; confirm there is no work to hand off.");
  } else {
    steps.push("Document manual verification because no validation command was detected.");
  }
  steps.push(`Prepare transfer notes with \`${report.handoffCommand}\`.`);
  return steps;
}

export async function buildPreflightReport({ root, configPath = null, paths = [], changed = false, strict = false, goal = "" }) {
  const normalizedPaths = paths.filter((item) => String(item ?? "").trim());
  const useGitChanged = changed || normalizedPaths.length === 0;
  const changedPaths = useGitChanged ? await listGitChangedPaths(root) : [];
  const allPaths = [...changedPaths, ...normalizedPaths];
  const [context, impact] = await Promise.all([
    buildContextPacket({ root, configPath, strict }),
    buildImpactReport({
      root,
      configPath,
      paths: allPaths,
      pathSource: useGitChanged ? "git_changed" : "provided"
    })
  ]);
  const trimmedGoal = goal.trim();
  const report = {
    schemaVersion: context.schemaVersion,
    generatedAt: context.generatedAt,
    root,
    ok: context.ok && impact.ok,
    strict,
    status: preflightStatus({ context, impact }),
    pathSource: useGitChanged ? "git_changed" : "provided",
    changedDefaulted: useGitChanged && !changed,
    goal: trimmedGoal || null,
    summary: context.summary,
    doctor: context.doctor,
    impact: compactImpact(impact),
    recommendedValidation: impact.recommendedCommands,
    handoffCommand: handoffCommand({
      changed: useGitChanged,
      paths: useGitChanged ? [] : normalizedPaths,
      goal: trimmedGoal
    }),
    nextSteps: []
  };

  return {
    ...report,
    nextSteps: nextSteps(report)
  };
}

export function formatPreflightReport(report) {
  const lines = [
    "# Agent Preflight",
    "",
    `Status: ${report.status}`,
    `Root: ${report.root}`,
    `Purpose: ${report.summary.purpose}`,
    `Path source: ${report.pathSource}`,
    report.goal ? `Goal: ${report.goal}` : null,
    "",
    "## Readiness",
    "",
    `- Doctor: ${report.doctor.status}`,
    `- Checks: ${report.doctor.counts.ok} ok, ${report.doctor.counts.warn} warn, ${report.doctor.counts.fail} fail.`,
    report.strict ? "- Strict mode: warnings fail readiness." : null,
    "",
    "## Changed Path Impact",
    "",
    `- Impact: ${report.impact.status}`,
    `- Paths: ${report.impact.paths.length}`,
    ""
  ].filter((line) => line !== null);

  if (report.impact.impacts.length === 0) {
    lines.push(report.pathSource === "git_changed" ? "- No changed paths detected by git." : "- No paths provided.");
  } else {
    for (const impact of report.impact.impacts.slice(0, 20)) {
      const categories = impact.categories.length > 0 ? impact.categories.join(", ") : "none";
      lines.push(`- \`${impact.path}\` (${impact.severity}; categories: ${categories})`);
    }
    const hiddenCount = report.impact.impacts.length - 20;
    if (hiddenCount > 0) {
      lines.push(`- ...and ${hiddenCount} more path${hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Affected Workspaces");
  lines.push("");
  if (report.impact.affectedPackages.length === 0) {
    lines.push("- No workspace packages matched these paths.");
  } else {
    for (const workspacePackage of report.impact.affectedPackages.slice(0, 12)) {
      lines.push(`- \`${workspacePackage.path}/\` (${workspacePackage.name})`);
      for (const command of workspacePackage.commands.filter((item) => ["test", "lint", "typecheck", "build"].includes(item.name)).slice(0, 4)) {
        lines.push(`  - ${command.name}: \`${command.command}\`.`);
      }
    }
    const hiddenCount = report.impact.affectedPackages.length - 12;
    if (hiddenCount > 0) {
      lines.push(`- ...and ${hiddenCount} more affected workspace package${hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Recommended Validation");
  lines.push("");
  if (report.recommendedValidation.length === 0) {
    lines.push("- No validation commands were detected for these paths.");
  } else {
    for (const command of report.recommendedValidation) {
      lines.push(`- \`${command.command}\` (${command.reason})`);
    }
  }

  lines.push("");
  lines.push("## Handoff");
  lines.push("");
  lines.push(`- \`${report.handoffCommand}\``);

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  for (const [index, step] of report.nextSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
