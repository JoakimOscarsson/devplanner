import { createService } from "@pdp-helper/runtime-node";
import { trackerHealthRoute } from "./routes/health.js";
import { trackerProgressRoutes } from "./routes/progress.js";

const port = Number(process.env.PORT ?? 4103);

createService({
  name: "tracker-service",
  port,
  routes: [trackerHealthRoute, ...trackerProgressRoutes]
});
