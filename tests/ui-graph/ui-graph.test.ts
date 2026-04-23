import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode } from "@pdp-helper/contracts-graph";
import {
  createDeterministicAutoLayout,
  deriveChildNodePlacement,
  deriveReparentedNodePlacement,
  deriveRootNodePlacement,
  deriveSiblingNodePlacement,
  needsBrainstormAutoLayout,
  toGraphCanvasViewModel
} from "@pdp-helper/ui-graph";

const DEFAULT_TIMESTAMP = "2026-04-22T00:00:00Z";

function buildNode(input: {
  id: string;
  label: string;
  category: GraphNode["category"];
  role?: GraphNode["role"];
  x?: number;
  y?: number;
}): GraphNode {
  return {
    id: input.id as GraphNode["id"],
    canvasId: "can_brainstorm_demo" as GraphNode["canvasId"],
    role: input.role ?? "brainstorm",
    category: input.category,
    label: input.label,
    normalizedLabel: input.label.toLowerCase(),
    position: {
      x: input.x ?? 0,
      y: input.y ?? 0
    },
    source: "user",
    workspaceId: "wrk_demo" as GraphNode["workspaceId"],
    createdBy: "act_demo" as GraphNode["createdBy"],
    createdAt: DEFAULT_TIMESTAMP as GraphNode["createdAt"],
    updatedAt: DEFAULT_TIMESTAMP as GraphNode["updatedAt"]
  };
}

function buildEdge(input: {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  kind?: GraphEdge["kind"];
}): GraphEdge {
  return {
    id: input.id as GraphEdge["id"],
    canvasId: "can_brainstorm_demo" as GraphEdge["canvasId"],
    sourceNodeId: input.sourceNodeId as GraphEdge["sourceNodeId"],
    targetNodeId: input.targetNodeId as GraphEdge["targetNodeId"],
    kind: input.kind ?? "relates-to",
    workspaceId: "wrk_demo" as GraphEdge["workspaceId"],
    createdBy: "act_demo" as GraphEdge["createdBy"],
    createdAt: DEFAULT_TIMESTAMP as GraphEdge["createdAt"],
    updatedAt: DEFAULT_TIMESTAMP as GraphEdge["updatedAt"]
  };
}

