export const gatewayUrl =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ??
  "http://localhost:4000";
