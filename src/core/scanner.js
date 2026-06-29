import path from "node:path";
import { loadAgentReadyConfig } from "./config.js";
import {
  LANGUAGE_EXTENSIONS,
  RISK_PATH_RULES,
  SCHEMA_VERSION,
  TOP_LEVEL_DIR_ROLES
} from "./constants.js";
import {
  isSafeEnvExample,
  isSecretLikePath,
  pathMatchesPattern,
  readJsonFile,
  readTextFileIfSafe,
  walkRepo
} from "./inventory.js";

function confidence(value) {
  return Number(value.toFixed(2));
}

function addEvidence(evidence, message) {
  evidence.push(message);
  return message;
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(item);
  }
  return result;
}

function sortByName(items) {
  return [...items].sort((a, b) => String(a.name ?? a.path).localeCompare(String(b.name ?? b.path)));
}

function uniqueStrings(items) {
  return [...new Set(items.filter(Boolean))];
}

function commandRisk(name) {
  if (name === "install") {
    return { requiresNetwork: true, writesFiles: true, risk: "medium" };
  }
  if (name === "build" || name === "dev" || name === "format") {
    return { requiresNetwork: false, writesFiles: true, risk: "low" };
  }
  return { requiresNetwork: false, writesFiles: false, risk: "low" };
}

function command(name, commandText, source, confidenceValue, overrides = {}) {
  return {
    name,
    command: commandText,
    source,
    confidence: confidence(confidenceValue),
    ...commandRisk(name),
    ...overrides
  };
}

const COMMON_TARGETS = new Set([
  "test",
  "lint",
  "build",
  "install",
  "format",
  "typecheck",
  "verify",
  "check",
  "ci",
  "dev"
]);

function nodeInstallCommand(packageManager) {
  if (packageManager === "pnpm") return "pnpm install";
  if (packageManager === "yarn") return "yarn install";
  if (packageManager === "bun") return "bun install";
  return "npm install";
}

function nodeScriptCommand(packageManager, scriptName) {
  if (packageManager === "pnpm") return `pnpm ${scriptName}`;
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  if (packageManager === "bun") return `bun run ${scriptName}`;
  if (packageManager === "npm" && scriptName === "test") return "npm test";
  return `npm run ${scriptName}`;
}

function detectPackageManagers(files, evidence) {
  const managers = [];
  const add = (name, file, score) => {
    managers.push({
      name,
      confidence: confidence(score),
      evidence: [addEvidence(evidence, `Detected ${name} from ${file}.`)]
    });
  };

  if (files.has("pnpm-lock.yaml")) add("pnpm", "pnpm-lock.yaml", 0.98);
  if (files.has("yarn.lock")) add("yarn", "yarn.lock", 0.96);
  if (files.has("package-lock.json")) add("npm", "package-lock.json", 0.95);
  if (files.has("bun.lock") || files.has("bun.lockb")) add("bun", files.has("bun.lock") ? "bun.lock" : "bun.lockb", 0.96);
  if (files.has("uv.lock")) add("uv", "uv.lock", 0.96);
  if (files.has("poetry.lock")) add("poetry", "poetry.lock", 0.94);
  if (files.has("Pipfile.lock")) add("pipenv", "Pipfile.lock", 0.92);
  if (files.has("requirements.txt")) add("pip", "requirements.txt", 0.75);
  if (files.has("go.mod")) add("go modules", "go.mod", 0.98);
  if (files.has("Cargo.lock") || files.has("Cargo.toml")) add("cargo", files.has("Cargo.lock") ? "Cargo.lock" : "Cargo.toml", 0.96);
  if (files.has("Gemfile.lock") || files.has("Gemfile")) add("bundler", files.has("Gemfile.lock") ? "Gemfile.lock" : "Gemfile", files.has("Gemfile.lock") ? 0.92 : 0.82);
  if (files.has("composer.lock") || files.has("composer.json")) add("composer", files.has("composer.lock") ? "composer.lock" : "composer.json", files.has("composer.lock") ? 0.92 : 0.82);
  if (files.has("pom.xml") || files.has("mvnw")) add("maven", files.has("mvnw") ? "mvnw" : "pom.xml", files.has("mvnw") ? 0.96 : 0.88);
  if (files.has("build.gradle") || files.has("build.gradle.kts") || files.has("gradlew")) add("gradle", files.has("gradlew") ? "gradlew" : (files.has("build.gradle.kts") ? "build.gradle.kts" : "build.gradle"), files.has("gradlew") ? 0.96 : 0.88);
  if ([...files].some((file) => file.endsWith(".sln") || file.endsWith(".csproj"))) add("dotnet", ".sln/.csproj", 0.9);

  const hasNodeManager = managers.some((manager) => ["pnpm", "yarn", "npm", "bun"].includes(manager.name));
  if (!hasNodeManager && files.has("package.json")) {
    add("npm", "package.json fallback", 0.62);
  }

  return uniqueBy(managers, (item) => item.name);
}

function detectLanguages(files, entries, evidence) {
  const counts = new Map();
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    const language = LANGUAGE_EXTENSIONS.get(entry.extension);
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const manifestSignals = [
    ["package.json", "JavaScript", 0.78],
    ["tsconfig.json", "TypeScript", 0.9],
    ["pyproject.toml", "Python", 0.9],
    ["requirements.txt", "Python", 0.75],
    ["go.mod", "Go", 0.95],
    ["Cargo.toml", "Rust", 0.95],
    ["pom.xml", "Java", 0.8],
    ["build.gradle", "Java", 0.75],
    ["build.gradle.kts", "Java", 0.75],
    ["Gemfile", "Ruby", 0.8],
    ["composer.json", "PHP", 0.8]
  ];

  const manifestScores = new Map();
  for (const [file, language, score] of manifestSignals) {
    if (files.has(file)) {
      manifestScores.set(language, Math.max(manifestScores.get(language) ?? 0, score));
    }
  }

  if ([...files].some((file) => file.endsWith(".csproj") || file.endsWith(".sln"))) {
    manifestScores.set("C#", Math.max(manifestScores.get("C#") ?? 0, 0.88));
  }

  const totalCount = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const languages = new Map();

  for (const [name, count] of counts) {
    const ratio = totalCount > 0 ? count / totalCount : 0;
    languages.set(name, {
      name,
      fileCount: count,
      confidence: confidence(Math.min(0.95, 0.55 + ratio * 0.4)),
      evidence: [addEvidence(evidence, `Detected ${count} ${name} file${count === 1 ? "" : "s"}.`)]
    });
  }

  for (const [name, score] of manifestScores) {
    const existing = languages.get(name);
    if (existing) {
      existing.confidence = confidence(Math.max(existing.confidence, score));
      existing.evidence.push(addEvidence(evidence, `Detected ${name} manifest signal.`));
      continue;
    }
    languages.set(name, {
      name,
      fileCount: 0,
      confidence: confidence(score),
      evidence: [addEvidence(evidence, `Detected ${name} manifest signal.`)]
    });
  }

  return sortByName([...languages.values()]);
}

