import path from "node:path";
import { validateRepo } from "../validators/validate.js";

const CHECK_LABELS = {
  ok: "ok",
  warn: "warn",
  fail: "fail",
  info: "info"
};

function check(id, label, status, message, details = [], action = null) {
  return {
    id,
    label,
    status,
    message,
    details: details.filter(Boolean),
    ...(action ? { action } : {})
  };
}

function commandNames(scan) {
  return new Set(scan.commands.map((command) => command.name));
}

function summarizeCommands(scan) {
  return scan.commands
    .slice(0, 8)
    .map((command) => `${command.name}: ${command.command}`);
}

function docsCheck(scan) {
  if (scan.docs.length === 0) {
    return check(
      "docs",
      "Repository docs",
      "warn",
      "No README or docs/*.md files were discovered.",
      [],
      "Add a README.md or docs/ guide so agents can learn repo intent before editing."
    );
  }

  return check(
    "docs",
    "Repository docs",
    "ok",
    `${scan.docs.length} documentation file${scan.docs.length === 1 ? "" : "s"} discovered.`,
    scan.docs.slice(0, 8).map((doc) => `${doc.path} (${doc.role})`)
  );
}

function commandsCheck(scan) {
  if (scan.commands.length === 0) {
    return check(
      "commands",
      "Command catalog",
      "warn",
      "No runnable commands were detected.",
      [],
      "Add scripts or configure commands in agent-ready.config.json."
    );
  }

  return check(
    "commands",
    "Command catalog",
    "ok",
    `${scan.commands.length} command${scan.commands.length === 1 ? "" : "s"} discovered.`,
    summarizeCommands(scan)
  );
}

function validationCoverageCheck(scan) {
  const names = commandNames(scan);
  const validationCommands = ["test", "verify", "check", "ci"].filter((name) => names.has(name));
  const supportingCommands = ["lint", "typecheck", "build"].filter((name) => names.has(name));

  if (validationCommands.length === 0) {
    return check(
      "validation-coverage",
      "Validation coverage",
      "warn",
      "No test, verify, check, or ci command was detected.",
      supportingCommands.length > 0 ? [`Supporting commands: ${supportingCommands.join(", ")}`] : [],
      "Add or configure a small validation command agents can run before handoff."
    );
  }

  return check(
    "validation-coverage",
    "Validation coverage",
    "ok",
    `Primary validation command${validationCommands.length === 1 ? "" : "s"}: ${validationCommands.join(", ")}.`,
    supportingCommands.length > 0 ? [`Supporting commands: ${supportingCommands.join(", ")}`] : []
  );
}

function agentDocsCheck(validation) {
  if (validation.errors.length > 0) {
    return check(
      "agent-docs",
      "Generated agent docs",
      "fail",
      "Generated agent docs are missing or invalid.",
      validation.errors,
      "Run `agent-ready init` or `agent-ready update`, then rerun `agent-ready validate --strict`."
    );
  }

  if (validation.warnings.length > 0) {
    return check(
      "agent-docs",
      "Generated agent docs",
      "warn",
      "Generated agent docs exist, but validation has warnings.",
      validation.warnings,
      "Run `agent-ready update` and review warnings before handing off to agents."
    );
  }

  return check(
    "agent-docs",
    "Generated agent docs",
    "ok",
    "AGENTS.md and .agents metadata look current."
  );
}

function configCheck(scan) {
  if (scan.config.loaded) {
    return check(
      "config",
      "Maintainer config",
      "ok",
      `Loaded ${path.basename(scan.config.path ?? "agent-ready.config.json")}.`
    );
  }

  return check(
    "config",
    "Maintainer config",
    "info",
    "No agent-ready.config.json file is present.",
    [],
    "Optional: run `agent-ready config init` when maintainers want to override scanner guesses."
  );
}

function ciCheck(scan) {
  if (scan.ci.length === 0) {
    return check(
      "ci",
      "CI signals",
      "warn",
      "No supported CI configuration was detected.",
      [],
      "Add CI or document the expected local validation command for agents."
    );
  }

  return check(
    "ci",
    "CI signals",
    "ok",
    `${scan.ci.length} CI configuration${scan.ci.length === 1 ? "" : "s"} detected.`,
    scan.ci.slice(0, 8).map((ci) => `${ci.provider}: ${ci.path}`)
  );
}

