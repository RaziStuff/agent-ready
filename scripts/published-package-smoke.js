#!/usr/bin/env node
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";

const DEFAULT_REGISTRY = "https://registry.npmjs.org";

function fail(message) {
  throw new Error(message);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

function registryUrl(registry, packageName, suffix = "") {
  const encodedName = packageName.startsWith("@")
    ? packageName.replace("/", "%2F")
    : encodeURIComponent(packageName);
  return new URL(`${encodedName}${suffix}`, registry.endsWith("/") ? registry : `${registry}/`);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { accept: "application/json" } }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`GET ${url} failed with ${response.statusCode}: ${body.trim()}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`GET ${url} returned invalid JSON: ${error.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ status: 127, stdout, stderr: error.message });
    });
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
    if (options.input) {
      child.stdin.write(options.input);
      child.stdin.end();
    }
  });
}

function packageManagerFromCommand(command) {
  const name = path.basename(command).toLowerCase();
  if (name.includes("pnpm")) return "pnpm";
  if (name.includes("npm")) return "npm";
  return null;
}

async function candidateWorks(candidate) {
  const result = await run(candidate.command, [...candidate.baseArgs, "--version"]);
  return result.status === 0;
}

async function findPackageManager() {
  if (process.env.AGENT_READY_PACKAGE_MANAGER) {
    const explicitName = packageManagerFromCommand(process.env.AGENT_READY_PACKAGE_MANAGER);
    if (!explicitName) {
      fail("AGENT_READY_PACKAGE_MANAGER must point to npm or pnpm.");
    }
    const candidate = {
      name: explicitName,
      command: process.env.AGENT_READY_PACKAGE_MANAGER,
      baseArgs: []
    };
    if (!(await candidateWorks(candidate))) {
      fail(`Configured package manager did not run: ${process.env.AGENT_READY_PACKAGE_MANAGER}`);
    }
    return candidate;
  }

  for (const command of ["pnpm", "npm"]) {
    const name = packageManagerFromCommand(command);
    const candidate = { name, command, baseArgs: [] };
    if (await candidateWorks(candidate)) {
      return candidate;
    }
  }

  fail("Could not find npm or pnpm. Set AGENT_READY_PACKAGE_MANAGER to an npm or pnpm executable.");
}

function packageRunnerArgs(packageManager, packageSpec, cliArgs) {
  if (packageManager.name === "pnpm") {
    return [...packageManager.baseArgs, "dlx", packageSpec, ...cliArgs];
  }

  return [
    ...packageManager.baseArgs,
    "exec",
    "--yes",
    "--package",
    packageSpec,
    "--",
    "agent-ready",
    ...cliArgs
  ];
}

async function createTargetRepo(targetRoot) {
  await fs.writeFile(
    path.join(targetRoot, "package.json"),
    JSON.stringify(
      {
        name: "agent-ready-published-smoke-target",
        scripts: {
          test: "node --test"
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.writeFile(path.join(targetRoot, "README.md"), "# Published Smoke Target\n\nTiny target repo.\n", "utf8");
  await fs.mkdir(path.join(targetRoot, "src"), { recursive: true });
  await fs.writeFile(path.join(targetRoot, "src", "index.js"), "export const ok = true;\n", "utf8");
}

async function runPublishedCli(packageManager, packageSpec, cliArgs, env) {
  const result = await run(packageManager.command, packageRunnerArgs(packageManager, packageSpec, cliArgs), { env });
  if (result.status !== 0) {
    fail(`Published package command failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return result.stdout;
}

async function assertRegistryMetadata({ registry, packageJson }) {
  const metadata = await fetchJson(registryUrl(registry, packageJson.name));
  const latest = metadata["dist-tags"]?.latest;
  if (latest !== packageJson.version) {
    fail(`Registry latest tag is ${latest}, expected ${packageJson.version}.`);
  }

  const versionMetadata = metadata.versions?.[packageJson.version]
    ?? await fetchJson(registryUrl(registry, packageJson.name, `/${packageJson.version}`));

  if (versionMetadata.version !== packageJson.version) {
    fail(`Version metadata returned ${versionMetadata.version}, expected ${packageJson.version}.`);
  }
  if (versionMetadata.bin?.["agent-ready"] !== packageJson.bin?.["agent-ready"]) {
    fail(`Published bin path is ${versionMetadata.bin?.["agent-ready"]}, expected ${packageJson.bin?.["agent-ready"]}.`);
  }
  if (!versionMetadata.dist?.tarball) {
    fail("Published version metadata is missing dist.tarball.");
  }
  if (!metadata.readme?.includes("npx -y @ahmedshaikh/agent-ready@latest")) {
    fail("Registry metadata README is missing the published-package quick start.");
  }
}

async function main() {
  const packageJson = await readJson(path.join(process.cwd(), "package.json"));
  const registry = process.env.AGENT_READY_REGISTRY ?? DEFAULT_REGISTRY;
  const packageSpec = process.env.AGENT_READY_PUBLISHED_SPEC ?? `${packageJson.name}@${packageJson.version}`;
  const packageManager = await findPackageManager();
  const smokeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-published-smoke-"));
  const targetRoot = path.join(smokeRoot, "target");
  const env = {
    ...process.env,
    HOME: path.join(smokeRoot, "home"),
    XDG_CACHE_HOME: path.join(smokeRoot, "cache"),
    npm_config_registry: registry,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`
  };

  try {
    await assertRegistryMetadata({ registry, packageJson });
    await fs.mkdir(env.HOME, { recursive: true });
    await fs.mkdir(env.XDG_CACHE_HOME, { recursive: true });
    await fs.mkdir(targetRoot, { recursive: true });
    await createTargetRepo(targetRoot);

    const version = (await runPublishedCli(packageManager, packageSpec, ["--version"], env)).trim();
    if (version !== packageJson.version) {
      fail(`Published package returned version ${version}, expected ${packageJson.version}.`);
    }

    await runPublishedCli(packageManager, packageSpec, ["init", "--root", targetRoot], env);
    await runPublishedCli(packageManager, packageSpec, ["validate", "--root", targetRoot, "--strict"], env);
    const statusJson = await runPublishedCli(packageManager, packageSpec, ["status", "--root", targetRoot, "--json"], env);
    const status = JSON.parse(statusJson);
    if (status.schemaVersion !== "0.1.0" || status.ok !== true || status.doctor?.ok !== true) {
      fail(`Published package status --json did not return an ok status report: ${JSON.stringify({
        ok: status.ok,
        status: status.status,
        doctor: status.doctor
      })}`);
    }

    console.log(`Published package smoke check passed for ${packageSpec}.`);
  } finally {
    await fs.rm(smokeRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`error: ${error.message}`);
  process.exitCode = 1;
});
