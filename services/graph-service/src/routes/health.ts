import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json } from "@pdp-helper/runtime-node";
import { graphHealth } from "../domain/metadata.js";

export const graphHealthRoute: RouteDefinition = {
  method: "GET",
  match: (pathname) => (pathname === "/health" ? {} : null),
  handle: ({ response, correlation }) => {
    json(response, 200, graphHealth(), correlation);
  }
};
