import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createService } from "@pdp-helper/runtime-node";
import { graphHealthRoute } from "../../services/graph-service/src/routes/health";
import { graphSkillRoutes } from "../../services/graph-service/src/routes/skills";
import { resetGraphStore } from "../../services/graph-service/src/storage/in-memory";

async function waitForListening(server: ReturnType<typeof createService>) {
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });
}

async function readJson<TPayload>(response: Response) {
  return (await response.json()) as TPayload;
}

describe("graph-service skill routes", () => {
  const servers: Array<ReturnType<typeof createService>> = [];

  beforeEach(() => {
    resetGraphStore();
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          })
      )
    );
  });

  async function startServer() {
    const server = createService({
      name: "graph-service-test",
      port: 0,
      routes: [graphHealthRoute, ...graphSkillRoutes]
    });
    servers.push(server);
    await waitForListening(server);

    return {
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    };
  }

  it("returns a skill inventory snapshot with canonical and reference guidance", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills`);
    const payload = await readJson<{
      summary: {
        totalCanonicalSkills: number;
        totalReferenceNodes: number;
      };
      inventory: Array<{
        canonicalLabel: string;
        sourceCanvasName?: string;
        referenceCount: number;
      }>;
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.summary.totalCanonicalSkills).toBe(2);
    expect(payload.summary.totalReferenceNodes).toBe(2);
    expect(payload.inventory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalLabel: "TypeScript",
          sourceCanvasName: "Inbox",
          referenceCount: 1
        }),
        expect.objectContaining({
          canonicalLabel: "Event-Driven Architecture",
          referenceCount: 1
        })
      ])
    );
  });

  it("guides exact duplicates toward canonical reuse or a reference node", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills/check-duplicate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: "TypeScript"
      })
    });
    const payload = await readJson<{
      normalizedLabel: string;
      exactMatch: boolean;
      suggestedStrategy: string;
      guidance: string;
      candidates: Array<{
        canonicalLabel: string;
        sourceCanvasName?: string;
        referenceCount: number;
        matchKind: string;
      }>;
      summary: {
        exactMatchCount: number;
        totalCandidates: number;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.normalizedLabel).toBe("typescript");
    expect(payload.exactMatch).toBe(true);
    expect(payload.suggestedStrategy).toBe("create-reference-to-existing");
    expect(payload.guidance).toContain("reference node");
    expect(payload.summary.exactMatchCount).toBe(1);
    expect(payload.summary.totalCandidates).toBe(1);
    expect(payload.candidates[0]).toMatchObject({
      canonicalLabel: "TypeScript",
      sourceCanvasName: "Inbox",
      referenceCount: 1,
      matchKind: "exact"
    });
  });

  it("rejects an empty duplicate-check label", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills/check-duplicate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: "   "
      })
    });
    const payload = await readJson<{
      error: {
        code: string;
        details?: {
          issues: Array<{
            path: string;
          }>;
        };
      };
    }>(response);

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(payload.error.details?.issues.some((issue) => issue.path === "label")).toBe(
      true
    );
  });
});
