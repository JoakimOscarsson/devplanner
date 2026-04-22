import { createService } from "@pdp-helper/runtime-node";
import { mcpHealthRoute } from "./routes/health.js";
import { mcpToolRoutes } from "./routes/tools.js";

const port = Number(process.env.PORT ?? 4105);

createService({
  name: "mcp-service",
  port,
  routes: [mcpHealthRoute, ...mcpToolRoutes]
});
