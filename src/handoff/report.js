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

function handoffNextSteps(report) {
  const steps = [];
  if (report.doctor.status !== "ready") {
    steps.push("Resolve agent-ready doctor warnings or blockers before merging.");
  }
  if (report.impact.status === "high") {
    steps.push("Call out high-impact paths and get maintainer review.");
  }
  if (report.recommendedValidation.length > 0) {
    steps.push("Run or explicitly defer the recommended validation commands.");
  } else {
    steps.push("Record manual verification because no validation commands were detected.");
  }
  steps.push("Replace placeholder sections before handing this packet to the next agent or maintainer.");
  return steps;
}

export async function buildHandoffReport({ root, configPath = null, paths = [], changed = false, goal = "" }) {
  const changedPaths = changed ? await listGitChangedPaths(root) : [];
  const pathSource = changed ? "git_changed" : "provided";
  const [context, impact] = await Promise.all([
    buildContextPacket({ root, configPath, strict: false }),
    buildImpactReport({
      root,
      configPath,
      paths: [...changedPaths, ...paths],
      pathSource
    })
  ]);

  const report = {
    schemaVersion: context.schemaVersion,
    generatedAt: context.generatedAt,
    root,
    ok: context.ok && impact.ok,
    status: context.status,
    goal: goal.trim() || null,
    summary: context.summary,
    doctor: context.doctor,
    impact: compactImpact(impact),
    recommendedValidation: impact.recommendedCommands,
    relevantDocs: impact.relevantDocs,
    nextSteps: []
  };

  return {
    ...report,
    nextSteps: handoffNextSteps(report)
  };
}

function limitedItems(items, limit) {
  return {
    visible: items.slice(0, limit),
    hiddenCount: Math.max(0, items.length - limit)
  };
}

export function formatHandoffReport(report) {
  const pathList = limitedItems(report.impact.impacts, 40);
  const docs = limitedItems(report.relevantDocs, 8);
  const lines = [
    "# Agent Handoff Packet",
    "",
    `Root: ${report.root}`,
    `Repo status: ${report.status}`,
    `Impact status: ${report.impact.status}`,
    `Path source: ${report.impact.pathSource}`,
    report.goal ? `Goal: ${report.goal}` : null,
    "",
    "## Repo Summary",
    "",
    `- Purpose: ${report.summary.purpose}`,
    report.summary.primaryLanguage ? `- Primary language: ${report.summary.primaryLanguage}` : null,
    report.summary.packageManagers.length > 0 ? `- Package managers: ${report.summary.packageManagers.join(", ")}` : null,
    report.summary.frameworks.length > 0 ? `- Frameworks: ${report.summary.frameworks.join(", ")}` : null,
    `- Agent docs: ${report.doctor.status}`,
    "",
    "## Completed Work",
    "",
    "- TODO: Replace with concise completed work.",
    "",
    "## Changed Paths",
    ""
  ].filter((line) => line !== null);

  if (pathList.visible.length === 0) {
    lines.push(report.impact.pathSource === "git_changed" ? "- No changed paths detected by git." : "- No changed paths provided.");
  } else {
    for (const impact of pathList.visible) {
      const categories = impact.categories.length > 0 ? impact.categories.join(", ") : "none";
      lines.push(`- \`${impact.path}\` (${impact.severity}; categories: ${categories})`);
    }
    if (pathList.hiddenCount > 0) {
      lines.push(`- ...and ${pathList.hiddenCount} more path${pathList.hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Validation");
  lines.push("");
  if (report.recommendedValidation.length === 0) {
    lines.push("- Recommended: no validation commands were detected.");
  } else {
    for (const command of report.recommendedValidation) {
      lines.push(`- Recommended: \`${command.command}\` (${command.reason})`);
    }
  }
  lines.push("- Results: TODO: Add commands run and outcomes.");

  lines.push("");
  lines.push("## Risks");
  lines.push("");
  const riskyImpacts = report.impact.impacts.filter((impact) => impact.risks.length > 0 || impact.notes.length > 0);
  if (riskyImpacts.length === 0) {
    lines.push("- No path-specific risks detected.");
  } else {
    for (const impact of riskyImpacts.slice(0, 12)) {
      lines.push(`- \`${impact.path}\`: ${impact.notes[0] ?? impact.risks[0]?.reason ?? "review required"}`);
    }
    if (riskyImpacts.length > 12) {
      lines.push(`- ...and ${riskyImpacts.length - 12} more risky path${riskyImpacts.length - 12 === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Relevant Docs");
  lines.push("");
  if (docs.visible.length === 0) {
    lines.push("- No docs discovered.");
  } else {
    for (const doc of docs.visible) {
      lines.push(`- \`${doc.path}\` (${doc.role})`);
    }
  }

  lines.push("");
  lines.push("## Open Questions");
  lines.push("");
  lines.push("- TODO: Add unresolved questions, assumptions, or blockers.");

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  for (const [index, step] of report.nextSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
