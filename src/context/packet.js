import { buildDoctorReportFromValidation } from "../doctor/report.js";
import { validateRepo } from "../validators/validate.js";

const MCP_RESOURCES = [
  "agent-ready://status",
  "agent-ready://context",
  "agent-ready://doctor",
  "agent-ready://recipes",
  "agent-ready://recipes-json",
  "agent-ready://agents-md",
  "agent-ready://repo-map",
  "agent-ready://commands",
  "agent-ready://workspaces",
  "agent-ready://risk-policy"
];

const MCP_TOOLS = [
  "agent_ready_status",
  "agent_ready_preflight",
  "agent_ready_handoff",
  "agent_ready_impact",
  "agent_ready_workspaces",
  "agent_ready_affected",
  "agent_ready_doctor",
  "agent_ready_summary",
  "agent_ready_validate"
];

const MCP_PROMPTS = [
  "agent-ready-orient",
  "agent-ready-risk-review",
  "agent-ready-handoff"
];

function commandDetail(command) {
  const flags = [];
  if (command.requiresNetwork) flags.push("network");
  if (command.writesFiles) flags.push("writes files");
  if (command.risk && command.risk !== "low") flags.push(`${command.risk} risk`);
  return flags.length > 0 ? flags.join(", ") : "low risk";
}

function compactDoctor(doctor) {
  return {
    ok: doctor.ok,
    strict: doctor.strict,
    status: doctor.status,
    counts: doctor.counts,
    nextSteps: doctor.nextSteps,
    validation: doctor.validation
  };
}

function recommendedWorkflow(packet) {
  const steps = [
    "Read this packet, then AGENTS.md for the canonical repo operating guide.",
    "Use the listed docs and commands before inventing new project conventions.",
    "Review risk areas before editing migrations, infra, CI, generated files, lockfiles, or secret-like paths.",
    "Use `agent-ready status --json` or `agent_ready_status` when you need one dashboard for readiness, current changes, validation, recipes, and CI adoption.",
    "Use `agent_ready_preflight` or `agent-ready preflight` before handoff to check readiness and validation guidance.",
    "Use `agent_ready_workspaces` or `agent-ready workspaces` in monorepos before choosing package-local validation.",
    "Use `agent_ready_affected` or `agent-ready affected` when you only need the workspace packages touched by current or planned paths.",
    "Use `agent_ready_impact`, `agent-ready impact <path...>`, or `agent-ready impact --changed` when changed paths are known.",
    "Use `agent_ready_handoff` or `agent-ready handoff --changed` to prepare transfer notes before handoff.",
    "Use `agent-ready run <command-name>` when you want a structured validation receipt.",
    "Use `docs/agent-recipes.md` when you need a copy-paste task loop for a specific agent host.",
    "Use the handoff template when transferring context to another agent or human."
  ];

  if (packet.doctor.status !== "ready") {
    steps.unshift("Resolve the doctor next steps before starting non-trivial edits.");
  }

  return steps;
}

export async function buildContextPacket({ root, configPath = null, strict = false }) {
  const validation = await validateRepo({ root, configPath, strict: false });
  const scan = validation.scan;
  const doctor = buildDoctorReportFromValidation({ root, validation, strict });
  const packet = {
    schemaVersion: scan.schemaVersion,
    generatedAt: scan.generatedAt,
    root,
    ok: doctor.ok,
    status: doctor.status,
    summary: scan.summary,
    doctor: compactDoctor(doctor),
    docs: scan.docs,
    commands: scan.commands,
    risks: scan.risks.slice(0, 40),
    ci: scan.ci,
    mcp: {
      resources: MCP_RESOURCES,
      tools: MCP_TOOLS,
      prompts: MCP_PROMPTS
    }
  };

  return {
    ...packet,
    recommendedWorkflow: recommendedWorkflow(packet)
  };
}

function pushList(lines, items, emptyText, mapper) {
  if (items.length === 0) {
    lines.push(`- ${emptyText}`);
    return;
  }

  for (const item of items) {
    lines.push(`- ${mapper(item)}`);
  }
}

export function formatContextPacket(packet) {
  const lines = [
    "# Agent Context Packet",
    "",
    `Status: ${packet.status}`,
    `Root: ${packet.root}`,
    `Purpose: ${packet.summary.purpose}`,
    packet.summary.primaryLanguage ? `Primary language: ${packet.summary.primaryLanguage}` : null,
    packet.summary.packageManagers.length > 0 ? `Package managers: ${packet.summary.packageManagers.join(", ")}` : null,
    packet.summary.frameworks.length > 0 ? `Frameworks: ${packet.summary.frameworks.join(", ")}` : null,
    packet.summary.monorepo ? "Monorepo: yes" : null,
    "",
    "## Start Here",
    ""
  ].filter((line) => line !== null);

  for (const [index, step] of packet.recommendedWorkflow.entries()) {
    lines.push(`${index + 1}. ${step}`);
  }

  lines.push("");
  lines.push("## Readiness");
  lines.push("");
  lines.push(`- Doctor status: ${packet.doctor.status}`);
  lines.push(`- Checks: ${packet.doctor.counts.ok} ok, ${packet.doctor.counts.warn} warnings, ${packet.doctor.counts.fail} failures, ${packet.doctor.counts.info} info.`);
  if (packet.doctor.nextSteps.length > 0) {
    for (const step of packet.doctor.nextSteps) {
      lines.push(`- Next step: ${step}`);
    }
  } else {
    lines.push("- No readiness blockers detected.");
  }

  lines.push("");
  lines.push("## Key Docs");
  lines.push("");
  pushList(lines, packet.docs.slice(0, 10), "No docs discovered.", (doc) => `\`${doc.path}\` (${doc.role})`);

  lines.push("");
  lines.push("## Commands");
  lines.push("");
  pushList(lines, packet.commands.slice(0, 12), "No commands discovered.", (command) => `\`${command.name}\`: \`${command.command}\` (${commandDetail(command)}).`);

  lines.push("");
  lines.push("## Risk Areas");
  lines.push("");
  pushList(lines, packet.risks.slice(0, 12), "No risk paths detected.", (risk) => `\`${risk.path}\` (${risk.severity}): ${risk.reason}.`);

  lines.push("");
  lines.push("## CI");
  lines.push("");
  pushList(lines, packet.ci.slice(0, 8), "No supported CI config detected.", (ci) => `\`${ci.path}\` (${ci.provider}) with ${ci.runCommands.length} run command${ci.runCommands.length === 1 ? "" : "s"}.`);

  lines.push("");
  lines.push("## MCP");
  lines.push("");
  lines.push(`- Resources: ${packet.mcp.resources.map((item) => `\`${item}\``).join(", ")}.`);
  lines.push(`- Tools: ${packet.mcp.tools.map((item) => `\`${item}\``).join(", ")}.`);
  lines.push(`- Prompts: ${packet.mcp.prompts.map((item) => `\`${item}\``).join(", ")}.`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}