function detectDirectories(entries, config) {
  const topLevelDirs = entries
    .filter((entry) => entry.kind === "directory" && !entry.path.includes("/"))
    .map((entry) => entry.path);

  return topLevelDirs.map((dir) => {
    const configuredRole = config.directoryRoles?.[dir];
    if (configuredRole) {
      return {
        path: dir,
        role: configuredRole,
        confidence: 1
      };
    }

    const match = TOP_LEVEL_DIR_ROLES.find((rule) => rule.pattern.test(dir));
    return {
      path: dir,
      role: match?.role ?? "project directory",
      confidence: match ? 0.85 : 0.55
    };
  });
}

function detectEntrypoints(files) {
  const candidates = [
    ["src/index.ts", "library or app entrypoint"],
    ["src/index.tsx", "frontend entrypoint"],
    ["src/main.ts", "application entrypoint"],
    ["src/main.tsx", "frontend entrypoint"],
    ["index.js", "Node.js entrypoint"],
    ["server.js", "server entrypoint"],
    ["app/page.tsx", "Next.js app route"],
    ["pages/index.tsx", "Next.js page route"],
    ["main.py", "Python entrypoint"],
    ["app/main.py", "Python application entrypoint"],
    ["app.py", "Python application entrypoint"],
    ["manage.py", "Django management entrypoint"],
    ["main.go", "Go entrypoint"],
    ["src/main.rs", "Rust binary entrypoint"],
    ["Cargo.toml", "Rust package manifest"],
    ["config/application.rb", "Rails application config"],
    ["bin/rails", "Rails command entrypoint"],
    ["artisan", "Laravel Artisan command entrypoint"],
    ["public/index.php", "PHP web front controller"],
    ["routes/web.php", "Laravel web routes"],
    ["routes/api.php", "Laravel API routes"],
    ["Program.cs", ".NET application entrypoint"]
  ];

  const entrypoints = [];
  for (const [file, kind] of candidates) {
    if (files.has(file)) {
      entrypoints.push({ path: file, kind, confidence: 0.82 });
    }
  }

  for (const file of files) {
    if (/^cmd\/[^/]+\/main\.go$/.test(file)) {
      entrypoints.push({ path: file, kind: "Go command entrypoint", confidence: 0.88 });
    }
    if (/^src\/main\/java\/.+Application\.java$/.test(file)) {
      entrypoints.push({ path: file, kind: "Spring Boot application entrypoint", confidence: 0.88 });
    }
    if (/(^|\/)Program\.cs$/.test(file)) {
      entrypoints.push({ path: file, kind: ".NET application entrypoint", confidence: 0.84 });
    }
  }

  return entrypoints;
}

function allDependencies(packageJson) {
  return {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
    ...(packageJson.peerDependencies ?? {}),
    ...(packageJson.optionalDependencies ?? {})
  };
}

function workspaceArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  if (value && typeof value === "object" && Array.isArray(value.packages)) {
    return value.packages.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim());
  }
  return [];
}

function cleanYamlScalar(value) {
  return value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();
}

function parsePnpmWorkspacePackages(content) {
  if (!content) {
    return [];
  }

  const patterns = [];
  let inPackages = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (/^packages\s*:/.test(trimmed)) {
      inPackages = true;
      continue;
    }

    if (!inPackages) {
      continue;
    }

    if (/^[A-Za-z0-9_-]+\s*:/.test(trimmed)) {
      break;
    }

    const match = trimmed.match(/^-\s+(.+)$/);
    if (match) {
      const pattern = cleanYamlScalar(match[1]);
      if (pattern) {
        patterns.push(pattern);
      }
    }
  }

  return patterns;
}

function normalizeWorkspacePattern(pattern) {
  return pattern
    .replace(/^!/, "")
    .replace(/\/package\.json$/, "")
    .replace(/\/$/, "")
    .trim();
}

function packagePathFromManifest(packageManifestPath) {
  const dir = path.posix.dirname(packageManifestPath);
  return dir === "." ? "" : dir;
}

function patternMatchesWorkspacePackage(packagePath, pattern) {
  const normalized = normalizeWorkspacePattern(pattern);
  if (!normalized || packagePath === "") {
    return false;
  }
  return pathMatchesPattern(packagePath, normalized);
}

function inferWorkspacePackagePaths(files) {
  const paths = [];
  const conventionalWorkspaceDir = /^(apps|packages|services|libs)\/[^/]+\/package\.json$/;
  for (const file of files) {
    if (conventionalWorkspaceDir.test(file)) {
      paths.push(packagePathFromManifest(file));
    }
  }
  return paths;
}

function addMonorepoTool(tools, evidence, name, source, confidenceValue) {
  if (tools.some((tool) => tool.name === name)) {
    return;
  }

  tools.push({
    name,
    source,
    confidence: confidence(confidenceValue),
    evidence: [addEvidence(evidence, `Detected ${name} from ${source}.`)]
  });
}

