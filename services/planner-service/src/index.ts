import { createService } from "@pdp-helper/runtime-node";
import { plannerHealthRoute } from "./routes/health.js";
import { plannerGoalRoutes } from "./routes/goals.js";

const port = Number(process.env.PORT ?? 4102);

createService({
  name: "planner-service",
  port,
  routes: [plannerHealthRoute, ...plannerGoalRoutes]
});
