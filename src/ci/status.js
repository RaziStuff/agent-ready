import fs from "node:fs/promises";
import path from "node:path";

const SCHEMA_VERSION = "0.1.0";
export const DEFAULT_STATUS_FILE = "agent-ready-status.json";
export const DEFAULT_CONTRACT_FILE = "agent-ready-contract.json";

function jsonText(data) {
  return `${JSON.stringify(data, null, 2)}\n`;
}

function issue(file, code, message) {
  return {
    file: path.resolve(file),
    code,
    message
  };
}

async function readJsonArtifact(file) {
  const absolutePath = path.resolve(file);
  try {
    return {
      ok: true,
      file: absolutePath,
      data: JSON.parse(await fs.readFile(absolutePath, "utf8"))
    };
  } catch (error) {
    return {
      ok: false,
      file: absolutePath,
      error: issue(absolutePath, error instanceof SyntaxError ? "invalid_json" : "read_error", error.message)
    };
  }
}

function firstString(items) {
  return Array.isArray(items) ? (items.find((item) => typeof item === "string" && item.trim()) ?? null) : null;
}

function statusSummary(statusReport) {
  return {
    ok: statusReport?.ok === true,
    status: statusReport?.status ?? "unknown",
    root: statusReport?.root ?? null,
    doctorStatus: statusReport?.doctor?.status ?? "unknown",
    changedPathCount: statusReport?.worktree?.changedPathCount ?? null,
    changedPaths: statusReport?.worktree?.changedPaths ?? [],
    recommendedValidationCount: statusReport?.validation?.recommended?.length ?? 0,
    validationReceiptCount: statusReport?.validation?.receipts?.length ?? 0,
    nextStep: firstString(statusReport?.nextSteps)
  };
}

function contractSummary(contractReport) {
  return {
    ok: contractReport?.ok === true,
    status: contractReport?.status ?? "unknown",
    schemaId: contractReport?.schema?.id ?? contractReport?.requestedSchema ?? null,
    issueCount: contractReport?.issueCount ?? contractReport?.errors?.length ?? 0
  };
}

function derivedStatus({ status, contract, errors }) {
  if (errors.length > 0) {
    return "unavailable";
  }
  if (!contract.ok) {
    return "contract_invalid";
  }
  return status.status;
}

export async function buildCiStatusReport({
  statusFile = DEFAULT_STATUS_FILE,
  contractFile = DEFAULT_CONTRACT_FILE
} = {}) {
  const [statusArtifact, contractArtifact] = await Promise.all([
    readJsonArtifact(statusFile),
    readJsonArtifact(contractFile)
  ]);
  const errors = [
    statusArtifact.ok ? null : statusArtifact.error,
    contractArtifact.ok ? null : contractArtifact.error
  ].filter(Boolean);
  const status = statusArtifact.ok ? statusSummary(statusArtifact.data) : statusSummary(null);
  const contract = contractArtifact.ok ? contractSummary(contractArtifact.data) : contractSummary(null);
  const reportStatus = derivedStatus({ status, contract, errors });

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ok: errors.length === 0 && status.ok && contract.ok,
    status: reportStatus,
    artifacts: {
      statusFile: statusArtifact.file,
      contractFile: contractArtifact.file
    },
    readiness: status,
    contract,
    nextStep: status.nextStep,
    errors
  };
}

export function formatCiStatusReport(report) {
  const lines = [
    "# Agent Ready CI Status",
    "",
    `Status: ${report.status}`,
    `Readiness: ${report.readiness.status}`,
    `Doctor: ${report.readiness.doctorStatus}`,
    `Changed paths: ${report.readiness.changedPathCount ?? "unknown"}`,
    `Validation receipts: ${report.readiness.validationReceiptCount} recommended`,
    `Contract: ${report.contract.status}`,
    report.nextStep ? `Next step: ${report.nextStep}` : "Next step: None listed.",
    "",
    "## Artifacts",
    "",
    `- Status: \`${report.artifacts.statusFile}\``,
    `- Contract: \`${report.artifacts.contractFile}\``
  ];

  if (report.errors.length > 0) {
    lines.push("");
    lines.push("## Issues");
    lines.push("");
    for (const item of report.errors) {
      lines.push(`- \`${item.file}\` ${item.message}`);
    }
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

export function ciStatusOutput(report, json = false) {
  return json ? jsonText(report) : formatCiStatusReport(report);
}
