import { useEffect, useMemo, useState } from "react";
import {
  buildModuleCapabilities,
  type ModuleCapability,
  type ServiceHealthSnapshot
} from "@pdp-helper/contracts-core";

export interface GatewayCapabilitiesResponse {
  capabilities: ModuleCapability[];
}

export interface GatewayHealthResponse {
  services: ServiceHealthSnapshot[];
}

export class GatewayClient {
  constructor(private readonly baseUrl: string) {}

  async listCapabilities() {
    return this.request<GatewayCapabilitiesResponse>("/api/v1/capabilities");
  }

  async listServiceHealth() {
    return this.request<GatewayHealthResponse>("/api/v1/services/health");
  }

  async request<TPayload>(path: string, init?: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(`Gateway request failed for ${path} with ${response.status}.`);
    }

    return (await response.json()) as TPayload;
  }
}

export interface GatewayState {
  modules: ModuleCapability[];
  services: ServiceHealthSnapshot[];
  error: string | null;
  loading: boolean;
}

export function useGatewayState(baseUrl: string) {
  const client = useMemo(() => new GatewayClient(baseUrl), [baseUrl]);
  const [state, setState] = useState<GatewayState>({
    modules: buildModuleCapabilities([]),
    services: [],
    error: null,
    loading: true
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [capabilities, health] = await Promise.all([
          client.listCapabilities(),
          client.listServiceHealth()
        ]);

        if (!active) {
          return;
        }

        setState({
          modules: capabilities.capabilities,
          services: health.services,
          error: null,
          loading: false
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          modules: buildModuleCapabilities([]),
          services: [],
          error: error instanceof Error ? error.message : "Unable to load gateway state.",
          loading: false
        });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [client]);

  return state;
}

export function useCapabilities(baseUrl: string) {
  const { modules, error, loading } = useGatewayState(baseUrl);

  return {
    modules,
    error,
    loading
  };
}

export function useServiceHealth(baseUrl: string) {
  const { services, error, loading } = useGatewayState(baseUrl);

  return {
    services,
    error,
    loading
  };
}
