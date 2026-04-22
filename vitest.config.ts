import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function sourcePath(relativePath: string) {
  return path.resolve(rootDir, relativePath);
}

export default defineConfig({
  resolve: {
    alias: {
      "@pdp-helper/contracts-core": sourcePath("packages/contracts-core/src/index.ts"),
      "@pdp-helper/contracts-graph": sourcePath("packages/contracts-graph/src/index.ts"),
      "@pdp-helper/contracts-planner": sourcePath("packages/contracts-planner/src/index.ts"),
      "@pdp-helper/contracts-tracker": sourcePath("packages/contracts-tracker/src/index.ts"),
      "@pdp-helper/contracts-recommendation": sourcePath("packages/contracts-recommendation/src/index.ts"),
      "@pdp-helper/contracts-mcp": sourcePath("packages/contracts-mcp/src/index.ts"),
      "@pdp-helper/runtime-node": sourcePath("packages/runtime-node/src/index.ts"),
      "@pdp-helper/runtime-web": sourcePath("packages/runtime-web/src/index.ts"),
      "@pdp-helper/ui-graph": sourcePath("packages/ui-graph/src/index.ts"),
      "@pdp-helper/ui-shell": sourcePath("packages/ui-shell/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"]
  }
});