function safetyCheck(scan) {
  const secretLike = scan.environment.secretLikeFiles ?? [];
  const highRisks = scan.risks.filter((risk) => risk.severity === "high");

  if (secretLike.length > 0) {
    return check(
      "safety",
      "Safety map",
      "warn",
      `${secretLike.length} secret-like file${secretLike.length === 1 ? "" : "s"} detected by path.`,
      secretLike.slice(0, 8),
      "Do not ask agents to read secret-like files; keep examples in safe .env.example-style files."
    );
  }

  return check(
    "safety",
    "Safety map",
    "ok",
    `${scan.risks.length} risk path${scan.risks.length === 1 ? "" : "s"} mapped.`,
    highRisks.slice(0, 8).map((risk) => `${risk.path}: ${risk.reason}`)
  );
}

function repoScanCheck(scan) {
  const details = [
    `${scan.inventory.fileCount} files, ${scan.inventory.directoryCount} directories scanned.`,
    scan.summary.primaryLanguage ? `Primary language: ${scan.summary.primaryLanguage}.` : null,
    scan.summary.packageManagers.length > 0 ? `Package managers: ${scan.summary.packageManagers.join(", ")}.` : null,
    scan.summary.frameworks.length > 0 ? `Frameworks: ${scan.summary.frameworks.join(", ")}.` : null,
    scan.summary.monorepo ? "Monorepo signals detected." : null
  ];

  if (scan.inventory.limitHit) {
    return check(
      "repo-scan",
      "Repository scan",
      "warn",
      "The scan hit the file limit before walking the full repository.",
      details,
      "Add ignore rules in agent-ready.config.json for generated or vendored directories."
    );
  }

  return check(
    "repo-scan",
    "Repository scan",
    "ok",
    scan.summary.purpose,
    details
  );
}

function mcpCheck(root) {
  return check(
    "mcp",
    "MCP server",
    "ok",
    "The local stdio MCP server command is available.",
    [
      `Run: agent-ready mcp --root ${root}`,
      "Resources, resource templates, prompts, and tools are exposed over stdio."
    ]
  );
}

function overallStatus(checks) {
  if (checks.some((item) => item.status === "fail")) {
    return "blocked";
  }
  if (checks.some((item) => item.status === "warn")) {
    return "needs_attention";
  }
  return "ready";
}

export function buildDoctorReportFromValidation({ root, validation, strict = false }) {
  const scan = validation.scan;
  const checks = [
    repoScanCheck(scan),
    agentDocsCheck(validation),
    docsCheck(scan),
    commandsCheck(scan),
    validationCoverageCheck(scan),
    ciCheck(scan),
    safetyCheck(scan),
    configCheck(scan),
    mcpCheck(root)
  ];
  const status = overallStatus(checks);
  const counts = {
    ok: checks.filter((item) => item.status === "ok").length,
    warn: checks.filter((item) => item.status === "warn").length,
    fail: checks.filter((item) => item.status === "fail").length,
    info: checks.filter((item) => item.status === "info").length
  };

  return {
    ok: counts.fail === 0 && (!strict || counts.warn === 0),
    strict,
    status,
    root,
    summary: scan.summary,
    counts,
    checks,
    nextSteps: checks
      .filter((item) => item.status === "fail" || item.status === "warn")
      .map((item) => item.action)
      .filter(Boolean),
    validation: {
      errors: validation.errors,
      warnings: validation.warnings
    }
  };
}

export async function buildDoctorReport({ root, configPath = null, strict = false }) {
  const validation = await validateRepo({ root, configPath, strict: false });
  return buildDoctorReportFromValidation({ root, validation, strict });
}

function statusLabel(status) {
  return CHECK_LABELS[status] ?? status;
}

export function formatDoctorReport(report) {
  const lines = [
    "Agent Ready Doctor",
    `Root: ${report.root}`,
    `Status: ${report.status}`,
    `Purpose: ${report.summary.purpose}`,
    "",
    "Checks:"
  ];

  for (const item of report.checks) {
    lines.push(`  [${statusLabel(item.status)}] ${item.label}: ${item.message}`);
    for (const detail of item.details.slice(0, 8)) {
      lines.push(`        - ${detail}`);
    }
    if (item.action && item.status !== "ok") {
      lines.push(`        Action: ${item.action}`);
    }
  }

  if (report.nextSteps.length > 0) {
    lines.push("");
    lines.push("Next Steps:");
    for (const [index, step] of report.nextSteps.entries()) {
      lines.push(`  ${index + 1}. ${step}`);
    }
  }

  if (report.strict && !report.ok && report.counts.fail === 0) {
    lines.push("");
    lines.push("Strict mode treats warnings as failures.");
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}
