export const SCHEMA_VERSION = "0.1.0";

export const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".turbo",
  ".cache",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".tox"
]);

export const SECRET_BASENAME_PATTERNS = [
  /^\.env$/,
  /^\.env\..+/,
  /^id_rsa$/,
  /^id_ed25519$/,
  /^credentials\.json$/,
  /^service-account.*\.json$/i,
  /.*\.pem$/,
  /.*\.key$/,
  /.*\.p12$/,
  /.*\.pfx$/
];

export const SAFE_ENV_EXAMPLE_PATTERNS = [
  /^\.env\.example$/,
  /^\.env\.sample$/,
  /^\.env\.template$/,
  /^env\.example$/i,
  /^env\.sample$/i
];

export const LANGUAGE_EXTENSIONS = new Map([
  [".ts", "TypeScript"],
  [".tsx", "TypeScript"],
  [".js", "JavaScript"],
  [".jsx", "JavaScript"],
  [".mjs", "JavaScript"],
  [".cjs", "JavaScript"],
  [".py", "Python"],
  [".go", "Go"],
  [".rs", "Rust"],
  [".java", "Java"],
  [".kt", "Kotlin"],
  [".rb", "Ruby"],
  [".php", "PHP"],
  [".cs", "C#"],
  [".c", "C"],
  [".h", "C/C++"],
  [".cc", "C++"],
  [".cpp", "C++"],
  [".hpp", "C++"],
  [".swift", "Swift"],
  [".sql", "SQL"],
  [".sh", "Shell"]
]);

export const RISK_PATH_RULES = [
  { pattern: /^db\/migrations(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^db\/migrate(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^database\/migrations(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^prisma\/migrations(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^supabase\/migrations(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^alembic\/versions(\/|$)/, category: "database_migration", severity: "high", reason: "database migrations can affect persisted data" },
  { pattern: /^infra(\/|$)/, category: "infrastructure", severity: "high", reason: "infrastructure changes can affect deployed systems" },
  { pattern: /^terraform(\/|$)/, category: "infrastructure", severity: "high", reason: "Terraform changes can affect cloud resources" },
  { pattern: /^k8s(\/|$)/, category: "deployment", severity: "high", reason: "Kubernetes changes can affect deployment behavior" },
  { pattern: /^kubernetes(\/|$)/, category: "deployment", severity: "high", reason: "Kubernetes changes can affect deployment behavior" },
  { pattern: /^helm(\/|$)/, category: "deployment", severity: "high", reason: "Helm changes can affect deployment behavior" },
  { pattern: /^\.github\/workflows(\/|$)/, category: "ci", severity: "medium", reason: "CI changes can affect validation and release behavior" },
  { pattern: /(^|\/)Dockerfile$/, category: "container", severity: "medium", reason: "container changes can affect runtime behavior" },
  { pattern: /(^|\/)docker-compose\.ya?ml$/, category: "container", severity: "medium", reason: "compose changes can affect local services" },
  { pattern: /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|go\.sum|Gemfile\.lock|composer\.lock|packages\.lock\.json)$/, category: "lockfile", severity: "medium", reason: "lockfiles should change only when dependencies change" },
  { pattern: /(^|\/)(generated|gen|dist|build)(\/|$)/, category: "generated", severity: "medium", reason: "generated outputs should usually be changed through their source inputs" }
];

export const TOP_LEVEL_DIR_ROLES = [
  { pattern: /^\.agents$/, role: "agent metadata and handoff files" },
  { pattern: /^\.github$/, role: "GitHub workflows and repository automation" },
  { pattern: /^src$/, role: "application source" },
  { pattern: /^app$/, role: "application routes or app source" },
  { pattern: /^pages$/, role: "page routes" },
  { pattern: /^components$/, role: "shared UI components" },
  { pattern: /^bin$/, role: "developer and framework command wrappers" },
  { pattern: /^exe$/, role: "published executable entrypoints" },
  { pattern: /^lib$/, role: "shared libraries or utilities" },
  { pattern: /^utils?$/, role: "utility code" },
  { pattern: /^tests?$/, role: "tests" },
  { pattern: /^spec$/, role: "tests" },
  { pattern: /^docs?$/, role: "documentation" },
  { pattern: /^examples?$/, role: "example projects and fixtures" },
  { pattern: /^scripts?$/, role: "developer scripts" },
  { pattern: /^tasks$/, role: "Rake tasks and developer automation" },
  { pattern: /^schemas?$/, role: "JSON schemas and structured contracts" },
  { pattern: /^bootstrap$/, role: "framework bootstrapping" },
  { pattern: /^config$/, role: "configuration" },
  { pattern: /^database$/, role: "database schema, factories, seeders, and migrations" },
  { pattern: /^db$/, role: "database schema and migrations" },
  { pattern: /^cmd$/, role: "command entrypoints" },
  { pattern: /^internal$/, role: "internal application packages" },
  { pattern: /^alembic$/, role: "database migrations" },
  { pattern: /^prisma$/, role: "Prisma schema and database migrations" },
  { pattern: /^public$/, role: "static assets" },
  { pattern: /^resources$/, role: "views, frontend assets, and localization resources" },
  { pattern: /^routes$/, role: "application route definitions" },
  { pattern: /^storage$/, role: "runtime storage, logs, and framework cache placeholders" },
  { pattern: /^templates$/, role: "server-rendered templates" },
  { pattern: /^translations$/, role: "localization messages" },
  { pattern: /^data$/, role: "local data fixtures or development databases" },
  { pattern: /^assets$/, role: "assets" },
  { pattern: /^infra$/, role: "infrastructure" },
  { pattern: /^terraform$/, role: "infrastructure" }
];
