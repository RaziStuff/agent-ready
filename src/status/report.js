import path from "node:path";
import { buildContextPacket } from "../context/packet.js";
import { pathExists } from "../core/inventory.js";
import { buildPreflightReport } from "../preflight/report.js";

function compactPreflight(preflight) {
  if (!preflight) {
    return null;
  }
  return {
    ok: preflight.ok,
    status: preflight.status,
    pathSource: preflight.pathSource,
    impactStatus: preflight.impact.status,
    changedPathCount: preflight.impact.paths.length,
    recommendedValidationCount: preflight.recommendedValidation.length,
    handoffCommand: preflight.handoffCommand,
    nextSteps: preflight.nextSteps
  };
}

function statusFrom({ context, preflight, worktree }) {
  if (preflight && !preflight.ok) {
    return "blocked";
  }
  if (!context.ok) {
    return "blocked";
  }
  if (!worktree.available) {
    return "needs_attention";
  }
  if (preflight?.status === "needs_review") {
    return "needs_review";
  }
  if (preflight?.status === "needs_validation") {
    return "needs_validation";
  }
  if (context.doctor.status !== "ready") {
    return "needs_attention";
  }
  return "ready";
}

async function adoptionHints(root) {
  const workflowPath = ".github/workflows/agent-ready.yml";
  const workflowDetected = await pathExists(path.join(root, workflowPath));
  return {
    recipes: {
      cli: "agent-ready recipes --json",
      mcp: "agent-ready://recipes-json",
      recommendedRecipe: "final-answer-loop"
    },
    ci: {
      workflowPath,
      workflowDetected,
      previewCommand: "agent-ready add-to-ci --json",
      writeCommand: "agent-ready add-to-ci --write",
      note: workflowDetected
        ? "Agent Ready CI workflow file exists."
        : "Preview CI adoption with `agent-ready add-to-ci --json`."
    }
  };
}

function validationReceiptCommands(commands) {
  return commands.map((command) => ({
    name: command.name,
    command: command.command,
    receiptCommand: `agent-ready run ${command.name} --json`,
    requiresNetwork: command.requiresNetwork,
    writesFiles: command.writesFiles,
    risk: command.risk,
    reason: command.reason
  }));
}

function nextSteps(report) {
  const steps = [];

  if (report.doctor.status !== "ready") {
    steps.push("Resolve doctor warnings or blockers before non-trivial edits.");
  }

  if (!report.worktree.available) {
    steps.push("Run inside a git worktree or use `agent-ready impact <path...> --json` with planned paths.");
  } else if (report.worktree.changedPathCount === 0) {
    steps.push("No git changed paths detected; use `agent-ready impact <path...> --json` before editing planned files.");
  } else if (report.validation.receipts.length > 0) {
    steps.push(`Run a validation receipt such as \`${report.validation.receipts[0].receiptCommand}\`.`);
  } else {
    steps.push("No validation command was detected for current changes; document manual verification before handoff.");
  }

  if (!report.adoption.ci.workflowDetected) {
    steps.push("Preview CI adoption with `agent-ready add-to-ci --json`.");
  }

  steps.push("Read task loops with `agent-ready recipes --json`.");

  if (report.preflight?.handoffCommand) {
    steps.push(`Prepare transfer notes with \`${report.preflight.handoffCommand}\`.`);
  }

  return [...new Set(steps)];
}

export async function buildStatusReport({ root, configPath = null, strict = false }) {
  let preflight = null;
  let context = null;
  let worktreeError = null;

  try {
    preflight = await buildPreflightReport({ root, configPath, changed: true, strict });
    context = {
      schemaVersion: preflight.schemaVersion,
      generatedAt: preflight.generatedAt,
      ok: preflight.doctor.ok,
      status: preflight.doctor.status,
      summary: preflight.summary,
      doctor: preflight.doctor
    };
  } catch (error) {
    worktreeError = error.message;
    const packet = await buildContextPacket({ root, configPath, strict });
    context = {
      schemaVersion: packet.schemaVersion,
      generatedAt: packet.generatedAt,
      ok: packet.ok,
      status: packet.status,
      summary: packet.summary,
      doctor: packet.doctor
    };
  }

  const worktree = {
    available: worktreeError === null,
    pathSource: "git_changed",
    changedPathCount: preflight?.impact.paths.length ?? 0,
    changedPaths: preflight?.impact.paths ?? [],
    ...(worktreeError ? { error: worktreeError } : {})
  };
  const recommendedValidation = preflight?.recommendedValidation ?? [];
  const adoption = await adoptionHints(root);
  const baseReport = {
    schemaVersion: context.schemaVersion,
    generatedAt: context.generatedAt,
    root,
    strict,
    summary: context.summary,
    doctor: context.doctor,
    worktree,
    preflight: compactPreflight(preflight),
    validation: {
      recommended: recommendedValidation,
      receipts: validationReceiptCommands(recommendedValidation)
    },
    adoption
  };
  const status = statusFrom({ context, preflight, worktree });
  const report = {
    ...baseReport,
    ok: status !== "blocked",
    status
  };

  return {
    ...report,
    nextSteps: nextSteps(report)
  };
}

export function formatStatusReport(report) {
  const lines = [
    "# Agent Ready Status",
    "",
    `Status: ${report.status}`,
    `Root: ${report.root}`,
    `Purpose: ${report.summary.purpose}`,
    "",
    "## Readiness",
    "",
    `- Doctor: ${report.doctor.status}`,
    `- Checks: ${report.doctor.counts.ok} ok, ${report.doctor.counts.warn} warn, ${report.doctor.counts.fail} fail.`,
    report.strict ? "- Strict mode: warnings block readiness." : null,
    "",
    "## Worktree",
    "",
    report.worktree.available
      ? `- Git changed paths: ${report.worktree.changedPathCount}`
      : `- Git changed paths unavailable: ${report.worktree.error}`,
    report.preflight ? `- Impact: ${report.preflight.impactStatus}` : null,
    ""
  ].filter((line) => line !== null);

  if (report.worktree.changedPaths.length > 0) {
    for (const relPath of report.worktree.changedPaths.slice(0, 20)) {
      lines.push(`- \`${relPath}\``);
    }
    const hiddenCount = report.worktree.changedPaths.length - 20;
    if (hiddenCount > 0) {
      lines.push(`- ...and ${hiddenCount} more path${hiddenCount === 1 ? "" : "s"}.`);
    }
  }

  lines.push("");
  lines.push("## Validation Receipts");
  lines.push("");
  if (report.validation.receipts.length === 0) {
    lines.push("- No recommended validation receipt yet.");
  } else {
    for (const receipt of report.validation.receipts) {
      lines.push(`- \`${receipt.receiptCommand}\` (${receipt.reason})`);
    }
  }

  lines.push("");
  lines.push("## Adoption");
  lines.push("");
  lines.push(`- Recipes: \`${report.adoption.recipes.cli}\``);
  lines.push(`- CI: ${report.adoption.ci.note}`);

  lines.push("");
  lines.push("## Next Steps");
  lines.push("");
  for (const [index, step] of report.nextSteps.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
