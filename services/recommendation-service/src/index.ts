import { createService } from "@pdp-helper/runtime-node";
import { recommendationHealthRoutes } from "./routes/health.js";
import { recommendationRoutes } from "./routes/recommendations.js";

const port = Number(process.env.PORT ?? 4104);

createService({
  name: "recommendation-service",
  port,
  routes: [...recommendationHealthRoutes, ...recommendationRoutes]
});
