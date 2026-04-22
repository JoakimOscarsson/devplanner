import {
  type CapabilityName,
  type HealthStatus,
  type ServiceCapability,
  type ServiceHealthSnapshot,
  type ServiceName
} from "@pdp-helper/contracts-core";
import type { RegisteredService } from "../storage/registry.js";

export interface GatewayCapability {
  capability: CapabilityName;
  title: string;
  route: string;
  service: ServiceName;
  optional: boolean;
  enabled: boolean;
  status: HealthStatus;
}

export async function fetchHealth(
  service: RegisteredService
): Promise<ServiceHealthSnapshot> {
  try {
    const response = await fetch(`${service.url}/health`, {
      signal: AbortSignal.timeout(1200)
    });

    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }

    return (await response.json()) as ServiceHealthSnapshot;
  } catch (error) {
    const capabilities: ServiceCapability[] = service.capabilities.map(
      (capability) => ({
        ...capability,
        service: service.service
      })
    );

    return {
      service: service.service,
      status: "down",
      checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
      capabilities,
      message: error instanceof Error ? error.message : "Unknown dependency error"
    };
  }
}

export async function collectHealth(services: readonly RegisteredService[]) {
  return Promise.all(services.map((service) => fetchHealth(service)));
}

export function buildCapabilities(
  snapshots: readonly ServiceHealthSnapshot[]
): GatewayCapability[] {
  return snapshots.flatMap((snapshot) =>
    snapshot.capabilities.map((capability) => ({
      ...capability,
      enabled: snapshot.status === "up" || snapshot.status === "degraded",
      status: snapshot.status
    }))
  );
}

export function gatewayStatus(
  services: readonly RegisteredService[],
  snapshots: readonly ServiceHealthSnapshot[]
) {
  const requiredDown = snapshots.some(
    (snapshot) =>
      snapshot.status === "down" &&
      services.find((service) => service.service === snapshot.service)?.optional ===
        false
  );

  return requiredDown ? "degraded" : "up";
}
