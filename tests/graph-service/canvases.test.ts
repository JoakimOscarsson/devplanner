import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Canvas, GraphEdge, GraphNode } from "@pdp-helper/contracts-graph";
import { createService } from "@pdp-helper/runtime-node";
import { graphCanvasRoutes } from "../../services/graph-service/src/routes/canvases";
import { resetGraphStore } from "../../services/graph-service/src/storage/in-memory";

async function waitForListening(server: ReturnType<typeof createService>) {
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });
}

async function readJson<TPayload>(response: Response) {
  return (await response.json()) as TPayload;
}

describe("graph-service canvas routes", () => {
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
      routes: [...graphCanvasRoutes]
    });
    servers.push(server);
    await waitForListening(server);

    const port = (server.address() as AddressInfo).port;

    return {
      baseUrl: `http://127.0.0.1:${port}`
    };
  }

  it("creates a brainstorm canvas", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/canvases`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Learning backlog"
      })
    });

    const payload = await readJson<{ canvas: Canvas }>(response);

    expect(response.status).toBe(201);
    expect(payload.canvas.id).toMatch(/^can_/);
    expect(payload.canvas.mode).toBe("brainstorm");
    expect(payload.canvas.name).toBe("Learning backlog");
    expect(payload.canvas.sortOrder).toBe(2);

    const listResponse = await fetch(`${baseUrl}/v1/canvases`);
    const listPayload = await readJson<{ canvases: Canvas[] }>(listResponse);
    const brainstormCanvases = listPayload.canvases
      .filter((canvas) => canvas.mode === "brainstorm")
      .sort((left, right) => left.sortOrder - right.sortOrder);

    expect(brainstormCanvases.map((canvas) => canvas.name)).toEqual([
      "Inbox",
      "Certifications",
      "Learning backlog"
    ]);
  });

  it("renames and reorders a brainstorm canvas", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_certifications`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Career Certifications",
          sortOrder: 0
        })
      }
    );

    const payload = await readJson<{ canvas: Canvas }>(response);

    expect(response.status).toBe(200);
    expect(payload.canvas.name).toBe("Career Certifications");
    expect(payload.canvas.sortOrder).toBe(0);

    const listResponse = await fetch(`${baseUrl}/v1/canvases`);
    const listPayload = await readJson<{ canvases: Canvas[] }>(listResponse);
    const brainstormCanvases = listPayload.canvases
      .filter((canvas) => canvas.mode === "brainstorm")
      .sort((left, right) => left.sortOrder - right.sortOrder);

    expect(
      brainstormCanvases.map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        sortOrder: canvas.sortOrder
      }))
    ).toEqual([
      {
        id: "can_brainstorm_certifications",
        name: "Career Certifications",
        sortOrder: 0
      },
      {
        id: "can_brainstorm_inbox",
        name: "Inbox",
        sortOrder: 1
      }
    ]);
  });

  it("creates and updates a brainstorm node", async () => {
    const { baseUrl } = await startServer();

    const createResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "Event Storming",
          tag: "course",
          description: "Workshop notes",
          position: {
            x: 180,
            y: 220
          },
          parentNodeId: "nod_brainstorm_typescript"
        })
      }
    );

    const createPayload = await readJson<{ node: GraphNode }>(createResponse);

    expect(createResponse.status).toBe(201);
    expect(createPayload.node.id).toMatch(/^nod_/);
    expect(createPayload.node.role).toBe("brainstorm");
    expect(createPayload.node.source).toBe("user");
    expect(createPayload.node.normalizedLabel).toBe("event-storming");
    expect(createPayload.node.parentNodeId).toBe("nod_brainstorm_typescript");

    const graphAfterCreate = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/graph`
    );
    const createdGraph = await readJson<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(graphAfterCreate);

    expect(
      createdGraph.edges.some(
        (edge) =>
          edge.kind === "contains" &&
          edge.sourceNodeId === "nod_brainstorm_typescript" &&
          edge.targetNodeId === createPayload.node.id
      )
    ).toBe(true);

    const updateResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes/${createPayload.node.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "Event-Driven Design",
          tag: "note",
          description: null,
          position: {
            x: 256,
            y: 320
          },
          parentNodeId: null
        })
      }
    );

    const updatePayload = await readJson<{ node: GraphNode }>(updateResponse);

    expect(updateResponse.status).toBe(200);
    expect(updatePayload.node.label).toBe("Event-Driven Design");
    expect(updatePayload.node.category).toBe("custom");
    expect(updatePayload.node.metadata).toMatchObject({
      tag: "note",
      tags: ["note"]
    });
    expect(updatePayload.node.description).toBeUndefined();
    expect(updatePayload.node.parentNodeId).toBeUndefined();
    expect(updatePayload.node.position).toEqual({
      x: 256,
      y: 320
    });
    expect(updatePayload.node.normalizedLabel).toBe("event-driven-design");

    const graphAfterUpdate = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/graph`
    );
    const updatedGraph = await readJson<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(graphAfterUpdate);
    const updatedNode = updatedGraph.nodes.find(
      (node) => node.id === createPayload.node.id
    );

    expect(updatedNode).toMatchObject({
      id: createPayload.node.id,
      label: "Event-Driven Design",
      category: "custom",
      metadata: {
        tag: "note",
        tags: ["note"]
      },
      normalizedLabel: "event-driven-design",
      position: {
        x: 256,
        y: 320
      }
    });
    expect(updatedNode?.description).toBeUndefined();
    expect(updatedNode?.parentNodeId).toBeUndefined();
    expect(
      updatedGraph.edges.some((edge) => edge.targetNodeId === createPayload.node.id)
    ).toBe(false);
  });

  it("deletes a node and removes attached edges", async () => {
    const { baseUrl } = await startServer();

    const deleteResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_certifications/nodes/nod_brainstorm_aws`,
      {
        method: "DELETE"
      }
    );

    const deletePayload = await readJson<{ deletedNodeId: string }>(deleteResponse);

    expect(deleteResponse.status).toBe(200);
    expect(deletePayload.deletedNodeId).toBe("nod_brainstorm_aws");

    const graphResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_certifications/graph`
    );
    const graphPayload = await readJson<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(graphResponse);

    expect(
      graphPayload.nodes.some((node) => node.id === "nod_brainstorm_aws")
    ).toBe(false);
    expect(
      graphPayload.edges.some((edge) => edge.id === "edg_aws_typescript")
    ).toBe(false);
    expect(
      graphPayload.edges.some(
        (edge) =>
          edge.sourceNodeId === "nod_brainstorm_aws" ||
          edge.targetNodeId === "nod_brainstorm_aws"
      )
    ).toBe(false);
  });

  it("reparents a node by replacing its contains edge", async () => {
    const { baseUrl } = await startServer();

    const siblingResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "Node.js runtime",
          tag: "skill",
          position: {
            x: 300,
            y: 100
          }
        })
      }
    );
    const siblingPayload = await readJson<{ node: GraphNode }>(siblingResponse);

    const childResponse = await fetch(`${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: "Node event loop notes",
        tag: "note",
        parentNodeId: "nod_brainstorm_typescript"
      })
    });
    const childPayload = await readJson<{ node: GraphNode }>(childResponse);

    const reparentResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes/${childPayload.node.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          parentNodeId: siblingPayload.node.id
        })
      }
    );

    const reparentPayload = await readJson<{ node: GraphNode }>(reparentResponse);

    expect(reparentResponse.status).toBe(200);
    expect(reparentPayload.node.parentNodeId).toBe(siblingPayload.node.id);

    const graphResponse = await fetch(`${baseUrl}/v1/canvases/can_brainstorm_inbox/graph`);
    const graphPayload = await readJson<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(graphResponse);

    expect(
      graphPayload.edges.some(
        (edge) =>
          edge.kind === "contains" &&
          edge.sourceNodeId === siblingPayload.node.id &&
          edge.targetNodeId === childPayload.node.id
      )
    ).toBe(true);
    expect(
      graphPayload.edges.some(
        (edge) =>
          edge.kind === "contains" &&
          edge.sourceNodeId === "nod_brainstorm_typescript" &&
          edge.targetNodeId === childPayload.node.id
      )
    ).toBe(false);
  });

  it("detaches direct children when deleting a parent", async () => {
    const { baseUrl } = await startServer();

    const createParentResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "Portfolio rebuild",
          tag: "project",
          position: {
            x: 240,
            y: 180
          },
          parentNodeId: "nod_brainstorm_typescript"
        })
      }
    );
    const createParentPayload = await readJson<{ node: GraphNode }>(createParentResponse);

    expect(createParentResponse.status).toBe(201);

    const createResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "Architecture notes",
          tag: "note",
          position: {
            x: 240,
            y: 260
          },
          parentNodeId: createParentPayload.node.id
        })
      }
    );
    const createPayload = await readJson<{ node: GraphNode }>(createResponse);

    expect(createResponse.status).toBe(201);

    const deleteResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes/${createParentPayload.node.id}`,
      {
        method: "DELETE"
      }
    );

    expect(deleteResponse.status).toBe(200);

    const graphResponse = await fetch(`${baseUrl}/v1/canvases/can_brainstorm_inbox/graph`);
    const graphPayload = await readJson<{
      nodes: GraphNode[];
      edges: GraphEdge[];
    }>(graphResponse);
    const detachedChild = graphPayload.nodes.find(
      (node) => node.id === createPayload.node.id
    );

    expect(detachedChild?.parentNodeId).toBeUndefined();
    expect(
      graphPayload.edges.some((edge) => edge.targetNodeId === createPayload.node.id)
    ).toBe(false);
  });

  it("rejects moving a brainstorm node into its own subtree", async () => {
    const { baseUrl } = await startServer();

    const parentResponse = await fetch(`${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: "Portfolio rebuild",
        tag: "project",
        parentNodeId: "nod_brainstorm_typescript"
      })
    });
    const parentPayload = await readJson<{ node: GraphNode }>(parentResponse);

    expect(parentResponse.status).toBe(201);

    const childResponse = await fetch(`${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        label: "Architecture",
        tag: "skill",
        parentNodeId: parentPayload.node.id
      })
    });
    const childPayload = await readJson<{ node: GraphNode }>(childResponse);

    expect(childResponse.status).toBe(201);

    const cycleResponse = await fetch(
      `${baseUrl}/v1/canvases/can_brainstorm_inbox/nodes/${parentPayload.node.id}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          parentNodeId: childPayload.node.id
        })
      }
    );
    const cyclePayload = await readJson<{
      error: {
        code: string;
        message: string;
      };
    }>(cycleResponse);

    expect(cycleResponse.status).toBe(422);
    expect(cyclePayload.error.code).toBe("VALIDATION_FAILED");
    expect(cyclePayload.error.message).toContain("own subtree");
  });
});
