import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json, readBody } from "@pdp-helper/runtime-node";
import { recommendationCapabilities } from "../domain/metadata.js";
import {
  providerHealth,
  updateProviderHealth
} from "../storage/in-memory.js";

export const recommendationHealthRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/health" ? {} : null),
    handle: ({ response, correlation }) => {
      json(
        response,
        200,
        {
          service: "recommendation-service",
          status: providerHealth.status === "down" ? "degraded" : "up",
          checkedAt: new Date().toISOString(),
          capabilities: [...recommendationCapabilities],
          providerHealth
        },
        correlation
      );
    }
  },
  {
    method: "GET",
    match: (pathname) =>
      pathname === "/v1/providers/health" ? {} : null,
    handle: ({ response, correlation }) => {
      json(response, 200, { providers: [providerHealth] }, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) =>
      pathname === "/v1/providers/health" ? {} : null,
    handle: async ({ request, response, correlation }) => {
      const body = await readBody(request);
      const nextProviderHealth = updateProviderHealth({
        status:
          typeof body.status === "string"
            ? (body.status as typeof providerHealth.status)
            : providerHealth.status,
        message:
          typeof body.message === "string" ? body.message : providerHealth.message
      });

      json(response, 200, { provider: nextProviderHealth }, correlation);
    }
  }
] as const;
