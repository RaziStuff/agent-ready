#!/usr/bin/env node
import path from "node:path";
import process from "node:process";
import { DEFAULT_ACTION_REF, formatCiWorkflowResult, writeCiWorkflow } from "../ci/github-actions.js";
import { buildCiStatusReport, ciStatusOutput, DEFAULT_CONTRACT_FILE, DEFAULT_STATUS_FILE } from "../ci/status.js";
import { buildContextPacket, formatContextPacket } from "../context/packet.js";
import { writeStarterConfig } from "../core/config.js";
import { scanRepo } from "../core/scanner.js";
import { buildDoctorReport, formatDoctorReport } from "../doctor/report.js";
import { buildHandoffReport, formatHandoffReport } from "../handoff/report.js";
import { listGitChangedPaths } from "../impact/git-changes.js";
import { buildImpactReport, formatImpactReport } from "../impact/report.js";
import { runStdioMcpServer } from "../mcp/server.js";
import { buildPreflightReport, formatPreflightReport } from "../preflight/report.js";
import { recipeOutput } from "../recipes/report.js";
import { formatRunReceipt, runCommandReceipt } from "../run/report.js";
import { schemaOutput } from "../schemas/catalog.js";
import { contractVerificationOutput, verifyContract } from "../schemas/verify-contract.js";
import { buildStatusReport, formatStatusReport } from "../status/report.js";
import { writeAgentsMd } from "../writers/agents-md.js";
import { writeMetadata, writeProfilePointers } from "../writers/metadata.js";
import { validateRepo } from "../validators/validate.js";
import {
  buildAffectedWorkspacesReport,
  buildWorkspacesReport,
  formatAffectedWorkspacesReport,
  formatWorkspacesReport
} from "../workspaces/report.js";

function parseArgs(argv) {
  const args = [...argv];
  const command = args[0]?.startsWith("-") ? "help" : (args.shift() ?? "help");
  const options = {
    root: process.cwd(),
    json: false,
    dryRun: false,
    force: false,
    profiles: [],
    configPath: null,
    strict: false,
    changed: false,
    goal: "",
    allowNetwork: false,
    allowWrites: false,
    timeoutMs: null,
    strictProvided: false,
    write: false,
    mode: "required",
    workflowPath: null,
    actionRef: DEFAULT_ACTION_REF,
    schemaId: null,
    artifacts: true,
    statusFile: DEFAULT_STATUS_FILE,
    contractFile: DEFAULT_CONTRACT_FILE
  };
  const positionals = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--root") {
      options.root = path.resolve(args[index + 1]);
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--strict") {
      options.strict = true;
      options.strictProvided = true;
    } else if (arg === "--no-strict") {
      options.strict = false;
      options.strictProvided = true;
    } else if (arg === "--changed") {
      options.changed = true;
    } else if (arg === "--write") {
      options.write = true;
    } else if (arg === "--artifacts") {
      options.artifacts = true;
    } else if (arg === "--no-artifacts") {
      options.artifacts = false;
    } else if (arg === "--mode") {
      options.mode = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--workflow") {
      options.workflowPath = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--uses") {
      options.actionRef = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--schema") {
      options.schemaId = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--status-file") {
      options.statusFile = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--contract-file") {
      options.contractFile = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--config") {
      options.configPath = args[index + 1];
      index += 1;
    } else if (arg === "--goal") {
      options.goal = String(args[index + 1] ?? "");
      index += 1;
    } else if (arg === "--allow-network") {
      options.allowNetwork = true;
    } else if (arg === "--allow-writes") {
      options.allowWrites = true;
    } else if (arg === "--timeout-ms") {
      options.timeoutMs = Number(args[index + 1]);
      index += 1;
    } else if (arg === "--profile") {
      options.profiles = String(args[index + 1] ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--version" || arg === "-v") {
      options.version = true;
    } else {
      positionals.push(arg);
    }
  }

  return {
    command,
    options,
    positionals
  };
}

