import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json } from "@pdp-helper/runtime-node";
import { plannerHealth } from "../domain/metadata.js";

export const plannerHealthRoute: RouteDefinition = {
  method: "GET",
  match: (pathname) => (pathname === "/health" ? {} : null),
  handle: ({ response, correlation }) => {
    json(response, 200, plannerHealth(), correlation);
  }
};
