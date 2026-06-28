import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { extractAgentsMdReferences, validateRepo } from "../src/validators/validate.js";

async function makeFixture(files) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "agent-ready-validate-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absolute = path.join(root, relPath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content, "utf8");
  }
  return root;
}

function validAgentsMd() {
  return "# AGENTS.md\n\n<!-- agent-ready:start purpose -->\nTest repo\n<!-- agent-ready:end purpose -->\n";
}

function validRepoMap() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    root: ".",
    summary: {
      purpose: "Test repo",
      primaryLanguage: null,
      packageManagers: [],
      frameworks: []
    },
    inventory: {
      fileCount: 0,
      directoryCount: 0,
      symlinkCount: 0,
      limitHit: false
    },
    languages: [],
    packageManagers: [],
    frameworks: [],
    directories: [],
    entrypoints: [],
    docs: [],
    ci: [],
    generatedHints: []
  };
}

function validCommands() {
  return {
    schemaVersion: "0.1.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    commands: []
  };
}

test("strict validation fails when warnings are present", async () => {
  const root = await makeFixture({
    "package.json": JSON.stringify({
      scripts: {
        test: "node --test"
      }
    }),
    "AGENTS.md": "# Custom Agent Guide\n",
    ".agents/repo-map.json": "{}\n",
    ".agents/commands.json": JSON.stringify({
      commands: [
        { name: "install", command: "npm install" },
        { name: "test", command: "npm test" }
      ]
    })
  });

  const defaultResult = await validateRepo({ root });
  assert.equal(defaultResult.ok, true);
  assert.equal(defaultResult.errors.length, 0);
  assert.ok(defaultResult.warnings.some((warning) => warning.includes("no agent-ready markers")));

  const strictResult = await validateRepo({ root, strict: true });
  assert.equal(strictResult.ok, false);
  assert.equal(strictResult.errors.length, 0);
  assert.ok(strictResult.warnings.some((warning) => warning.includes("no agent-ready markers")));
});

test("strict validation fails when repo map metadata is malformed", async () => {
  const root = await makeFixture({
    "AGENTS.md": validAgentsMd(),
    ".agents/repo-map.json": JSON.stringify({
      schemaVersion: "0.1.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      root: "."
    }),
    ".agents/commands.json": JSON.stringify(validCommands())
  });

  const defaultResult = await validateRepo({ root });
  assert.equal(defaultResult.ok, true);
  assert.ok(defaultResult.warnings.some((warning) => warning.includes(".agents/repo-map.json schema warning")));

  const strictResult = await validateRepo({ root, strict: true });
  assert.equal(strictResult.ok, false);
  assert.equal(strictResult.errors.length, 0);
  assert.ok(strictResult.warnings.some((warning) => warning.includes("$.summary")));
});

test("strict validation fails when command metadata is malformed", async () => {
  const root = await makeFixture({
    "AGENTS.md": validAgentsMd(),
    ".agents/repo-map.json": JSON.stringify(validRepoMap()),
    ".agents/commands.json": JSON.stringify({
      schemaVersion: "0.1.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      commands: [
        {
          name: "test",
          command: "npm test"
        }
      ]
    })
  });

  const defaultResult = await validateRepo({ root });
  assert.equal(defaultResult.ok, true);
  assert.ok(defaultResult.warnings.some((warning) => warning.includes(".agents/commands.json schema warning")));

  const strictResult = await validateRepo({ root, strict: true });
  assert.equal(strictResult.ok, false);
  assert.equal(strictResult.errors.length, 0);
  assert.ok(strictResult.warnings.some((warning) => warning.includes("$.commands[0].source")));
});

test("extractAgentsMdReferences ignores non-local and command-like references", () => {
  const references = extractAgentsMdReferences(`
# AGENTS.md

Read [setup](docs/setup.md), [root](/README.md), [ref][policy], and \`src/index.ts:12\`.

[policy]: docs/policy.md "Policy"

Ignore [site](https://example.com), [anchor](#workflow), \`npm test\`, \`node --test tests/*.test.js\`, \`@scope/pkg\`, and fenced examples:

\`\`\`bash
cat docs/missing-from-code-block.md
\`\`\`
`);

  assert.deepEqual(references, [
    "/README.md",
    "docs/policy.md",
    "docs/setup.md",
    "src/index.ts"
  ]);
});

test("validation warns on stale AGENTS.md local references", async () => {
  const root = await makeFixture({
    "AGENTS.md": `# AGENTS.md

<!-- agent-ready:start purpose -->
Test repo
<!-- agent-ready:end purpose -->

Read [setup](docs/setup.md), [missing](docs/missing.md "Missing doc"), \`README.md\`, \`docs/\`, \`.agents/repo-map.json\`, and \`src/missing.ts:12\`.
Ignore [site](https://example.com), [anchor](#workflow), \`npm test\`, \`node --test tests/*.test.js\`, and \`@scope/pkg\`.
`,
    "README.md": "# Test\n",
    "docs/setup.md": "# Setup\n",
    ".agents/repo-map.json": JSON.stringify(validRepoMap()),
    ".agents/commands.json": JSON.stringify(validCommands())
  });

  const defaultResult = await validateRepo({ root });
  assert.equal(defaultResult.ok, true);
  assert.equal(defaultResult.errors.length, 0);
  assert.ok(defaultResult.warnings.some((warning) => warning.includes("docs/missing.md")));
  assert.ok(defaultResult.warnings.some((warning) => warning.includes("src/missing.ts")));
  assert.ok(!defaultResult.warnings.some((warning) => warning.includes("https://example.com")));
  assert.ok(!defaultResult.warnings.some((warning) => warning.includes("npm test")));
  assert.ok(!defaultResult.warnings.some((warning) => warning.includes("@scope/pkg")));

  const strictResult = await validateRepo({ root, strict: true });
  assert.equal(strictResult.ok, false);
  assert.equal(strictResult.errors.length, 0);
  assert.ok(strictResult.warnings.some((warning) => warning.includes("docs/missing.md")));
});