function printHelp() {
  console.log(`agent-ready

Generate AGENTS.md and repo metadata for AI coding agents.

Usage:
  agent-ready scan [--root <path>] [--config <path>] [--json]
  agent-ready init [--root <path>] [--config <path>] [--dry-run] [--force] [--profile <name[,name]>]
  agent-ready update [--root <path>] [--config <path>] [--dry-run] [--force] [--profile <name[,name]>]
  agent-ready validate [--root <path>] [--config <path>] [--strict] [--json]
  agent-ready doctor [--root <path>] [--config <path>] [--strict] [--json]
  agent-ready status [--root <path>] [--config <path>] [--strict] [--json]
  agent-ready context [--root <path>] [--config <path>] [--strict] [--json]
  agent-ready workspaces [path...] [--changed] [--root <path>] [--config <path>] [--json]
  agent-ready affected [path...] [--changed] [--root <path>] [--config <path>] [--json]
  agent-ready impact <path...> [--root <path>] [--config <path>] [--json]
  agent-ready impact --changed [--root <path>] [--config <path>] [--json]
  agent-ready handoff [path...] [--changed] [--goal <text>] [--root <path>] [--config <path>] [--json]
  agent-ready preflight [path...] [--changed] [--goal <text>] [--root <path>] [--config <path>] [--strict] [--json]
  agent-ready run <command-name> [--root <path>] [--config <path>] [--allow-network] [--allow-writes] [--timeout-ms <ms>] [--json]
  agent-ready recipes [recipe-id] [--json]
  agent-ready schemas [schema-id] [--json]
  agent-ready verify-contract <report-file> --schema <schema-id> [--json]
  agent-ready ci-status [--status-file <path>] [--contract-file <path>] [--json]
  agent-ready add-to-ci [--root <path>] [--mode required|advisory] [--strict|--no-strict] [--uses <action-ref>] [--workflow <path>] [--artifacts|--no-artifacts] [--write] [--dry-run] [--force] [--json]
  agent-ready explain [--root <path>] [--config <path>]
  agent-ready config init [--root <path>] [--config <path>] [--dry-run] [--force]
  agent-ready mcp [--root <path>] [--config <path>]

Commands:
  scan       Scan a repo and print detected facts.
  init       Create AGENTS.md and .agents metadata.
  update     Refresh generated sections and metadata.
  validate   Check that generated agent docs exist and are current.
  doctor     Diagnose whether a repo is ready for coding agents.
  status     Print a compact agent dashboard for readiness, changes, validation, and adoption.
  context    Print a compact agent onboarding packet.
  workspaces Print workspace package summaries and package-scoped commands.
  affected   Print workspace packages affected by planned or current git-changed paths.
  impact     Explain risk and validation guidance for planned or git-changed paths.
  handoff    Print a handoff packet with changed paths, risks, and validation.
  preflight  Check readiness, changed-path impact, validation, and handoff guidance.
  run        Execute a discovered command by name and print a structured receipt.
  recipes    Print copy-paste and machine-readable adoption recipes for agents.
  schemas    Print JSON Schema contracts for metadata and runtime reports.
  verify-contract
             Validate a JSON report file against a published schema.
  ci-status  Summarize agent-ready CI status and contract receipt artifacts.
  add-to-ci  Generate a GitHub Actions workflow for agent-ready validation.
  explain    Show evidence used for scanner decisions.
  config     Manage agent-ready configuration.
  mcp        Start a stdio MCP server exposing agent-ready resources.
`);
}

function printScanSummary(scan) {
  console.log(`Repo: ${scan.root}`);
  console.log(`Purpose: ${scan.summary.purpose}`);
  console.log(`Files scanned: ${scan.inventory.fileCount}`);

  if (scan.languages.length > 0) {
    console.log(`Languages: ${scan.languages.map((item) => item.name).join(", ")}`);
  }

  if (scan.packageManagers.length > 0) {
    console.log(`Package managers: ${scan.packageManagers.map((item) => item.name).join(", ")}`);
  }

  if (scan.frameworks.length > 0) {
    console.log(`Frameworks: ${scan.frameworks.map((item) => item.name).join(", ")}`);
  }

  if (scan.commands.length > 0) {
    console.log("\nCommands:");
    for (const command of scan.commands) {
      console.log(`  ${command.name}: ${command.command}`);
    }
  }

  if (scan.risks.length > 0) {
    console.log("\nRisk areas:");
    for (const risk of scan.risks.slice(0, 12)) {
      console.log(`  ${risk.path}: ${risk.reason}`);
    }
    if (scan.risks.length > 12) {
      console.log(`  ...and ${scan.risks.length - 12} more`);
    }
  }
}