async function readWorkspacePackages(root, files, workspaceGlobs, evidence) {
  const packageManifestFiles = [...files].filter((file) => file.endsWith("/package.json"));
  const positivePatterns = workspaceGlobs
    .map((item) => item.pattern)
    .filter((pattern) => !pattern.startsWith("!"));
  const negativePatterns = workspaceGlobs
    .map((item) => item.pattern)
    .filter((pattern) => pattern.startsWith("!"));

  const packagePaths = new Set();
  for (const packageManifestFile of packageManifestFiles) {
    const packagePath = packagePathFromManifest(packageManifestFile);
    const matched = positivePatterns.some((pattern) => patternMatchesWorkspacePackage(packagePath, pattern));
    const excluded = negativePatterns.some((pattern) => patternMatchesWorkspacePackage(packagePath, pattern));
    if (matched && !excluded) {
      packagePaths.add(packagePath);
    }
  }

  if (packagePaths.size === 0 && workspaceGlobs.length === 0) {
    for (const packagePath of inferWorkspacePackagePaths(files)) {
      packagePaths.add(packagePath);
    }
  }

  const packages = [];
  for (const packagePath of [...packagePaths].sort()) {
    const manifestPath = `${packagePath}/package.json`;
    const packageJson = await readJsonFile(path.join(root, manifestPath));
    if (!packageJson) {
      continue;
    }

    packages.push({
      path: packagePath,
      name: typeof packageJson.name === "string" && packageJson.name.trim()
        ? packageJson.name.trim()
        : path.posix.basename(packagePath),
      private: packageJson.private === true,
      scripts: Object.keys(packageJson.scripts ?? {}).sort().slice(0, 20)
    });
  }

  if (packages.length > 0) {
    addEvidence(evidence, `Detected ${packages.length} workspace package${packages.length === 1 ? "" : "s"}.`);
  }

  return packages;
}

function workspaceCommandText({ scriptName, monorepo, packageManager }) {
  const toolNames = monorepo.tools.map((tool) => tool.name);
  if (toolNames.includes("Turborepo")) {
    return `turbo run ${scriptName}`;
  }
  if (toolNames.includes("Nx")) {
    return `nx run-many -t ${scriptName}`;
  }
  if (packageManager === "pnpm") {
    return `pnpm -r ${scriptName}`;
  }
  if (packageManager === "yarn") {
    return `yarn workspaces foreach -pt run ${scriptName}`;
  }
  if (packageManager === "npm") {
    return scriptName === "test" ? "npm test --workspaces" : `npm run ${scriptName} --workspaces`;
  }
  return null;
}

function detectMonorepoCommands(monorepo, packageManagers, evidence) {
  if (!monorepo.detected || monorepo.packages.length === 0) {
    return [];
  }

  const packageManager = packageManagers.find((manager) => ["pnpm", "yarn", "npm"].includes(manager.name))?.name ?? "npm";
  const scriptNames = new Set(monorepo.packages.flatMap((workspacePackage) => workspacePackage.scripts));
  const commonScripts = [
    ["test", "workspace test"],
    ["lint", "workspace lint"],
    ["typecheck", "workspace typecheck"],
    ["build", "workspace build"]
  ];

  const commands = [];
  for (const [scriptName, label] of commonScripts) {
    if (!scriptNames.has(scriptName)) {
      continue;
    }

    const commandText = workspaceCommandText({ scriptName, monorepo, packageManager });
    if (!commandText) {
      continue;
    }

    commands.push(command(label, commandText, "workspace package scripts", 0.74, commandRisk(scriptName)));
    addEvidence(evidence, `Detected workspace script "${scriptName}" across package manifests.`);
  }

  return commands;
}

async function detectMonorepo(root, files, packageManagers, evidence) {
  const tools = [];
  const workspaceGlobs = [];
  const addWorkspaceGlob = (pattern, source) => {
    if (!pattern || workspaceGlobs.some((item) => item.pattern === pattern && item.source === source)) {
      return;
    }
    workspaceGlobs.push({ pattern, source });
  };

  const packageJson = files.has("package.json") ? await readJsonFile(path.join(root, "package.json")) : null;
  const packageWorkspaces = workspaceArray(packageJson?.workspaces);
  for (const pattern of packageWorkspaces) {
    addWorkspaceGlob(pattern, "package.json:workspaces");
  }

  if (packageWorkspaces.length > 0) {
    if (packageManagers.some((manager) => manager.name === "pnpm")) {
      addMonorepoTool(tools, evidence, "pnpm workspaces", "package.json:workspaces", 0.84);
    }
    if (packageManagers.some((manager) => manager.name === "yarn")) {
      addMonorepoTool(tools, evidence, "Yarn workspaces", "package.json:workspaces", 0.84);
    }
    if (packageManagers.some((manager) => manager.name === "npm")) {
      addMonorepoTool(tools, evidence, "npm workspaces", "package.json:workspaces", 0.82);
    }
    if (tools.length === 0) {
      addMonorepoTool(tools, evidence, "package.json workspaces", "package.json:workspaces", 0.74);
    }
  }

  if (files.has("pnpm-workspace.yaml")) {
    const content = await readTextFileIfSafe(root, "pnpm-workspace.yaml");
    const pnpmPatterns = parsePnpmWorkspacePackages(content);
    for (const pattern of pnpmPatterns) {
      addWorkspaceGlob(pattern, "pnpm-workspace.yaml");
    }
    addMonorepoTool(tools, evidence, "pnpm workspaces", "pnpm-workspace.yaml", 0.96);
  }

  if (files.has("turbo.json")) {
    addMonorepoTool(tools, evidence, "Turborepo", "turbo.json", 0.95);
  }

  if (files.has("nx.json")) {
    addMonorepoTool(tools, evidence, "Nx", "nx.json", 0.95);
  }

  if (workspaceGlobs.length === 0 && (files.has("turbo.json") || files.has("nx.json"))) {
    for (const packagePath of inferWorkspacePackagePaths(files)) {
      addWorkspaceGlob(`${packagePath}`, "conventional workspace directories");
    }
  }

  const packages = await readWorkspacePackages(root, files, workspaceGlobs, evidence);
  const detected = workspaceGlobs.length > 0 || tools.length > 0 || packages.length > 1;

  return {
    detected,
    kind: detected ? "monorepo" : "single-package",
    tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
    workspaceGlobs: workspaceGlobs.sort((a, b) => a.pattern.localeCompare(b.pattern) || a.source.localeCompare(b.source)),
    packages,
    packageCount: packages.length
  };
}

