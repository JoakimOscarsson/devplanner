import type { ServiceCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";

export const mcpCapabilities: readonly ServiceCapability[] = [
  {
    capability: "mcp",
    title: "External Tools",
    route: "/external-tools",
    service: "mcp-service",
    version: "v1",
    optional: true
  }
] as const;

export function mcpHealth(): ServiceHealthSnapshot {
  return {
    service: "mcp-service",
    status: "up",
    checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
    capabilities: [...mcpCapabilities]
  };
}