async function writeAll({ root, scan, options, updateOnly }) {
  const agentsResult = await writeAgentsMd({
    root,
    scan,
    force: options.force,
    dryRun: options.dryRun,
    updateOnly
  });

  if (options.dryRun) {
    console.log(agentsResult.content);
    return;
  }

  const metadataResult = await writeMetadata({
    root,
    scan,
    dryRun: options.dryRun
  });

  const profileResult = await writeProfilePointers({
    root,
    profiles: options.profiles.length > 0 ? options.profiles : scan.config.profiles,
    force: options.force,
    dryRun: options.dryRun
  });

  console.log(agentsResult.message);
  console.log(`Wrote ${metadataResult.files.length} metadata files.`);
  if (profileResult.written.length > 0) {
    console.log(`Wrote ${profileResult.written.length} profile pointer file${profileResult.written.length === 1 ? "" : "s"}.`);
  }
  for (const skipped of profileResult.skipped) {
    console.log(`Skipped ${skipped.profile}: ${skipped.reason}.`);
  }
}

async function main() {
  const { command, options, positionals } = parseArgs(process.argv.slice(2));

  if (options.version) {
    console.log("0.2.8");
    return;
  }

  if (options.help || command === "help") {
    printHelp();
    return;
  }

  const root = path.resolve(options.root);

  if (command === "scan") {
    const scan = await scanRepo({ root, configPath: options.configPath });
    if (options.json) {
      console.log(JSON.stringify(scan, null, 2));
    } else {
      printScanSummary(scan);
    }
    return;
  }

  if (command === "init") {
    const scan = await scanRepo({ root, configPath: options.configPath });
    await writeAll({ root, scan, options, updateOnly: false });
    return;
  }

  if (command === "update") {
    const scan = await scanRepo({ root, configPath: options.configPath });
    await writeAll({ root, scan, options, updateOnly: true });
    return;
  }

  if (command === "validate") {
    const result = await validateRepo({ root, configPath: options.configPath, strict: options.strict });
    if (options.json) {
      console.log(JSON.stringify({ ok: result.ok, strict: result.strict, errors: result.errors, warnings: result.warnings }, null, 2));
    } else {
      if (result.errors.length === 0 && result.warnings.length === 0) {
        console.log("Agent docs look current.");
      }
      for (const error of result.errors) {
        console.error(`error: ${error}`);
      }
      for (const warning of result.warnings) {
        console.warn(`warning: ${warning}`);
      }
      if (options.strict && result.errors.length === 0 && result.warnings.length > 0) {
        console.error("error: strict validation treats warnings as failures.");
      }
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "doctor") {
    const report = await buildDoctorReport({ root, configPath: options.configPath, strict: options.strict });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatDoctorReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "status") {
    const report = await buildStatusReport({ root, configPath: options.configPath, strict: options.strict });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatStatusReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "context") {
    const packet = await buildContextPacket({ root, configPath: options.configPath, strict: options.strict });
    if (options.json) {
      console.log(JSON.stringify(packet, null, 2));
    } else {
      process.stdout.write(formatContextPacket(packet));
    }
    if (!packet.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "workspaces") {
    if (options.changed || positionals.length > 0) {
      const report = await buildAffectedWorkspacesReport({
        root,
        configPath: options.configPath,
        paths: positionals,
        changed: options.changed
      });
      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        process.stdout.write(formatAffectedWorkspacesReport(report));
      }
      if (!report.ok) {
        process.exitCode = 1;
      }
      return;
    }
    const report = await buildWorkspacesReport({ root, configPath: options.configPath });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatWorkspacesReport(report));
    }
    return;
  }

  if (command === "affected") {
    const report = await buildAffectedWorkspacesReport({
      root,
      configPath: options.configPath,
      paths: positionals,
      changed: options.changed || positionals.length === 0
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatAffectedWorkspacesReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "impact") {
    if (positionals.length === 0 && !options.changed) {
      console.error("error: impact requires at least one repo-relative path or --changed.");
      process.exitCode = 1;
      return;
    }
    const changedPaths = options.changed ? await listGitChangedPaths(root) : [];
    const report = await buildImpactReport({
      root,
      configPath: options.configPath,
      paths: [...changedPaths, ...positionals],
      pathSource: options.changed ? "git_changed" : "provided"
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatImpactReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "handoff") {
    const report = await buildHandoffReport({
      root,
      configPath: options.configPath,
      paths: positionals,
      changed: options.changed,
      goal: options.goal
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatHandoffReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "preflight") {
    const report = await buildPreflightReport({
      root,
      configPath: options.configPath,
      paths: positionals,
      changed: options.changed,
      strict: options.strict,
      goal: options.goal
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      process.stdout.write(formatPreflightReport(report));
    }
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "run") {
    const commandName = positionals[0];
    if (!commandName) {
      console.error("error: run requires a command name from `agent-ready context` or `.agents/commands.json`.");
      process.exitCode = 1;
      return;
    }
    const receipt = await runCommandReceipt({
      root,
      configPath: options.configPath,
      name: commandName,
      allowNetwork: options.allowNetwork,
      allowWrites: options.allowWrites,
      timeoutMs: Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : undefined
    });
    if (options.json) {
      console.log(JSON.stringify(receipt, null, 2));
    } else {
      process.stdout.write(formatRunReceipt(receipt));
    }
    if (!receipt.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "recipes") {
    const output = await recipeOutput({ recipeId: positionals[0] ?? null, json: options.json });
    process.stdout.write(output.text);
    if (!output.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "schemas") {
    const output = await schemaOutput({ schemaId: positionals[0] ?? null, json: options.json });
    process.stdout.write(output.text);
    if (!output.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "verify-contract") {
    const reportPath = positionals[0];
    if (!reportPath) {
      console.error("error: verify-contract requires a JSON report file path.");
      process.exitCode = 1;
      return;
    }
    if (!options.schemaId) {
      console.error("error: verify-contract requires --schema <schema-id>.");
      process.exitCode = 1;
      return;
    }
    const report = await verifyContract({ reportPath, schemaId: options.schemaId });
    process.stdout.write(contractVerificationOutput(report, options.json));
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "ci-status") {
    const report = await buildCiStatusReport({
      statusFile: options.statusFile,
      contractFile: options.contractFile
    });
    process.stdout.write(ciStatusOutput(report, options.json));
    if (!report.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "add-to-ci") {
    const result = await writeCiWorkflow({
      root,
      workflowPath: options.workflowPath || undefined,
      actionRef: options.actionRef,
      mode: options.mode,
      strict: options.strictProvided ? options.strict : true,
      artifacts: options.artifacts,
      write: options.write && !options.dryRun,
      force: options.force
    });
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      process.stdout.write(formatCiWorkflowResult(result));
    }
    return;
  }

  if (command === "explain") {
    const scan = await scanRepo({ root, configPath: options.configPath });
    if (scan.evidence.length === 0) {
      console.log("No evidence was collected.");
      return;
    }
    for (const item of scan.evidence) {
      console.log(`- ${item}`);
    }
    return;
  }

  if (command === "config") {
    const subcommand = positionals[0];
    if (subcommand === "init") {
      const result = await writeStarterConfig({
        root,
        configPath: options.configPath,
        force: options.force,
        dryRun: options.dryRun
      });

      if (options.dryRun) {
        process.stdout.write(result.content);
      } else {
        console.log(result.message);
      }
      return;
    }

    console.error(`Unknown config command: ${subcommand ?? "(missing)"}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (command === "mcp") {
    await runStdioMcpServer({ root, configPath: options.configPath });
    return;
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
