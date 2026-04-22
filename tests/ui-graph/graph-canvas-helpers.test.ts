import { describe, expect, it } from "vitest";
import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";
import {
  createDraftNodePosition,
  getConnectionPath,
  getGraphCanvasBounds,
  moveGraphNodePosition,
  toCanvasCoordinates
} from "../../apps/web/src/lib/graph-canvas-helpers";

function createNode(
  id: string,
  x: number,
  y: number
): GraphNodeViewModel {
  return {
    id,
    label: id,
    category: "skill",
    role: "brainstorm",
    visualKind: "standard",
    colorToken: "emerald",
    position: { x, y }
  };
}

describe("graph canvas helpers", () => {
  it("creates draft positions for root, child, and sibling nodes", () => {
    const selectedNode = createNode("nod_parent", 180, 120);

    expect(
      createDraftNodePosition({
        relationship: "root",
        nodeCount: 5
      })
    ).toMatchObject({
      x: 272,
      y: 220
    });

    expect(
      createDraftNodePosition({
        relationship: "child",
        nodeCount: 3,
        selectedNode
      })
    ).toEqual({
      x: 204,
      y: 268
    });

    expect(
      createDraftNodePosition({
        relationship: "sibling",
        nodeCount: 4,
        selectedNode
      })
    ).toEqual({
      x: 392,
      y: 120
    });
  });

  it("moves nodes without allowing negative coordinates", () => {
    expect(moveGraphNodePosition({ x: 72, y: 50 }, "left", 100)).toEqual({
      x: 0,
      y: 50
    });
    expect(moveGraphNodePosition({ x: 72, y: 50 }, "up", 80)).toEqual({
      x: 72,
      y: 0
    });
    expect(moveGraphNodePosition({ x: 72, y: 50 }, "right", 20)).toEqual({
      x: 92,
      y: 50
    });
  });

  it("builds padded bounds and connection paths for rendered canvases", () => {
    const nodes = [createNode("nod_a", 32, 40), createNode("nod_b", 260, 220)];
    const bounds = getGraphCanvasBounds(nodes);

    expect(bounds.width).toBeGreaterThanOrEqual(920);
    expect(bounds.height).toBeGreaterThanOrEqual(620);

    const translated = toCanvasCoordinates(nodes[0].position, bounds);
    expect(translated.x).toBeGreaterThan(0);
    expect(translated.y).toBeGreaterThan(0);

    const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
    const edge: GraphEdgeViewModel = {
      id: "edg_a_b",
      sourceNodeId: "nod_a",
      targetNodeId: "nod_b",
      relationship: "contains"
    };

    expect(getConnectionPath({ edge, nodesById, bounds })).toContain("C");
  });
});
