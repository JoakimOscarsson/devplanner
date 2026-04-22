import type { ServiceCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";

export const graphCapabilities: readonly ServiceCapability[] = [
  {
    capability: "brainstorm",
    title: "Brainstorm",
    route: "/brainstorm",
    service: "graph-service",
    version: "v1",
    optional: false
  },
  {
    capability: "skill-graph",
    title: "Skill Graph",
    route: "/skills",
    service: "graph-service",
    version: "v1",
    optional: false
  }
] as const;

export function graphHealth(): ServiceHealthSnapshot {
  return {
    service: "graph-service",
    status: "up",
    checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
    capabilities: [...graphCapabilities]
  };
}
