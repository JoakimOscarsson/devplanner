import { describe, expect, it, vi } from "vitest";
import { GatewayClient } from "../../packages/runtime-web/src";
import type { GatewayRequestError } from "../../packages/runtime-web/src";

describe("runtime-web", () => {
  it("surfaces structured gateway errors with code and details", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "SKILL_RESOLUTION_REQUIRED",
            message: "Duplicate skill resolution is required before creating this skill.",
            status: 409,
            retryable: false,
            details: {
              normalizedLabel: "typescript",
              exactMatch: true,
              candidates: [{ skillId: "skl_typescript" }]
            }
          }
        }),
        {
          status: 409,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    const originalFetch = globalThis.fetch;
    vi.stubGlobal("fetch", fetcher);

    try {
      const client = new GatewayClient("http://localhost:4000");

      await expect(client.request("/api/v1/skills/tree/nodes")).rejects.toMatchObject({
        name: "GatewayRequestError",
        code: "SKILL_RESOLUTION_REQUIRED",
        status: 409
      } satisfies Partial<GatewayRequestError>);
    } finally {
      vi.stubGlobal("fetch", originalFetch);
    }
  });
});
