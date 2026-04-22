import { describe, expect, it } from "vitest";
import type { GraphNode } from "@pdp-helper/contracts-graph";
import {
  applyDeterministicLayout,
  createGraphCanvasView
} from "@pdp-helper/ui-graph";

describe("ui-graph layout helpers", () => {
  it("spreads overlapping node cards into distinct positions", () => {
    const laidOut = applyDeterministicLayout(
      [
        {
          id: "nod_a",
          label: "A",
          category: "skill",
          role: "brainstorm",
          visualKind: "standard",
          colorToken: "emerald",
          position: { x: 40, y: 48 }
        },
        {
          id: "nod_b",
          label: "B",
          category: "course",
          role: "brainstorm",
          visualKind: "standard",
          colorToken: "teal",
          position: { x: 40, y: 48 }
        }
      ],
      "brainstorm"
    );

    expect(laidOut[0]?.position).not.toEqual(laidOut[1]?.position);
  });

  it("maps raw graph-service data into a stable canvas view", () => {
    const nodes = [
      {
        id: "nod_typescript",
        canvasId: "can_demo",
        role: "brainstorm",
        category: "skill",
        label: "TypeScript",
        normalizedLabel: "typescript",
        position: { x: 40, y: 48 },
        source: "user",
        workspaceId: "wrk_demo",
        createdBy: "act_demo",
        createdAt: "2026-04-22T00:00:00Z",
        updatedAt: "2026-04-22T00:00:00Z"
      },
      {
        id: "nod_goals",
        canvasId: "can_demo",
        role: "brainstorm",
        category: "goal",
        label: "Architecture notes",
        normalizedLabel: "architecture-notes",
        position: { x: 40, y: 48 },
        source: "user",
        workspaceId: "wrk_demo",
        createdBy: "act_demo",
        createdAt: "2026-04-22T00:00:00Z",
        updatedAt: "2026-04-22T00:00:00Z"
      }
    ] satisfies GraphNode[];

    const view = createGraphCanvasView({
      mode: "brainstorm",
      nodes,
      edges: []
    });

    expect(view.nodes).toHaveLength(2);
    expect(view.nodes[0]?.colorToken).toBeTruthy();
    expect(view.nodes[0]?.position).not.toEqual(view.nodes[1]?.position);
  });
});
