import type {
  ProviderId,
  ServiceCapability,
  ServiceHealthSnapshot
} from "@pdp-helper/contracts-core";
import type { ProviderHealth } from "@pdp-helper/contracts-recommendation";

const providerId = "prv_remote_ollama" as ProviderId;

export const recommendationCapabilities: readonly ServiceCapability[] = [
  {
    capability: "recommendations",
    title: "Recommendations",
    route: "/recommendations",
    service: "recommendation-service",
    version: "v1",
    optional: true
  }
] as const;

export function currentProviderHealth(): ProviderHealth {
  return {
    providerId,
    providerKind: "ollama",
    status: process.env.OLLAMA_BASE_URL ? "up" : "degraded",
    checkedAt: new Date().toISOString() as ProviderHealth["checkedAt"],
    lastSuccessfulAt: process.env.OLLAMA_BASE_URL
      ? (new Date().toISOString() as ProviderHealth["lastSuccessfulAt"])
      : undefined,
    message: process.env.OLLAMA_BASE_URL
      ? "External Ollama endpoint configured."
      : "OLLAMA_BASE_URL is not configured. Manual runs will be deferred.",
    workspaceId: "wrk_demo_owner" as ProviderHealth["workspaceId"],
    createdBy: "act_recommendation" as ProviderHealth["createdBy"],
    createdAt: new Date().toISOString() as ProviderHealth["createdAt"],
    updatedAt: new Date().toISOString() as ProviderHealth["updatedAt"]
  };
}

export function recommendationHealth(): ServiceHealthSnapshot & {
  providerHealth: ProviderHealth;
} {
  const providerHealth = currentProviderHealth();

  return {
    service: "recommendation-service",
    status: providerHealth.status === "down" ? "degraded" : "up",
    checkedAt: new Date().toISOString() as ServiceHealthSnapshot["checkedAt"],
    capabilities: [...recommendationCapabilities],
    providerHealth
  };
}