function positionsById(
  nodes: readonly {
    readonly id: string;
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
  }[]
) {
  return Object.fromEntries(
    [...nodes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((node) => [node.id, { x: node.position.x, y: node.position.y }])
  );
}

describe("ui-graph", () => {
  it("maps graph-service nodes and edges into canvas view models", () => {
    const nodes = [
      buildNode({
        id: "nod_typescript",
        label: "TypeScript",
        category: "skill",
        role: "skill",
        x: 32,
        y: 48
      }),
      buildNode({
        id: "nod_recommendation",
        label: "Practice event-driven design",
        category: "recommendation",
        role: "recommendation",
        x: 320,
        y: 72
      })
    ];
    const edges = [
      buildEdge({
        id: "edg_supports",
        sourceNodeId: "nod_typescript",
        targetNodeId: "nod_recommendation",
        kind: "relates-to"
      })
    ];

    const canvas = toGraphCanvasViewModel({
      mode: "brainstorm",
      nodes,
      edges
    });

    expect(canvas.nodes).toEqual([
      {
        id: "nod_typescript",
        label: "TypeScript",
        category: "skill",
        role: "skill",
        visualKind: "standard",
        colorToken: "emerald",
        position: { x: 32, y: 48 }
      },
      {
        id: "nod_recommendation",
        label: "Practice event-driven design",
        category: "recommendation",
        role: "recommendation",
        visualKind: "recommendation",
        colorToken: "lime",
        position: { x: 320, y: 72 }
      }
    ]);
    expect(canvas.edges).toEqual([
      {
        id: "edg_supports",
        sourceNodeId: "nod_typescript",
        targetNodeId: "nod_recommendation",
        relationship: "relates-to"
      }
    ]);
    expect(needsBrainstormAutoLayout(canvas.nodes)).toBe(false);
  });

  it("applies a deterministic brainstorm layout when positions are clustered", () => {
    const nodes = [
      buildNode({
        id: "nod_alpha",
        label: "Alpha",
        category: "skill",
        x: 0,
        y: 0
      }),
      buildNode({
        id: "nod_beta",
        label: "Beta",
        category: "course",
        x: 4,
        y: 6
      }),
      buildNode({
        id: "nod_gamma",
        label: "Gamma",
        category: "project",
        x: 8,
        y: 10
      }),
      buildNode({
        id: "nod_delta",
        label: "Delta",
        category: "note",
        x: 0,
        y: 0
      })
    ];
    const edges = [
      buildEdge({
        id: "edg_alpha_beta",
        sourceNodeId: "nod_alpha",
        targetNodeId: "nod_beta"
      }),
      buildEdge({
        id: "edg_alpha_gamma",
        sourceNodeId: "nod_alpha",
        targetNodeId: "nod_gamma"
      }),
      buildEdge({
        id: "edg_gamma_delta",
        sourceNodeId: "nod_gamma",
        targetNodeId: "nod_delta"
      })
    ];

    const first = toGraphCanvasViewModel({
      mode: "brainstorm",
      nodes,
      edges
    });
    const second = toGraphCanvasViewModel({
      mode: "brainstorm",
      nodes: [...nodes].reverse(),
      edges: [...edges].reverse()
    });

    expect(positionsById(first.nodes)).toEqual({
      nod_alpha: { x: 48, y: 48 },
      nod_beta: { x: 288, y: 48 },
      nod_delta: { x: 528, y: 48 },
      nod_gamma: { x: 288, y: 208 }
    });
    expect(positionsById(second.nodes)).toEqual(positionsById(first.nodes));
    expect(needsBrainstormAutoLayout(first.nodes)).toBe(false);
  });

  it("keeps clustered skill-graph positions untouched", () => {
    const nodes = [
      buildNode({
        id: "nod_skill_a",
        label: "Backend",
        category: "skill",
        role: "skill",
        x: 0,
        y: 0
      }),
      buildNode({
        id: "nod_skill_b",
        label: "Distributed systems",
        category: "skill",
        role: "skill",
        x: 0,
        y: 0
      })
    ];

    const canvas = toGraphCanvasViewModel({
      mode: "skill-graph",
      nodes,
      edges: []
    });

    expect(positionsById(canvas.nodes)).toEqual({
      nod_skill_a: { x: 0, y: 0 },
      nod_skill_b: { x: 0, y: 0 }
    });
  });

  it("exposes the deterministic brainstorm layout through AutoLayoutPort", async () => {
    const port = createDeterministicAutoLayout();
    const nodes = toGraphCanvasViewModel({
      mode: "skill-graph",
      nodes: [
        buildNode({
          id: "nod_autolayout_a",
          label: "Architecture",
          category: "skill",
          x: Number.NaN,
          y: Number.NaN
        }),
        buildNode({
          id: "nod_autolayout_b",
          label: "Practice",
          category: "project",
          x: 0,
          y: 0
        })
      ],
      edges: []
    }).nodes;

    const arranged = await port.arrange({
      mode: "brainstorm",
      nodes,
      edges: []
    });

    expect(positionsById(arranged.nodes)).toEqual({
      nod_autolayout_a: { x: 48, y: 48 },
      nod_autolayout_b: { x: 328, y: 48 }
    });
    expect(needsBrainstormAutoLayout(arranged.nodes)).toBe(false);
  });

  it("derives deterministic placements for root, child, sibling, and reparent flows", () => {
    const nodes = [
      {
        id: "nod_root",
        label: "Root",
        category: "skill",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "emerald",
        position: { x: 48, y: 48 }
      },
      {
        id: "nod_child_a",
        label: "Child A",
        category: "project",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "blue",
        parentNodeId: "nod_root",
        position: { x: 288, y: 48 }
      },
      {
        id: "nod_child_b",
        label: "Child B",
        category: "course",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "teal",
        parentNodeId: "nod_root",
        position: { x: 288, y: 208 }
      },
      {
        id: "nod_other",
        label: "Other",
        category: "note",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "stone",
        position: { x: 48, y: 248 }
      }
    ] as const;

    expect(deriveRootNodePlacement(nodes)).toEqual({
      x: 48,
      y: 408
    });
    expect(deriveChildNodePlacement(nodes, "nod_root")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 368
    });
    expect(deriveSiblingNodePlacement(nodes, "nod_child_a")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 368
    });
    expect(
      deriveReparentedNodePlacement(nodes, {
        nodeId: "nod_child_a",
        nextParentNodeId: "nod_other"
      })
    ).toEqual({
      parentNodeId: "nod_other",
      x: 288,
      y: 248
    });
  });

  it("places the next child below an existing only child", () => {
    const nodes = [
      {
        id: "nod_root",
        label: "Root",
        category: "skill",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "teal",
        position: { x: 48, y: 48 }
      },
      {
        id: "nod_child_a",
        label: "Child A",
        category: "course",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "amber",
        parentNodeId: "nod_root",
        position: { x: 288, y: 208 }
      }
    ] as const;

    expect(deriveChildNodePlacement(nodes, "nod_root")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 368
    });
    expect(deriveSiblingNodePlacement(nodes, "nod_child_a")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 368
    });
  });

  it("places new siblings after the full sibling branch footprint", () => {
    const nodes = [
      {
        id: "nod_root",
        label: "Root",
        category: "skill",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "teal",
        position: { x: 48, y: 48 }
      },
      {
        id: "nod_child_a",
        label: "Child A",
        category: "course",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "amber",
        parentNodeId: "nod_root",
        position: { x: 288, y: 208 }
      },
      {
        id: "nod_grandchild_a",
        label: "Grandchild A",
        category: "note",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "stone",
        parentNodeId: "nod_child_a",
        position: { x: 528, y: 448 }
      }
    ] as const;

    expect(deriveChildNodePlacement(nodes, "nod_root")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 608
    });
    expect(deriveSiblingNodePlacement(nodes, "nod_child_a")).toEqual({
      parentNodeId: "nod_root",
      x: 288,
      y: 608
    });
  });
});
