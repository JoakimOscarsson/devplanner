import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { proxyRequest } from "@pdp-helper/runtime-node";
import { registeredServices } from "../storage/registry.js";

function resolveProxyTarget(pathname: string) {
  for (const service of registeredServices) {
    const matchedPrefix = service.proxyPrefixes.find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );

    if (!matchedPrefix) {
      continue;
    }

    return {
      service,
      internalPath: pathname.replace("/api", "")
    };
  }

  return null;
}

export const proxyRoutes: readonly RouteDefinition[] = [
  {
    method: ["GET", "POST", "PATCH", "DELETE"],
    match: (pathname) => {
      const match = resolveProxyTarget(pathname);

      if (!match) {
        return null;
      }

      return {
        targetUrl: `${match.service.url}${match.internalPath}`
      };
    },
    handle: async ({ request, response, url, params, correlation }) => {
      const search = url.search || "";
      await proxyRequest({
        request,
        response,
        targetUrl: `${params.targetUrl}${search}`,
        correlation
      });
    }
  }
] as const;
