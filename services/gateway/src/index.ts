import { createService } from "@pdp-helper/runtime-node";
import { platformRoutes } from "./routes/platform.js";
import { proxyRoutes } from "./routes/proxy.js";

const port = Number(process.env.PORT ?? 4000);

createService({
  name: "gateway",
  port,
  routes: [...platformRoutes, ...proxyRoutes]
});
