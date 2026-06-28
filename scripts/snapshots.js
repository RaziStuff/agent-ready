#!/usr/bin/env node
import process from "node:process";
import {
  commandsSnapshotPath,
  readSnapshot,
  readCommandsSnapshot,
  readRepoMapSnapshot,
  renderAgentsMdSnapshot,
  renderCommandsSnapshot,
  renderRepoMapSnapshot,
  repoMapSnapshotPath,
  SNAPSHOT_CASES,
  snapshotPath,
  writeCommandsSnapshot,
  writeRepoMapSnapshot,
  writeSnapshot
} from "../tests/snapshot-utils.js";

function help() {
  console.log(`agent-ready snapshot helper

Usage:
  node scripts/snapshots.js --check
  node scripts/snapshots.js --write

Modes:
  --check   Compare generated AGENTS.md and metadata output to checked-in snapshots.
  --write   Regenerate tests/snapshots/*.agents.md, *.repo-map.json, and *.commands.json from examples/.
`);
}

function parseMode(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return "help";
  }
  if (argv.includes("--write")) {
    return "write";
  }
  return "check";
}

async function checkSnapshots() {
  const mismatches = [];

  for (const fixtureName of SNAPSHOT_CASES) {
    const checks = [
      {
        label: "AGENTS.md",
        path: snapshotPath(fixtureName),
        actual: await renderAgentsMdSnapshot(fixtureName),
        expected: await readSnapshot(fixtureName)
      },
      {
        label: "repo-map.json",
        path: repoMapSnapshotPath(fixtureName),
        actual: await renderRepoMapSnapshot(fixtureName),
        expected: await readRepoMapSnapshot(fixtureName)
      },
      {
        label: "commands.json",
        path: commandsSnapshotPath(fixtureName),
        actual: await renderCommandsSnapshot(fixtureName),
        expected: await readCommandsSnapshot(fixtureName)
      }
    ];

    for (const check of checks) {
      if (check.actual === check.expected) {
        continue;
      }
      mismatches.push(`${fixtureName}:${check.label}`);
      console.error(`Snapshot mismatch: ${check.path}`);
    }
  }

  if (mismatches.length > 0) {
    console.error("");
    console.error("Run `npm run snapshots:update` if these output changes are intentional.");
    process.exitCode = 1;
    return;
  }

  console.log(`Snapshots current (${SNAPSHOT_CASES.length * 3} checked).`);
}

async function writeSnapshots() {
  for (const fixtureName of SNAPSHOT_CASES) {
    for (const write of [writeSnapshot, writeRepoMapSnapshot, writeCommandsSnapshot]) {
      const outputPath = await write(fixtureName);
      console.log(`Wrote ${outputPath}`);
    }
  }
}

const mode = parseMode(process.argv.slice(2));

if (mode === "help") {
  help();
} else if (mode === "write") {
  await writeSnapshots();
} else {
  await checkSnapshots();
}
