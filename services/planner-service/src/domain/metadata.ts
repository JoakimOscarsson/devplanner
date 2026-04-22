import type { ServiceCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";

export const plannerCapabilities: readonly ServiceCapability[] = [
  {
    capability: "planner",
    title: "Planner",
    route: "/planner",
    service: "planner-service",
    version: "v1",
    optional: false
  }
] as const;

export function plannerHealth(): ServiceHealthSnapshot {
  return {
    service: "planner-service",
    status: "up",
    checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
    capabilities: [...plannerCapabilities]
  };
}
