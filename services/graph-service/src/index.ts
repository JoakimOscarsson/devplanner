import { createService } from "@pdp-helper/runtime-node";
import { graphCanvasRoutes } from "./routes/canvases.js";
import { graphHealthRoute } from "./routes/health.js";
import { graphSkillRoutes } from "./routes/skills.js";

const port = Number(process.env.PORT ?? 4101);

createService({
  name: "graph-service",
  port,
  routes: [graphHealthRoute, ...graphCanvasRoutes, ...graphSkillRoutes]
});
