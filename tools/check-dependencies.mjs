import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const scanRoots = ["apps", "services", "packages"];
const sourceExtensions = new Set([".ts", ".tsx", ".mts"]);

const packageAliasMap = new Map([
  ["@pdp-helper/contracts-core", "packages/contracts-core"],
  ["@pdp-helper/contracts-graph", "packages/contracts-graph"],
  ["@pdp-helper/contracts-planner", "packages/contracts-planner"],
  ["@pdp-helper/contracts-tracker", "packages/contracts-tracker"],
  ["@pdp-helper/contracts-recommendation", "packages/contracts-recommendation"],
  ["@pdp-helper/contracts-mcp", "packages/contracts-mcp"],
  ["@pdp-helper/runtime-node", "packages/runtime-node"],
  ["@pdp-helper/runtime-web", "packages/runtime-web"],
  ["@pdp-helper/ui-graph", "packages/ui-graph"],
  ["@pdp-helper/ui-shell", "packages/ui-shell"]
]);

const allowedImports = new Map([
  ["apps/web", new Set([
    "packages/contracts-core",
    "packages/contracts-graph",
    "packages/contracts-planner",
    "packages/contracts-tracker",
    "packages/contracts-recommendation",
    "packages/contracts-mcp",
    "packages/runtime-web",
    "packages/ui-graph",
    "packages/ui-shell"
  ])],
  ["services/gateway", new Set([
    "packages/contracts-core",
    "packages/contracts-graph",
    "packages/contracts-planner",
    "packages/contracts-tracker",
    "packages/contracts-recommendation",
    "packages/contracts-mcp",
    "packages/runtime-node"
  ])],
  ["services/graph-service", new Set([
    "packages/contracts-core",
    "packages/contracts-graph",
    "packages/runtime-node"
  ])],
  ["services/planner-service", new Set([
    "packages/contracts-core",
    "packages/contracts-planner",
    "packages/runtime-node"
  ])],
  ["services/tracker-service", new Set([
    "packages/contracts-core",
    "packages/contracts-tracker",
    "packages/runtime-node"
  ])],
  ["services/recommendation-service", new Set([
    "packages/contracts-core",
    "packages/contracts-recommendation",
    "packages/runtime-node"
  ])],
  ["services/mcp-service", new Set([
    "packages/contracts-core",
    "packages/contracts-graph",
    "packages/contracts-planner",
    "packages/contracts-recommendation",
    "packages/contracts-mcp",
    "packages/runtime-node"
  ])],
  ["packages/ui-graph", new Set([
    "packages/contracts-core",
    "packages/contracts-graph"
  ])],
  ["packages/ui-shell", new Set([
    "packages/contracts-core"
  ])],
  ["packages/contracts-core", new Set()],
  ["packages/contracts-graph", new Set([
    "packages/contracts-core"
  ])],
  ["packages/contracts-planner", new Set([
    "packages/contracts-core"
  ])],
  ["packages/contracts-tracker", new Set([
    "packages/contracts-core"
  ])],
  ["packages/contracts-recommendation", new Set([
    "packages/contracts-core"
  ])],
  ["packages/contracts-mcp", new Set([
    "packages/contracts-core",
    "packages/contracts-graph",
    "packages/contracts-planner",
    "packages/contracts-recommendation"
  ])],
  ["packages/runtime-node", new Set([
    "packages/contracts-core"
  ])],
  ["packages/runtime-web", new Set([
    "packages/contracts-core"
  ])]
]);

function listFiles(root) {
  if (!fs.existsSync(root)) {
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") {
        continue;
      }

      files.push(...listFiles(fullPath));
      continue;
    }

    if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function findProjectForFile(filePath) {
  const relativePath = path.relative(repoRoot, filePath);
  const segments = relativePath.split(path.sep);
  return segments.slice(0, 2).join("/");
}

function resolveImportTarget(specifier, importerPath) {
  if (specifier.startsWith("@pdp-helper/")) {
    return packageAliasMap.get(specifier);
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const importerProject = findProjectForFile(importerPath);
  const resolvedPath = path.resolve(path.dirname(importerPath), specifier);
  const relativeResolved = path.relative(repoRoot, resolvedPath);
  const segments = relativeResolved.split(path.sep);
  const targetProject = segments.slice(0, 2).join("/");

  if (targetProject === importerProject) {
    return importerProject;
  }

  return targetProject;
}

function extractSpecifiers(source) {
  const matches = source.matchAll(
    /(?:import|export)\s+(?:type\s+)?(?:[^"'`]+\s+from\s+)?["'`]([^"'`]+)["'`]/g
  );
  return [...matches].map((match) => match[1]);
}

const errors = [];
const files = scanRoots.flatMap((root) => listFiles(path.join(repoRoot, root)));

for (const filePath of files) {
  const project = findProjectForFile(filePath);
  const allowed = allowedImports.get(project);

  if (!allowed) {
    continue;
  }

  const source = fs.readFileSync(filePath, "utf8");
  const specifiers = extractSpecifiers(source);

  for (const specifier of specifiers) {
    const target = resolveImportTarget(specifier, filePath);

    if (!target || target === project) {
      continue;
    }

    if (!allowed.has(target)) {
      errors.push(
        `${path.relative(repoRoot, filePath)} imports ${specifier}, which resolves to ${target} and is not allowed for ${project}.`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("Dependency boundary check failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Dependency boundary check passed.");