async function detectNode(root, files, packageManagers, evidence) {
  const result = {
    frameworks: [],
    commands: [],
    purpose: null
  };

  if (!files.has("package.json")) {
    return result;
  }

  const packageJson = await readJsonFile(path.join(root, "package.json"));
  if (!packageJson) {
    return result;
  }

  const nodeManagers = ["pnpm", "yarn", "bun", "npm"];
  const managerSignal = packageManagers.find((manager) => nodeManagers.includes(manager.name));
  const packageManager = managerSignal?.name ?? "npm";
  const installConfidence = Math.min(0.9, managerSignal?.confidence ?? 0.62);
  result.commands.push(command("install", nodeInstallCommand(packageManager), "package manager detection", installConfidence));

  if (packageJson.description) {
    result.purpose = packageJson.description;
  }

  const scripts = packageJson.scripts ?? {};
  const scriptNames = Object.keys(scripts);
  const commonScripts = [
    ["test", "test"],
    ["test:unit", "unit tests"],
    ["test:e2e", "end-to-end tests"],
    ["lint", "lint"],
    ["typecheck", "typecheck"],
    ["build", "build"],
    ["dev", "dev server"],
    ["format", "format"]
  ];

  for (const [scriptName, label] of commonScripts) {
    if (scriptNames.includes(scriptName)) {
      result.commands.push(command(label, nodeScriptCommand(packageManager, scriptName), `package.json:scripts.${scriptName}`, 0.92));
      addEvidence(evidence, `Detected script "${scriptName}" in package.json.`);
    }
  }

  const deps = allDependencies(packageJson);
  const frameworkSignals = [
    ["next", "Next.js"],
    ["react", "React"],
    ["vite", "Vite"],
    ["vue", "Vue"],
    ["@sveltejs/kit", "SvelteKit"],
    ["@remix-run/node", "Remix"],
    ["express", "Express"],
    ["fastify", "Fastify"],
    ["@nestjs/core", "NestJS"]
  ];

  for (const [dependency, framework] of frameworkSignals) {
    if (deps[dependency]) {
      result.frameworks.push({
        name: framework,
        confidence: 0.92,
        evidence: [addEvidence(evidence, `Detected ${framework} from package.json dependency ${dependency}.`)]
      });
    }
  }

  if (files.has("next.config.js") || files.has("next.config.mjs") || files.has("next.config.ts")) {
    result.frameworks.push({
      name: "Next.js",
      confidence: 0.95,
      evidence: [addEvidence(evidence, "Detected Next.js config file.")]
    });
  }

  return result;
}

async function detectPython(root, files, evidence) {
  const commands = [];
  const frameworks = [];
  const pyproject = files.has("pyproject.toml") ? await readTextFileIfSafe(root, "pyproject.toml") : null;
  const requirements = files.has("requirements.txt") ? await readTextFileIfSafe(root, "requirements.txt") : null;

  if (files.has("uv.lock")) {
    commands.push(command("install", "uv sync", "uv.lock", 0.9));
  } else if (files.has("poetry.lock") || pyproject?.includes("[tool.poetry]")) {
    commands.push(command("install", "poetry install", "poetry", 0.88));
  } else if (files.has("requirements.txt")) {
    commands.push(command("install", "python -m pip install -r requirements.txt", "requirements.txt", 0.78));
  }

  const hasPytest = pyproject?.includes("pytest") || [...files].some((file) => /(^|\/)(test_.*|.*_test)\.py$/.test(file));
  if (hasPytest) {
    commands.push(command("test", "python -m pytest", "pytest detection", 0.82));
    addEvidence(evidence, "Detected pytest from Python config or test file names.");
  }

  if (pyproject?.includes("ruff")) {
    commands.push(command("lint", "ruff check .", "pyproject.toml", 0.82));
    addEvidence(evidence, "Detected ruff from pyproject.toml.");
  }
  if (pyproject?.includes("mypy")) {
    commands.push(command("typecheck", "mypy .", "pyproject.toml", 0.78));
    addEvidence(evidence, "Detected mypy from pyproject.toml.");
  }
  if (pyproject?.includes("black")) {
    commands.push(command("format", "black .", "pyproject.toml", 0.74));
    addEvidence(evidence, "Detected black from pyproject.toml.");
  }

  const pyText = `${pyproject ?? ""}\n${requirements ?? ""}`;
  const frameworkSignals = [
    ["django", "Django"],
    ["fastapi", "FastAPI"],
    ["flask", "Flask"],
    ["celery", "Celery"]
  ];
  for (const [needle, name] of frameworkSignals) {
    if (pyText.toLowerCase().includes(needle) || (name === "Django" && files.has("manage.py"))) {
      frameworks.push({
        name,
        confidence: 0.82,
        evidence: [addEvidence(evidence, `Detected ${name} from Python project files.`)]
      });
    }
  }

  const hasDjango = frameworks.some((item) => item.name === "Django");
  if (hasDjango && !hasPytest && files.has("manage.py")) {
    commands.push(command("test", "python manage.py test", "manage.py", 0.82));
    addEvidence(evidence, "Detected Django test command from manage.py.");
  }

  return { commands, frameworks };
}

