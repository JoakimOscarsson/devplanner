import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Canvas, GraphEdge, GraphNode } from "@pdp-helper/contracts-graph";
import { BrainstormSpotlight } from "../../apps/web/src/modules/brainstorm/BrainstormSpotlight";
import {
  createBrainstormGatewayPort,
  loadBrainstormSnapshot
} from "../../apps/web/src/modules/brainstorm/brainstorm-gateway";
import {
  buildBrainstormPanelModel,
  deriveBrainstormCreateNodeInput,
  interpretBrainstormHotkey,
  type BrainstormSnapshot
} from "../../apps/web/src/modules/brainstorm/brainstorm-model";

const auditFields = {
  workspaceId: "wrk_demo_owner",
  createdBy: "act_demo_owner",
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z"
} as const;

function createCanvas(
  id: string,
  name: string,
  sortOrder: number,
  mode: Canvas["mode"] = "brainstorm"
): Canvas {
  return {
    id: id as Canvas["id"],
    name,
    mode,
    sortOrder,
    ...auditFields
  };
}

function createNode(
  id: string,
  canvasId: string,
  label: string,
  category: GraphNode["category"],
  position: GraphNode["position"],
  parentNodeId?: string
): GraphNode {
  return {
    id: id as GraphNode["id"],
    canvasId: canvasId as GraphNode["canvasId"],
    role: "brainstorm",
    category,
    label,
    normalizedLabel: label.toLowerCase().replace(/\s+/g, "-"),
    position,
    source: "user",
    ...(parentNodeId ? { parentNodeId: parentNodeId as GraphNode["parentNodeId"] } : {}),
    ...auditFields
  };
}

function createEdge(
  id: string,
  canvasId: string,
  sourceNodeId: string,
  targetNodeId: string,
  kind: GraphEdge["kind"] = "relates-to"
): GraphEdge {
  return {
    id: id as GraphEdge["id"],
    canvasId: canvasId as GraphEdge["canvasId"],
    sourceNodeId: sourceNodeId as GraphEdge["sourceNodeId"],
    targetNodeId: targetNodeId as GraphEdge["targetNodeId"],
    kind,
    ...auditFields
  };
}

function createSnapshot(): BrainstormSnapshot {
  const inboxCanvas = createCanvas("can_brainstorm_inbox", "Inbox", 0);
  const certificationsCanvas = createCanvas(
    "can_brainstorm_certifications",
    "Certifications",
    1
  );
  const skillGraphCanvas = createCanvas("can_skill_graph", "Skill Graph", 0, "skill-graph");

  const typeScriptNode = createNode(
    "nod_brainstorm_typescript",
    inboxCanvas.id,
    "TypeScript",
    "skill",
    { x: 64, y: 84 }
  );
  const projectNode = createNode(
    "nod_brainstorm_project",
    inboxCanvas.id,
    "Portfolio rebuild",
    "project",
    { x: 232, y: 112 },
    typeScriptNode.id
  );

  return {
    canvases: [certificationsCanvas, skillGraphCanvas, inboxCanvas],
    graphsByCanvasId: {
      [inboxCanvas.id]: {
        canvas: inboxCanvas,
        nodes: [projectNode, typeScriptNode],
        edges: [
          createEdge(
            "edg_typescript_project",
            inboxCanvas.id,
            typeScriptNode.id,
            projectNode.id,
            "contains"
          )
        ]
      },
      [certificationsCanvas.id]: {
        canvas: certificationsCanvas,
        nodes: [
          createNode(
            "nod_brainstorm_aws",
            certificationsCanvas.id,
            "AWS Developer Associate",
            "certificate",
            { x: 128, y: 48 }
          )
        ],
        edges: []
      }
    },
    selectedCanvasId: inboxCanvas.id
  };
}

