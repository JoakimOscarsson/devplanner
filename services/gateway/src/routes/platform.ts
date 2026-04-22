import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { json } from "@pdp-helper/runtime-node";
import {
  buildCapabilities,
  collectHealth,
  gatewayStatus
} from "../domain/health.js";
import { registeredServices } from "../storage/registry.js";

export const platformRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/health" ? {} : null),
    handle: async ({ response, correlation }) => {
      const snapshots = await collectHealth(registeredServices);

      json(
        response,
        200,
        {
          service: "gateway",
          status: gatewayStatus(registeredServices, snapshots),
          checkedAt: new Date().toISOString(),
          dependencies: snapshots
        },
        correlation
      );
    }
  },
  {
    method: "GET",
    match: (pathname) =>
      pathname === "/api/v1/services/health" ? {} : null,
    handle: async ({ response, correlation }) => {
      json(
        response,
        200,
        {
          services: await collectHealth(registeredServices)
        },
        correlation
      );
    }
  },
  {
    method: "GET",
    match: (pathname) => (pathname === "/api/v1/capabilities" ? {} : null),
    handle: async ({ response, correlation }) => {
      const snapshots = await collectHealth(registeredServices);

      json(
        response,
        200,
        {
          capabilities: buildCapabilities(snapshots)
        },
        correlation
      );
    }
  }
] as const;