async function detectRuby(root, files, evidence) {
  const commands = [];
  const frameworks = [];
  const gemfile = files.has("Gemfile") ? await readTextFileIfSafe(root, "Gemfile") : null;
  const rubyText = gemfile ?? "";

  if (!files.has("Gemfile") && !files.has("config/application.rb") && !files.has("bin/rails")) {
    return { commands, frameworks };
  }

  if (files.has("Gemfile")) {
    commands.push(command("install", "bundle install", "Gemfile", 0.88));
  }

  const hasRails = /gem\s+["']rails["']/.test(rubyText) || files.has("config/application.rb") || files.has("bin/rails");
  if (hasRails) {
    frameworks.push({
      name: "Rails",
      confidence: 0.92,
      evidence: [addEvidence(evidence, "Detected Rails from Gemfile or Rails config files.")]
    });
  }

  const hasRspec = /gem\s+["']rspec/.test(rubyText) || [...files].some((file) => /^spec\/.+_spec\.rb$/.test(file));
  if (hasRspec) {
    commands.push(command("test", "bundle exec rspec", "RSpec detection", 0.84));
    addEvidence(evidence, "Detected RSpec from Ruby project files.");
  } else if (hasRails) {
    commands.push(command("test", files.has("bin/rails") ? "bin/rails test" : "bundle exec rails test", "Rails detection", 0.82));
  }

  if (/gem\s+["']rubocop["']/.test(rubyText)) {
    commands.push(command("lint", "bundle exec rubocop", "Gemfile:rubocop", 0.78));
    addEvidence(evidence, "Detected RuboCop from Gemfile.");
  }

  return { commands, frameworks };
}

function composerDependencies(composerJson) {
  return {
    ...(composerJson?.require ?? {}),
    ...(composerJson?.["require-dev"] ?? {})
  };
}

function hasComposerDependency(deps, name) {
  return Object.prototype.hasOwnProperty.call(deps, name);
}

async function detectPhp(root, files, evidence) {
  const commands = [];
  const frameworks = [];
  const composerJson = files.has("composer.json") ? await readJsonFile(path.join(root, "composer.json")) : null;
  const deps = composerDependencies(composerJson);
  const purpose = typeof composerJson?.description === "string" && composerJson.description.trim()
    ? composerJson.description.trim()
    : null;

  if (!composerJson && !files.has("artisan") && !files.has("public/index.php")) {
    return { commands, frameworks, purpose };
  }

  if (composerJson) {
    commands.push(command("install", "composer install", files.has("composer.lock") ? "composer.lock" : "composer.json", files.has("composer.lock") ? 0.9 : 0.82));
  }

  const hasLaravel = hasComposerDependency(deps, "laravel/framework")
    || files.has("artisan")
    || files.has("bootstrap/app.php")
    || files.has("routes/web.php");
  if (hasLaravel) {
    frameworks.push({
      name: "Laravel",
      confidence: 0.92,
      evidence: [addEvidence(evidence, "Detected Laravel from Composer dependencies or Laravel project files.")]
    });
    commands.push(command("test", "php artisan test", "Laravel detection", 0.86));
    commands.push(command("serve", "php artisan serve", "Laravel detection", 0.78));
    commands.push(command("migrate", "php artisan migrate", "Laravel detection", 0.72, {
      requiresNetwork: false,
      writesFiles: true,
      risk: "high"
    }));
  }

  const hasPhpUnit = hasComposerDependency(deps, "phpunit/phpunit")
    || files.has("phpunit.xml")
    || files.has("phpunit.xml.dist")
    || [...files].some((file) => /^tests\/.+Test\.php$/.test(file));
  if (hasPhpUnit && !commands.some((item) => item.name === "test")) {
    commands.push(command("test", "vendor/bin/phpunit", "PHPUnit detection", 0.84));
    addEvidence(evidence, "Detected PHPUnit from PHP project files.");
  }

  if (hasComposerDependency(deps, "laravel/pint")) {
    commands.push(command("lint", "vendor/bin/pint --test", "composer.json:laravel/pint", 0.78));
    addEvidence(evidence, "Detected Laravel Pint from composer.json.");
  }

  const composerScripts = composerJson?.scripts ?? {};
  const composerScriptLabels = [
    ["test", "test"],
    ["lint", "lint"],
    ["format", "format"],
    ["analyse", "typecheck"],
    ["analyze", "typecheck"],
    ["stan", "typecheck"]
  ];
  for (const [scriptName, label] of composerScriptLabels) {
    if (!Object.prototype.hasOwnProperty.call(composerScripts, scriptName)) {
      continue;
    }
    if (commands.some((item) => item.name === label)) {
      continue;
    }
    commands.push(command(label, `composer ${scriptName}`, `composer.json:scripts.${scriptName}`, 0.82));
    addEvidence(evidence, `Detected script "${scriptName}" in composer.json.`);
  }

  return { commands, frameworks, purpose };
}

async function detectJava(root, files, evidence) {
  const commands = [];
  const frameworks = [];
  const pom = files.has("pom.xml") ? await readTextFileIfSafe(root, "pom.xml", { maxReadBytes: 256 * 1024 }) : null;
  const gradlePath = files.has("build.gradle.kts") ? "build.gradle.kts" : (files.has("build.gradle") ? "build.gradle" : null);
  const gradle = gradlePath ? await readTextFileIfSafe(root, gradlePath, { maxReadBytes: 256 * 1024 }) : null;

  if (!pom && !gradle && !files.has("mvnw") && !files.has("gradlew")) {
    return { commands, frameworks };
  }

  const usesGradle = Boolean(gradle || files.has("gradlew"));
  const usesMaven = Boolean(pom || files.has("mvnw"));
  const buildTool = usesMaven ? "maven" : "gradle";
  const toolCommand = buildTool === "maven"
    ? (files.has("mvnw") ? "./mvnw" : "mvn")
    : (files.has("gradlew") ? "./gradlew" : "gradle");

  if (buildTool === "maven") {
    commands.push(command("test", `${toolCommand} test`, files.has("mvnw") ? "mvnw" : "pom.xml", 0.88));
    commands.push(command("build", `${toolCommand} package`, files.has("mvnw") ? "mvnw" : "pom.xml", 0.82));
  } else {
    commands.push(command("test", `${toolCommand} test`, files.has("gradlew") ? "gradlew" : gradlePath, 0.88));
    commands.push(command("build", `${toolCommand} build`, files.has("gradlew") ? "gradlew" : gradlePath, 0.82));
  }

  const javaText = `${pom ?? ""}\n${gradle ?? ""}`;
  const hasSpring = /spring-boot|org\.springframework\.boot|SpringBootApplication/.test(javaText)
    || [...files].some((file) => /^src\/main\/java\/.+Application\.java$/.test(file));
  if (hasSpring) {
    frameworks.push({
      name: "Spring Boot",
      confidence: 0.9,
      evidence: [addEvidence(evidence, "Detected Spring Boot from Java build files or application entrypoint.")]
    });
  }

  return { commands, frameworks };
}

async function detectDotnet(root, files, evidence) {
  const commands = [];
  const frameworks = [];
  const solution = [...files].find((file) => file.endsWith(".sln"));
  const projectFiles = [...files].filter((file) => file.endsWith(".csproj")).sort();
  const firstProject = projectFiles[0] ?? null;

  if (!solution && !firstProject) {
    return { commands, frameworks };
  }

  const source = solution ?? firstProject;
  commands.push(command("install", "dotnet restore", source, 0.86));
  commands.push(command("build", "dotnet build", source, 0.86));
  commands.push(command("test", "dotnet test", source, 0.82));

  let projectText = "";
  if (firstProject) {
    projectText = await readTextFileIfSafe(root, firstProject, { maxReadBytes: 128 * 1024 }) ?? "";
  }

  const hasAspNet = /Microsoft\.NET\.Sdk\.Web|Microsoft\.AspNetCore|AspNetCore/.test(projectText)
    || files.has("appsettings.json")
    || [...files].some((file) => /(^|\/)Program\.cs$/.test(file));
  if (hasAspNet) {
    frameworks.push({
      name: "ASP.NET Core",
      confidence: 0.88,
      evidence: [addEvidence(evidence, "Detected ASP.NET Core from .NET project files.")]
    });
  }

  return { commands, frameworks };
}

function detectGo(files, evidence) {
  if (!files.has("go.mod")) {
    return { commands: [], frameworks: [] };
  }

  addEvidence(evidence, "Detected Go module from go.mod.");
  return {
    commands: [
      command("test", "go test ./...", "go.mod", 0.9),
      command("build", "go build ./...", "go.mod", 0.78),
      command("lint", "go vet ./...", "go.mod", 0.68)
    ],
    frameworks: []
  };
}

function detectRust(files, evidence) {
  if (!files.has("Cargo.toml")) {
    return { commands: [], frameworks: [] };
  }

  addEvidence(evidence, "Detected Rust package from Cargo.toml.");
  return {
    commands: [
      command("test", "cargo test", "Cargo.toml", 0.9),
      command("typecheck", "cargo check", "Cargo.toml", 0.84),
      command("lint", "cargo clippy", "Cargo.toml", 0.72),
      command("format", "cargo fmt --check", "Cargo.toml", 0.72)
    ],
    frameworks: []
  };
}

async function detectMakefile(root, files, evidence) {
  if (!files.has("Makefile")) {
    return [];
  }

  const content = await readTextFileIfSafe(root, "Makefile");
  if (!content) {
    return [];
  }

  const commands = [];
  const targetPattern = /^([A-Za-z0-9_.-]+):(?:\s|$)/gm;
  let match;
  while ((match = targetPattern.exec(content))) {
    const target = match[1];
    if (["test", "lint", "build", "install", "format", "typecheck"].includes(target)) {
      commands.push(command(target, `make ${target}`, `Makefile:${target}`, 0.74));
      addEvidence(evidence, `Detected Makefile target "${target}".`);
    }
  }
  return commands;
}

function justfilePath(files) {
  return ["justfile", "Justfile", ".justfile"].find((file) => files.has(file)) ?? null;
}

async function detectJustfile(root, files, evidence) {
  const file = justfilePath(files);
  if (!file) {
    return [];
  }

  const content = await readTextFileIfSafe(root, file);
  if (!content) {
    return [];
  }

  const commands = [];
  const targetPattern = /^([A-Za-z0-9_.-]+)(?:\s+[^:=][^:]*)?:/gm;
  let match;
  while ((match = targetPattern.exec(content))) {
    const target = match[1];
    if (COMMON_TARGETS.has(target)) {
      commands.push(command(target, `just ${target}`, `${file}:${target}`, 0.76));
      addEvidence(evidence, `Detected justfile recipe "${target}".`);
    }
  }
  return commands;
}

function taskfilePath(files) {
  return ["Taskfile.yml", "Taskfile.yaml", "taskfile.yml", "taskfile.yaml"].find((file) => files.has(file)) ?? null;
}

function parseTaskfileTargets(content) {
  const targets = [];
  let inTasks = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    if (/^tasks\s*:/.test(trimmed)) {
      inTasks = true;
      continue;
    }

    if (!inTasks) {
      continue;
    }

    if (/^\S/.test(line) && /^[A-Za-z0-9_-]+\s*:/.test(trimmed)) {
      break;
    }

    const match = line.match(/^(?: {2}|\t)([A-Za-z0-9_.-]+):(?:\s|$)/);
    if (match) {
      targets.push(match[1]);
    }
  }
  return targets;
}

async function detectTaskfile(root, files, evidence) {
  const file = taskfilePath(files);
  if (!file) {
    return [];
  }

  const content = await readTextFileIfSafe(root, file);
  if (!content) {
    return [];
  }

  const commands = [];
  for (const target of parseTaskfileTargets(content)) {
    if (COMMON_TARGETS.has(target)) {
      commands.push(command(target, `task ${target}`, `${file}:${target}`, 0.76));
      addEvidence(evidence, `Detected Taskfile task "${target}".`);
    }
  }
  return commands;
}

function ciProviderForPath(file) {
  if (/^\.github\/workflows\/.+\.ya?ml$/.test(file)) {
    return "GitHub Actions";
  }
  if (/^\.gitlab-ci\.ya?ml$/.test(file)) {
    return "GitLab CI";
  }
  if (/^\.circleci\/config\.ya?ml$/.test(file)) {
    return "CircleCI";
  }
  if (/^\.buildkite\/(?:pipeline|pipelines\/.+)\.ya?ml$/.test(file)) {
    return "Buildkite";
  }
  if (/^(azure-pipelines|\.azure-pipelines\/.+)\.ya?ml$/.test(file)) {
    return "Azure Pipelines";
  }
  if (/^bitbucket-pipelines\.ya?ml$/.test(file)) {
    return "Bitbucket Pipelines";
  }
  if (/^\.drone\.ya?ml$/.test(file)) {
    return "Drone CI";
  }
  if (file === "Jenkinsfile") {
    return "Jenkins";
  }
  return null;
}

function cleanCiCommand(value) {
  const commandText = value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .trim();

  if (!commandText || commandText === "|" || commandText === ">" || commandText.startsWith("[") || commandText.startsWith("{")) {
    return null;
  }
  if (/^(uses|name|image|stage|when|if|branches?|only|except|working_directory):\s*/.test(commandText)) {
    return null;
  }
  return commandText;
}

function extractCiRunCommands(provider, content) {
  if (!content) {
    return [];
  }

  const commands = [];
  const addCommand = (value) => {
    const cleaned = cleanCiCommand(value);
    if (cleaned) {
      commands.push(cleaned);
    }
  };

  if (provider === "Jenkins") {
    for (const match of content.matchAll(/\bsh\s+['"]([^'"]+)['"]/g)) {
      addCommand(match[1]);
    }
  }

  let listContext = null;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const scalarMatch = line.match(/^\s*(run|script|command|bash|pwsh|powershell):\s+(.+)$/);
    if (scalarMatch) {
      addCommand(scalarMatch[2]);
      listContext = null;
      continue;
    }

    const listStartMatch = line.match(/^(\s*)(script|commands):\s*$/);
    if (listStartMatch) {
      listContext = listStartMatch[1].length;
      continue;
    }

    if (listContext !== null) {
      const indent = line.match(/^\s*/)[0].length;
      if (indent <= listContext && trimmed) {
        listContext = null;
      } else {
        const listCommandMatch = line.match(/^\s*-\s+(?:run:\s*)?(.+)$/);
        if (listCommandMatch) {
          addCommand(listCommandMatch[1]);
          continue;
        }
      }
    }

    const inlineListCommandMatch = line.match(/^\s*-\s+(?:run|command|script):\s+(.+)$/);
    if (inlineListCommandMatch) {
      addCommand(inlineListCommandMatch[1]);
    }
  }

  return uniqueStrings(commands).slice(0, 20);
}

async function detectCi(root, entries, evidence) {
  const workflowFiles = entries
    .filter((entry) => entry.kind === "file")
    .map((entry) => entry.path)
    .map((file) => ({ path: file, provider: ciProviderForPath(file) }))
    .filter((item) => item.provider);

  const workflows = [];
  for (const workflow of workflowFiles) {
    const content = await readTextFileIfSafe(root, workflow.path, { maxReadBytes: 96 * 1024 });
    workflows.push({
      path: workflow.path,
      provider: workflow.provider,
      runCommands: extractCiRunCommands(workflow.provider, content)
    });
    addEvidence(evidence, `Detected ${workflow.provider} config ${workflow.path}.`);
  }

  return workflows;
}

function detectRisks(entries, evidence, config) {
  const risks = [];
  const secretLikeFiles = [];

  for (const entry of entries) {
    if (entry.kind !== "file" && entry.kind !== "directory") {
      continue;
    }

    if (entry.kind === "file" && isSecretLikePath(entry.path)) {
      secretLikeFiles.push(entry.path);
      risks.push({
        path: entry.path,
        category: "secret_like_file",
        severity: "high",
        reason: "file name looks like it may contain secrets; contents were not read"
      });
      addEvidence(evidence, `Marked ${entry.path} as secret-like by path pattern.`);
      continue;
    }

    for (const rule of RISK_PATH_RULES) {
      if (rule.pattern.test(entry.path)) {
        risks.push({
          path: entry.path,
          category: rule.category,
          severity: rule.severity,
          reason: rule.reason
        });
        break;
      }
    }

    for (const pattern of config.riskPaths ?? []) {
      if (pathMatchesPattern(entry.path, pattern)) {
        risks.push({
          path: entry.path,
          category: "configured_risk",
          severity: "high",
          reason: `matched configured risk path ${pattern}`
        });
        addEvidence(evidence, `Marked ${entry.path} as risky from agent-ready config pattern ${pattern}.`);
        break;
      }
    }

    for (const pattern of config.generatedPaths ?? []) {
      if (pathMatchesPattern(entry.path, pattern)) {
        risks.push({
          path: entry.path,
          category: "configured_generated",
          severity: "medium",
          reason: `matched configured generated path ${pattern}`
        });
        addEvidence(evidence, `Marked ${entry.path} as generated from agent-ready config pattern ${pattern}.`);
        break;
      }
    }
  }

  return {
    risks: uniqueBy(risks, (risk) => `${risk.path}:${risk.category}`),
    secretLikeFiles
  };
}

async function detectDocs(root, files) {
  const docCandidates = [
    "README.md",
    "CONTRIBUTING.md",
    "DEVELOPMENT.md",
    ".github/CONTRIBUTING.md"
  ];

  const docs = [];
  for (const file of docCandidates) {
    if (files.has(file)) {
      docs.push({ path: file, role: file === "README.md" ? "readme" : "developer documentation" });
    }
  }

  for (const file of files) {
    if (/^docs\/.+\.md$/.test(file)) {
      docs.push({ path: file, role: "documentation" });
    }
  }

  let purpose = null;
  if (files.has("README.md")) {
    const content = await readTextFileIfSafe(root, "README.md", { maxReadBytes: 64 * 1024 });
    purpose = extractPurposeFromMarkdown(content);
  }

  return {
    docs: uniqueBy(docs, (doc) => doc.path).slice(0, 40),
    purpose
  };
}

function extractPurposeFromMarkdown(content) {
  if (!content) {
    return null;
  }

  const cleanMarkdownLine = (line) => line
    .trim()
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

  const lines = content.split(/\r?\n/);
  const nonEmpty = lines
    .map(cleanMarkdownLine)
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .filter((line) => !line.startsWith("```"));

  const paragraph = nonEmpty.find((line) => line.length > 20 && !line.startsWith("[!") && !line.startsWith("<!--"));
  if (!paragraph) {
    return null;
  }
  return paragraph.length > 220 ? `${paragraph.slice(0, 217)}...` : paragraph;
}

function detectEnvironment(files) {
  const examples = [...files].filter((file) => isSafeEnvExample(file)).sort();
  const secretLikeFiles = [...files].filter((file) => isSecretLikePath(file)).sort();
  return {
    examples,
    secretLikeFiles
  };
}

function detectGeneratedHints(entries) {
  return entries
    .filter((entry) => entry.kind === "file" || entry.kind === "directory")
    .map((entry) => entry.path)
    .filter((file) => /(^|\/)(generated|gen|dist|build)(\/|$)/.test(file))
    .slice(0, 50);
}

function applyCommandOverrides(commands, config, evidence, configSourceLabel) {
  const result = new Map(commands.map((item) => [item.name, item]));
  for (const [name, value] of Object.entries(config.commands ?? {})) {
    const commandText = typeof value === "string" ? value : value.command;
    if (!commandText) {
      continue;
    }

    const overrides = {};
    if (typeof value === "object" && value) {
      if (typeof value.requiresNetwork === "boolean") overrides.requiresNetwork = value.requiresNetwork;
      if (typeof value.writesFiles === "boolean") overrides.writesFiles = value.writesFiles;
      if (typeof value.risk === "string") overrides.risk = value.risk;
    }

    result.set(name, command(name, commandText, `${configSourceLabel}:commands.${name}`, 1, overrides));
    addEvidence(evidence, `Applied configured command override for "${name}".`);
  }
  return [...result.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function scanRepo(options = {}) {
  const root = path.resolve(options.root ?? process.cwd());
  const evidence = [];
  const configResult = options.config
    ? { path: options.configPath ?? null, loaded: true, config: options.config, warnings: [] }
    : await loadAgentReadyConfig(root, options.configPath);
  const config = configResult.config;
  const configSourceLabel = configResult.path ? path.basename(configResult.path) : "agent-ready.config.json";
  for (const warning of configResult.warnings) {
    addEvidence(evidence, warning);
  }

  const inventory = await walkRepo(root, { ...options, ignore: config.ignore });
  const entries = inventory.entries;
  const files = new Set(entries.filter((entry) => entry.kind === "file").map((entry) => entry.path));

  const packageManagers = detectPackageManagers(files, evidence);
  const languages = detectLanguages(files, entries, evidence);
  const directories = detectDirectories(entries, config);
  const entrypoints = detectEntrypoints(files);
  const monorepo = await detectMonorepo(root, files, packageManagers, evidence);

  const node = await detectNode(root, files, packageManagers, evidence);
  const python = await detectPython(root, files, evidence);
  const ruby = await detectRuby(root, files, evidence);
  const php = await detectPhp(root, files, evidence);
  const java = await detectJava(root, files, evidence);
  const dotnet = await detectDotnet(root, files, evidence);
  const go = detectGo(files, evidence);
  const rust = detectRust(files, evidence);
  const makefileCommands = await detectMakefile(root, files, evidence);
  const justfileCommands = await detectJustfile(root, files, evidence);
  const taskfileCommands = await detectTaskfile(root, files, evidence);
  const monorepoCommands = detectMonorepoCommands(monorepo, packageManagers, evidence);
  const ci = await detectCi(root, entries, evidence);
  const riskResult = detectRisks(entries, evidence, config);
  const docsResult = await detectDocs(root, files);
  const environment = detectEnvironment(files);

  const detectedCommands = uniqueBy(
    [
      ...node.commands,
      ...python.commands,
      ...ruby.commands,
      ...php.commands,
      ...java.commands,
      ...dotnet.commands,
      ...go.commands,
      ...rust.commands,
      ...makefileCommands,
      ...justfileCommands,
      ...taskfileCommands,
      ...monorepoCommands
    ],
    (item) => `${item.name}:${item.command}`
  ).sort((a, b) => a.name.localeCompare(b.name));
  const commands = applyCommandOverrides(detectedCommands, config, evidence, configSourceLabel);

  const frameworks = uniqueBy(
    [...node.frameworks, ...python.frameworks, ...ruby.frameworks, ...php.frameworks, ...java.frameworks, ...dotnet.frameworks, ...go.frameworks, ...rust.frameworks],
    (item) => item.name
  ).sort((a, b) => a.name.localeCompare(b.name));

  const purpose = config.sections?.purpose ?? docsResult.purpose ?? php.purpose ?? node.purpose ?? "Repository purpose was not confidently detected.";
  const primaryLanguage = [...languages].sort((a, b) => b.confidence - a.confidence || b.fileCount - a.fileCount)[0]?.name ?? null;

  return {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    root,
    summary: {
      purpose,
      primaryLanguage,
      packageManagers: packageManagers.map((manager) => manager.name),
      frameworks: frameworks.map((framework) => framework.name),
      monorepo: monorepo.detected
    },
    inventory: {
      fileCount: entries.filter((entry) => entry.kind === "file").length,
      directoryCount: entries.filter((entry) => entry.kind === "directory").length,
      symlinkCount: entries.filter((entry) => entry.kind === "symlink").length,
      limitHit: inventory.limitHit,
      gitignoreRuleCount: inventory.gitignoreRuleCount,
      configIgnoreRuleCount: inventory.configIgnoreRuleCount
    },
    config: {
      path: configResult.path,
      loaded: configResult.loaded,
      profiles: config.profiles,
      warnings: configResult.warnings
    },
    languages,
    packageManagers,
    monorepo,
    frameworks,
    commands,
    configuredConventions: config.sections?.conventions ?? [],
    directories,
    entrypoints,
    risks: riskResult.risks,
    docs: docsResult.docs,
    environment,
    ci,
    generatedHints: detectGeneratedHints(entries),
    evidence
  };
}
