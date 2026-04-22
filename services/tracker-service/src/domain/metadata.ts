import type { ServiceCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";

export const trackerCapabilities: readonly ServiceCapability[] = [
  {
    capability: "tracker",
    title: "Tracker",
    route: "/tracker",
    service: "tracker-service",
    version: "v1",
    optional: true
  }
] as const;

export function trackerHealth(): ServiceHealthSnapshot {
  return {
    service: "tracker-service",
    status: "up",
    checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
    capabilities: [...trackerCapabilities]
  };
}
