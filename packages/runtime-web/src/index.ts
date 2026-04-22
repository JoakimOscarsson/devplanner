import { useEffect, useMemo, useState } from "react";
import {
  buildModuleCapabilities,
  type DomainError,
  type ModuleCapability,
  type ServiceHealthSnapshot
} from "@pdp-helper/contracts-core";

export interface GatewayCapabilitiesResponse {
  capabilities: ModuleCapability[];
}

export interface GatewayHealthResponse {
  services: ServiceHealthSnapshot[];
}

function readDomainErrorBody(value: unknown): Partial<DomainError> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if ("error" in value && value.error && typeof value.error === "object") {
    return value.error as Partial<DomainError>;
  }

  return value as Partial<DomainError>;
}

export class GatewayRequestError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: DomainError["details"] | undefined;

  constructor(input: {
    readonly message: string;
    readonly status: number;
    readonly code?: string;
    readonly details?: DomainError["details"];
  }) {
    super(input.message);
    this.name = "GatewayRequestError";
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
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
      let errorBody: Partial<DomainError> | null = null;
      let fallbackMessage = `Gateway request failed for ${path} with ${response.status}.`;

      try {
        errorBody = readDomainErrorBody(await response.json());
      } catch {
        try {
          const text = await response.text();

          if (text.trim().length > 0) {
            fallbackMessage = text.trim();
          }
        } catch {
          errorBody = null;
        }
      }

      throw new GatewayRequestError({
        message:
          typeof errorBody?.message === "string" && errorBody.message.trim().length > 0
            ? errorBody.message
            : fallbackMessage,
        status: response.status,
        ...(typeof errorBody?.code === "string" ? { code: errorBody.code } : {}),
        ...(errorBody?.details ? { details: errorBody.details } : {})
      });
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
