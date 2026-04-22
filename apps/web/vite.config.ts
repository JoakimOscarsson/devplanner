import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@pdp-helper/contracts-core": path.resolve(
        repoRoot,
        "packages/contracts-core/src/index.ts"
      ),
      "@pdp-helper/contracts-graph": path.resolve(
        repoRoot,
        "packages/contracts-graph/src/index.ts"
      ),
      "@pdp-helper/contracts-planner": path.resolve(
        repoRoot,
        "packages/contracts-planner/src/index.ts"
      ),
      "@pdp-helper/contracts-tracker": path.resolve(
        repoRoot,
        "packages/contracts-tracker/src/index.ts"
      ),
      "@pdp-helper/contracts-recommendation": path.resolve(
        repoRoot,
        "packages/contracts-recommendation/src/index.ts"
      ),
      "@pdp-helper/contracts-mcp": path.resolve(
        repoRoot,
        "packages/contracts-mcp/src/index.ts"
      ),
      "@pdp-helper/ui-graph": path.resolve(
        repoRoot,
        "packages/ui-graph/src/index.ts"
      ),
      "@pdp-helper/ui-shell": path.resolve(
        repoRoot,
        "packages/ui-shell/src/index.ts"
      )
    }
  }
});

