import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { scanRepo } from "../core/scanner.js";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_CHARS = 24 * 1024;

function outputTail(value) {
  if (value.length <= MAX_OUTPUT_CHARS) {
    return value;
  }
  return value.slice(value.length - MAX_OUTPUT_CHARS);
}

function findCommand(scan, name) {
  const matches = scan.commands.filter((command) => command.name === name);
  if (matches.length === 0) {
    return { command: null, matches };
  }
  return { command: matches[0], matches };
}

function refusalForCommand(command, options) {
  const reasons = [];
  if (command.requiresNetwork && !options.allowNetwork) {
    reasons.push("command is marked as requiring network access; pass --allow-network to run it");
  }
  if (command.writesFiles && !options.allowWrites) {
    reasons.push("command is marked as writing files; pass --allow-writes to run it");
  }
  return reasons;
}

function runShellCommand(root, commandText, timeoutMs) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const child = spawn(commandText, [], {
      cwd: root,
      env: {
        ...process.env,
        PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`
      },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        startedAt,
        finishedAt: new Date(),
        exitCode: 127,
        timedOut: false,
        stdout,
        stderr: error.message
      });
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        startedAt,
        finishedAt: new Date(),
        exitCode,
        signal,
        timedOut,
        stdout,
        stderr
      });
    });
  });
}

function durationMs(startedAt, finishedAt) {
  return finishedAt.getTime() - startedAt.getTime();
}

export async function runCommandReceipt({
  root,
  configPath = null,
  name,
  allowNetwork = false,
  allowWrites = false,
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  const scan = await scanRepo({ root, configPath });
  const { command, matches } = findCommand(scan, name);
  const base = {
    schemaVersion: scan.schemaVersion,
    generatedAt: new Date().toISOString(),
    root,
    requestedCommand: name,
    ok: false
  };

  if (!command) {
    return {
      ...base,
      status: "unknown_command",
      error: `Unknown command name: ${name}`,
      availableCommands: scan.commands.map((item) => item.name)
    };
  }

  const sideEffects = {
    requiresNetwork: command.requiresNetwork,
    writesFiles: command.writesFiles,
    risk: command.risk
  };
  const refusalReasons = refusalForCommand(command, { allowNetwork, allowWrites });
  if (refusalReasons.length > 0) {
    return {
      ...base,
      status: "refused",
      command,
      sideEffects,
      refusalReasons,
      availableApprovals: [
        command.requiresNetwork ? "--allow-network" : null,
        command.writesFiles ? "--allow-writes" : null
      ].filter(Boolean)
    };
  }

  const result = await runShellCommand(root, command.command, timeoutMs);
  const finishedAt = result.finishedAt;
  const exitCode = result.timedOut ? 124 : (result.exitCode ?? 1);
  return {
    ...base,
    ok: exitCode === 0,
    status: result.timedOut ? "timed_out" : (exitCode === 0 ? "passed" : "failed"),
    command,
    duplicateCommandCount: matches.length,
    sideEffects,
    approvals: {
      allowNetwork,
      allowWrites
    },
    timeoutMs,
    startedAt: result.startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: durationMs(result.startedAt, finishedAt),
    exitCode,
    signal: result.signal ?? null,
    stdout: outputTail(result.stdout),
    stderr: outputTail(result.stderr),
    outputTruncated: result.stdout.length > MAX_OUTPUT_CHARS || result.stderr.length > MAX_OUTPUT_CHARS
  };
}

export function formatRunReceipt(receipt) {
  const lines = [
    "# Agent Command Receipt",
    "",
    `Command: ${receipt.requestedCommand}`,
    `Status: ${receipt.status}`,
    `Root: ${receipt.root}`
  ];

  if (receipt.command) {
    lines.push(`Resolved: \`${receipt.command.command}\``);
    lines.push(`Source: ${receipt.command.source}`);
  }

  if (receipt.refusalReasons?.length > 0) {
    lines.push("");
    lines.push("## Refused");
    lines.push("");
    for (const reason of receipt.refusalReasons) {
      lines.push(`- ${reason}.`);
    }
    return `${lines.join("\n")}\n`;
  }

  if (receipt.error) {
    lines.push("");
    lines.push(`Error: ${receipt.error}`);
    if (receipt.availableCommands?.length > 0) {
      lines.push(`Available commands: ${receipt.availableCommands.join(", ")}`);
    }
    return `${lines.join("\n")}\n`;
  }

  lines.push(`Exit code: ${receipt.exitCode}`);
  lines.push(`Duration: ${receipt.durationMs}ms`);
  lines.push("");
  lines.push("## Output");
  lines.push("");
  if (receipt.stdout) {
    lines.push("### stdout");
    lines.push("");
    lines.push("```text");
    lines.push(receipt.stdout.trimEnd());
    lines.push("```");
  } else {
    lines.push("- stdout was empty.");
  }
  if (receipt.stderr) {
    lines.push("");
    lines.push("### stderr");
    lines.push("");
    lines.push("```text");
    lines.push(receipt.stderr.trimEnd());
    lines.push("```");
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}
