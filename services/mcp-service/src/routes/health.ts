import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json } from "@pdp-helper/runtime-node";
import { mcpHealth } from "../domain/metadata.js";

export const mcpHealthRoute: RouteDefinition = {
  method: "GET",
  match: (pathname) => (pathname === "/health" ? {} : null),
  handle: ({ response, correlation }) => {
    json(response, 200, mcpHealth(), correlation);
  }
};
