import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GraphNode, Skill } from "@pdp-helper/contracts-graph";
import { createService } from "@pdp-helper/runtime-node";
import { graphCanvasRoutes } from "../../services/graph-service/src/routes/canvases";
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
      routes: [graphHealthRoute, ...graphCanvasRoutes, ...graphSkillRoutes]
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
      skillGraph: {
        canvas: {
          id: string;
          mode: string;
        };
        nodes: Array<{
          id: string;
          role: string;
        }>;
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
    expect(payload.skillGraph.canvas).toMatchObject({
      id: "can_skill_graph",
      mode: "skill-graph"
    });
    expect(payload.skillGraph.nodes.some((node) => node.role === "skill")).toBe(true);
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

  it("promotes a brainstorm node into a canonical skill and skill-graph node", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills/promote`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        nodeId: "nod_brainstorm_aws",
        preferredSkillId: "skl_aws_developer_associate"
      })
    });
    const payload = await readJson<{
      skill: Skill;
      skillNode: GraphNode;
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.skill.id).toBe("skl_aws_developer_associate");
    expect(payload.skill.canonicalLabel).toBe("AWS Developer Associate");
    expect(payload.skill.sourceNodeId).toBe("nod_brainstorm_aws");
    expect(payload.skillNode.role).toBe("skill");
    expect(payload.skillNode.canvasId).toBe("can_skill_graph");
    expect(payload.skillNode.label).toBe("AWS Developer Associate");

    const inventoryResponse = await fetch(`${baseUrl}/v1/skills`);
    const inventoryPayload = await readJson<{
      summary: {
        totalCanonicalSkills: number;
      };
      inventory: Array<{
        canonicalLabel: string;
      }>;
    }>(inventoryResponse);

    expect(inventoryPayload.summary.totalCanonicalSkills).toBe(3);
    expect(
      inventoryPayload.inventory.some(
        (skill) => skill.canonicalLabel === "AWS Developer Associate"
      )
    ).toBe(true);
  });

  it("requires duplicate resolution before promoting a duplicate canonical skill", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills/promote`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        nodeId: "nod_brainstorm_typescript",
        preferredSkillId: "skl_typescript_duplicate"
      })
    });
    const payload = await readJson<{
      error: {
        code: string;
        details?: {
          normalizedLabel?: string;
          candidates?: Array<{
            canonicalLabel: string;
          }>;
        };
      };
    }>(response);

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("SKILL_RESOLUTION_REQUIRED");
    expect(payload.error.details?.normalizedLabel).toBe("typescript");
    expect(payload.error.details?.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalLabel: "TypeScript"
        })
      ])
    );
  });

  it("resolves a duplicate by creating a reference node for an existing canonical skill", async () => {
    const { baseUrl } = await startServer();

    const createNodeResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_certifications/nodes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "TypeScript",
          category: "skill"
        })
      }
    );
    const createNodePayload = await readJson<{ node: GraphNode }>(createNodeResponse);

    const response = await fetch(`${baseUrl}/v1/skills/resolve-duplicate`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        nodeId: createNodePayload.node.id,
        canonicalSkillId: "skl_typescript",
        strategy: "create-reference-to-existing"
      })
    });
    const payload = await readJson<{
      canonicalSkill: Skill;
      referenceNode: GraphNode;
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.canonicalSkill.id).toBe("skl_typescript");
    expect(payload.referenceNode.role).toBe("reference");
    expect(payload.referenceNode.canvasId).toBe("can_skill_graph");
    expect(payload.referenceNode.metadata).toMatchObject({
      skillId: "skl_typescript",
      sourceNodeId: createNodePayload.node.id
    });

    const inventoryResponse = await fetch(`${baseUrl}/v1/skills`);
    const inventoryPayload = await readJson<{
      inventory: Array<{
        skillId: string;
        referenceCount: number;
      }>;
    }>(inventoryResponse);

    const typescriptEntry = inventoryPayload.inventory.find(
      (entry) => entry.skillId === "skl_typescript"
    );

    expect(typescriptEntry?.referenceCount).toBe(2);
  });

  it("creates an explicit skill reference in the target canvas", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/skills/skl_event_architecture/references`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        canvasId: "can_skill_graph",
        label: "EDA for message brokers"
      })
    });
    const payload = await readJson<{
      canonicalSkill: Skill;
      referenceNode: GraphNode;
    }>(response);

    expect(response.status).toBe(201);
    expect(payload.canonicalSkill.id).toBe("skl_event_architecture");
    expect(payload.referenceNode.role).toBe("reference");
    expect(payload.referenceNode.label).toBe("EDA for message brokers");
    expect(payload.referenceNode.metadata).toMatchObject({
      skillId: "skl_event_architecture"
    });
  });
});