describe("brainstorm module", () => {
  it("uses gateway graph proxy routes for brainstorm reads and writes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canvases: [createCanvas("can_a", "Inbox", 0)] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            canvas: createCanvas("can_a", "Inbox", 0),
            nodes: [],
            edges: []
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ canvas: createCanvas("can_b", "Career themes", 1) }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            node: createNode(
              "nod_c",
              "can_a",
              "System design",
              "skill",
              { x: 0, y: 0 }
            )
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            node: createNode(
              "nod_c",
              "can_a",
              "System design",
              "skill",
              { x: 96, y: 144 },
              "nod_root"
            )
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deletedNodeId: "nod_c" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    const port = createBrainstormGatewayPort("http://localhost:4000", fetcher);

    await port.listCanvases();
    await port.getCanvasGraph("can_a" as Canvas["id"]);
    await port.createCanvas({ name: "Career themes" });
    await port.createNode({
      canvasId: "can_a" as Canvas["id"],
      label: "System design",
      category: "skill"
    });
    await port.updateNode({
      canvasId: "can_a" as Canvas["id"],
      nodeId: "nod_c" as GraphNode["id"],
      parentNodeId: "nod_root" as GraphNode["id"],
      position: {
        x: 96,
        y: 144
      }
    });
    await port.deleteNode({
      canvasId: "can_a" as Canvas["id"],
      nodeId: "nod_c" as GraphNode["id"]
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/canvases",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/canvases/can_a/graph",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/canvases",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: "Career themes",
          mode: "brainstorm"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/canvases/can_a/nodes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "System design",
          category: "skill",
          role: "brainstorm",
          source: "user",
          position: { x: 0, y: 0 }
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "http://localhost:4000/api/v1/canvases/can_a/nodes/nod_c",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          parentNodeId: "nod_root",
          position: { x: 96, y: 144 }
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      "http://localhost:4000/api/v1/canvases/can_a/nodes/nod_c",
      {
        method: "DELETE"
      }
    );
  });

  it("loads and shapes a brainstorm-first snapshot for the selected canvas", async () => {
    const inboxCanvas = createCanvas("can_brainstorm_inbox", "Inbox", 0);
    const skillGraphCanvas = createCanvas("can_skill_graph", "Skill Graph", 0, "skill-graph");
    const certificationsCanvas = createCanvas(
      "can_brainstorm_certifications",
      "Certifications",
      1
    );

    const snapshot = await loadBrainstormSnapshot({
      listCanvases: async () => ({
        canvases: [skillGraphCanvas, certificationsCanvas, inboxCanvas]
      }),
      getCanvasGraph: async () => ({
        canvas: inboxCanvas,
        nodes: [
          createNode(
            "nod_brainstorm_typescript",
            inboxCanvas.id,
            "TypeScript",
            "skill",
            { x: 64, y: 84 }
          ),
          createNode(
            "nod_brainstorm_project",
            inboxCanvas.id,
            "Portfolio rebuild",
            "project",
            { x: 232, y: 112 },
            "nod_brainstorm_typescript"
          )
        ],
        edges: [
          createEdge(
            "edg_typescript_project",
            inboxCanvas.id,
            "nod_brainstorm_typescript",
            "nod_brainstorm_project",
            "contains"
          )
        ]
      })
    });

    const model = buildBrainstormPanelModel(snapshot, {
      canvasHrefBuilder: (canvas) => `/brainstorm/${canvas.id}`
    });

    expect(snapshot.selectedCanvasId).toBe(inboxCanvas.id);
    expect(model.canvasSummaries.map((canvas) => canvas.name)).toEqual([
      "Inbox",
      "Certifications"
    ]);
    expect(model.selectedCanvas?.name).toBe("Inbox");
    expect(model.selectedCanvas?.href).toBe("/brainstorm/can_brainstorm_inbox");
    expect(model.selectedCanvas?.nodes[0]).toMatchObject({
      label: "Portfolio rebuild",
      parentLabel: "TypeScript",
      incomingCount: 1
    });
    expect(model.selectedCanvas?.nodes[1]).toMatchObject({
      label: "TypeScript",
      outgoingCount: 1
    });
  });

  it("builds demo-friendly canvas and node summaries from injected snapshot data", () => {
    const model = buildBrainstormPanelModel(createSnapshot(), {
      canvasHrefBuilder: (canvas) => `/brainstorm/${canvas.id}`
    });

    expect(model.canvasSummaries).toEqual([
      expect.objectContaining({
        id: "can_brainstorm_inbox",
        name: "Inbox",
        isSelected: true,
        href: "/brainstorm/can_brainstorm_inbox",
        graphLoaded: true,
        nodeCount: 2,
        edgeCount: 1
      }),
      expect.objectContaining({
        id: "can_brainstorm_certifications",
        name: "Certifications",
        isSelected: false,
        href: "/brainstorm/can_brainstorm_certifications",
        graphLoaded: true,
        nodeCount: 1,
        edgeCount: 0
      })
    ]);
    expect(model.selectedCanvas?.relationships[0]).toMatchObject({
      sourceLabel: "TypeScript",
      relationship: "contains",
      targetLabel: "Portfolio rebuild"
    });
    expect(model.selectedCanvas?.nodes.map((node) => node.label)).toEqual([
      "Portfolio rebuild",
      "TypeScript"
    ]);
  });

  it("uses shared brainstorm layout rules when node positions overlap", () => {
    const canvas = createCanvas("can_brainstorm_overlap", "Overlapping ideas", 0);
    const snapshot: BrainstormSnapshot = {
      canvases: [canvas],
      graphsByCanvasId: {
        [canvas.id]: {
          canvas,
          nodes: [
            createNode("nod_overlap_a", canvas.id, "Architecture", "skill", {
              x: 40,
              y: 48
            }),
            createNode("nod_overlap_b", canvas.id, "Roadmap", "project", {
              x: 40,
              y: 48
            })
          ],
          edges: []
        }
      },
      selectedCanvasId: canvas.id
    };

    const model = buildBrainstormPanelModel(snapshot);
    const positions = model.selectedCanvas?.nodes.map((node) => node.positionLabel);

    expect(positions).toHaveLength(2);
    expect(new Set(positions).size).toBe(2);
  });

  it("derives root, child, and sibling creation plans and maps keyboard shortcuts", () => {
    const graph = createSnapshot().graphsByCanvasId["can_brainstorm_inbox"];

    expect(
      deriveBrainstormCreateNodeInput(graph!, {
        intent: "root",
        label: "Architecture study",
        category: "skill"
      })
    ).toMatchObject({
      label: "Architecture study",
      category: "skill",
      position: { x: 64, y: 272 }
    });

    expect(
      deriveBrainstormCreateNodeInput(graph!, {
        intent: "child",
        anchorNodeId: "nod_brainstorm_typescript",
        label: "Review docs",
        category: "course"
      })
    ).toMatchObject({
      parentNodeId: "nod_brainstorm_typescript",
      position: { x: 304, y: 272 }
    });

    expect(
      deriveBrainstormCreateNodeInput(graph!, {
        intent: "sibling",
        anchorNodeId: "nod_brainstorm_project",
        label: "Ship tracker",
        category: "project"
      })
    ).toMatchObject({
      parentNodeId: "nod_brainstorm_typescript",
      position: { x: 304, y: 272 }
    });

    expect(
      interpretBrainstormHotkey({
        key: "n",
        targetTagName: "div"
      })
    ).toBe("compose-root");
    expect(
      interpretBrainstormHotkey({
        key: "r",
        targetTagName: "div"
      })
    ).toBeNull();
    expect(
      interpretBrainstormHotkey({
        key: "c",
        targetTagName: "div"
      })
    ).toBe("compose-child");
    expect(
      interpretBrainstormHotkey({
        key: "a",
        targetTagName: "div"
      })
    ).toBe("compose-sibling");
    expect(
      interpretBrainstormHotkey({
        key: "ArrowLeft",
        targetTagName: "div"
      })
    ).toBe("move-left");
    expect(
      interpretBrainstormHotkey({
        key: "Backspace",
        targetTagName: "input"
      })
    ).toBeNull();
  });

  it("renders a mind-map canvas with command hints and node actions", () => {
    const markup = renderToStaticMarkup(
      createElement(BrainstormSpotlight, {
        snapshot: createSnapshot()
      })
    );

    expect(markup).toContain("Canvases");
    expect(markup).toContain("Add root");
    expect(markup).toContain("Move under");
    expect(markup).toContain("Reset view");
    expect(markup).toContain("Drag empty space to pan.");
    expect(markup).toContain("Select a node to edit it, move it under another node, or drag the whole branch.");
    expect(markup).toContain("Select a node to edit, reparent, or remove it.");
  });
});
