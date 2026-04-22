const configuredGatewayUrl = import.meta.env.VITE_GATEWAY_URL as string | undefined;

export const gatewayUrl = configuredGatewayUrl?.trim().replace(/\/+$/, "") ?? "";
