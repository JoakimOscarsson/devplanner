import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json } from "@pdp-helper/runtime-node";
import { trackerHealth } from "../domain/metadata.js";

export const trackerHealthRoute: RouteDefinition = {
  method: "GET",
  match: (pathname) => (pathname === "/health" ? {} : null),
  handle: ({ response, correlation }) => {
    json(response, 200, trackerHealth(), correlation);
  }
};
