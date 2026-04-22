import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  createSkillsGatewayPort,
  loadSkillsSnapshot
} from "../../apps/web/src/modules/skills/skills-gateway";
import {
  buildSkillsPanelModel,
  EMPTY_SKILLS_SNAPSHOT,
  SKILL_TREE_DEPTH_LIMIT,
  flattenVisibleSkillTree,
  interpretSkillTreeHotkey,
  moveSkillTreeSelection,
  type SkillsSnapshot
} from "../../apps/web/src/modules/skills/skills-model";
import { SkillsSpotlight } from "../../apps/web/src/modules/skills/SkillsSpotlight";

function createSnapshot(): SkillsSnapshot {
  return {
    inventory: [
      {
        skillId: "skl_frontend",
        canonicalLabel: "Frontend",
        normalizedLabel: "frontend",
        sourceCanvasName: "Skill Graph",
        sourceNodeLabel: "Frontend",
        referenceCount: 0
      },
      {
        skillId: "skl_typescript",
        canonicalLabel: "TypeScript",
        normalizedLabel: "typescript",
        sourceCanvasName: "Inbox",
        sourceNodeLabel: "TypeScript",
        referenceCount: 1
      }
    ],
    summary: {
      totalCanonicalSkills: 2,
      totalReferenceNodes: 1,
      totalSkillGraphNodes: 3
    },
    promotionCandidates: [],
    skillGraph: {
      canvas: {
        id: "can_skill_graph" as never,
        name: "Skill Graph",
        mode: "skill-graph",
        sortOrder: 0,
        workspaceId: "wrk_demo_owner",
        createdBy: "act_demo_owner",
        createdAt: "2026-04-22T08:00:00.000Z",
        updatedAt: "2026-04-22T08:00:00.000Z"
      },
      nodes: [
        {
          id: "nod_skill_frontend",
          canvasId: "can_skill_graph",
          role: "skill",
          category: "skill",
          label: "Frontend",
          normalizedLabel: "frontend",
          position: { x: 0, y: 0 },
          source: "user",
          metadata: {
            skillId: "skl_frontend",
            sortOrder: 0,
            tag: "focus",
            color: "#3b82f6"
          },
          workspaceId: "wrk_demo_owner",
          createdBy: "act_demo_owner",
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z"
        },
        {
          id: "nod_skill_typescript",
          canvasId: "can_skill_graph",
          role: "skill",
          category: "skill",
          label: "TypeScript",
          normalizedLabel: "typescript",
          description: "Type-safe frontend work",
          parentNodeId: "nod_skill_frontend",
          position: { x: 0, y: 0 },
          source: "user",
          metadata: {
            skillId: "skl_typescript",
            sortOrder: 0,
            tag: "technical",
            color: "#8b5cf6"
          },
          workspaceId: "wrk_demo_owner",
          createdBy: "act_demo_owner",
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z"
        },
        {
          id: "nod_reference_typescript_project",
          canvasId: "can_skill_graph",
          role: "reference",
          category: "skill",
          label: "TypeScript in projects",
          normalizedLabel: "typescript-in-projects",
          parentNodeId: "nod_skill_typescript",
          position: { x: 0, y: 0 },
          source: "user",
          metadata: {
            skillId: "skl_typescript",
            sortOrder: 0
          },
          workspaceId: "wrk_demo_owner",
          createdBy: "act_demo_owner",
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z"
        }
      ],
      edges: [
        {
          id: "edg_frontend_typescript",
          canvasId: "can_skill_graph",
          sourceNodeId: "nod_skill_frontend",
          targetNodeId: "nod_skill_typescript",
          kind: "contains",
          workspaceId: "wrk_demo_owner",
          createdBy: "act_demo_owner",
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z"
        },
        {
          id: "edg_typescript_reference",
          canvasId: "can_skill_graph",
          sourceNodeId: "nod_skill_typescript",
          targetNodeId: "nod_reference_typescript_project",
          kind: "contains",
          workspaceId: "wrk_demo_owner",
          createdBy: "act_demo_owner",
          createdAt: "2026-04-22T08:00:00.000Z",
          updatedAt: "2026-04-22T08:00:00.000Z"
        }
      ]
    }
  };
}

describe("skills module", () => {
  it("uses gateway skill routes for skill-tree CRUD flows", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    const port = createSkillsGatewayPort("http://localhost:4000", fetcher);

    await port.createSkillTreeNode({
      label: "API Design",
      parentNodeId: "nod_skill_frontend"
    });
    await port.updateSkillTreeNode({
      nodeId: "nod_skill_typescript",
      label: "JavaScript / TypeScript",
      tag: "technical",
      color: "#8b5cf6"
    });
    await port.reorderSkillTreeNode({
      nodeId: "nod_skill_typescript",
      parentNodeId: "nod_skill_frontend",
      targetIndex: 0
    });
    await port.deleteSkillTreeNode("nod_skill_typescript");

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/skills/tree/nodes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "API Design",
          parentNodeId: "nod_skill_frontend"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/skills/tree/nodes/nod_skill_typescript",
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "JavaScript / TypeScript",
          tag: "technical",
          color: "#8b5cf6"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/skills/tree/nodes/nod_skill_typescript/reorder",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          parentNodeId: "nod_skill_frontend",
          targetIndex: 0
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/skills/tree/nodes/nod_skill_typescript",
      {
        method: "DELETE"
      }
    );
  });

  it("loads a skills snapshot and builds an ordered tree model", async () => {
    const snapshot = await loadSkillsSnapshot(
      {
        getInventory: async () => ({
          inventory: createSnapshot().inventory,
          summary: createSnapshot().summary,
          skillGraph: createSnapshot().skillGraph
        }),
        checkDuplicate: async () => ({
          queryLabel: "TypeScript",
          normalizedLabel: "typescript",
          exactMatch: true,
          suggestedStrategy: "create-reference-to-existing",
          guidance: "Use a reference node.",
          candidates: [],
          summary: {
            totalCanonicalSkills: 2,
            totalReferenceNodes: 1,
            totalCandidates: 0,
            exactMatchCount: 0
          }
        }),
        listPromotionCandidates: async () => []
      },
      {
        initialLabelCheck: "TypeScript"
      }
    );

    const model = buildSkillsPanelModel(snapshot);

    expect(model.inventorySummary.totalCanonicalSkills).toBe(2);
    expect(model.treeRoots[0]?.label).toBe("Frontend");
    expect(model.treeRoots[0]?.children[0]?.label).toBe("TypeScript");
    expect(model.treeRoots[0]?.children[0]?.tag).toBe("technical");
    expect(model.hiddenFeatureNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("reference"),
        expect.stringContaining("duplicate"),
        expect.stringContaining("promotion")
      ])
    );
  });

  it("flattens visible rows for expanded branches and query filtering", () => {
    const model = buildSkillsPanelModel(createSnapshot());

    const visibleRows = flattenVisibleSkillTree(
      model.treeRoots,
      new Set(["nod_skill_frontend", "nod_skill_typescript"]),
      "type"
    );

    expect(visibleRows.map((row) => row.id)).toEqual([
      "nod_skill_frontend",
      "nod_skill_typescript"
    ]);
    expect(visibleRows[1]?.depth).toBe(1);
  });

  it("keeps root skills collapsed when nothing is expanded", () => {
    const model = buildSkillsPanelModel(createSnapshot());
    const visibleRows = flattenVisibleSkillTree(model.treeRoots, new Set());

    expect(visibleRows.map((row) => row.id)).toEqual(["nod_skill_frontend"]);
  });

  it("interprets keyboard controls and selection movement for the skill tree", () => {
    const model = buildSkillsPanelModel(createSnapshot());
    const rows = flattenVisibleSkillTree(
      model.treeRoots,
      new Set(["nod_skill_frontend", "nod_skill_typescript"])
    );

    expect(
      interpretSkillTreeHotkey({
        key: "ArrowDown",
        targetTagName: "div"
      })
    ).toBe("select-next");
    expect(
      interpretSkillTreeHotkey({
        key: "Enter",
        targetTagName: "div"
      })
    ).toBe("edit");
    expect(moveSkillTreeSelection(rows, "nod_skill_frontend", 1)).toBe(
      "nod_skill_typescript"
    );
    expect(moveSkillTreeSelection(rows, "nod_skill_typescript", -1)).toBe("nod_skill_frontend");
  });

  it("renders the interactive tree, search, and editor affordances", () => {
    const markup = renderToStaticMarkup(
      createElement(SkillsSpotlight, {
        snapshot: createSnapshot(),
        feedback: "Skill tree ready."
      })
    );

    expect(markup).toContain("Search skills...");
    expect(markup).toContain("Add Root Skill");
    expect(markup).toContain("Multi-select");
    expect(markup).toContain("Frontend");
    expect(markup).toContain("Skill tree ready.");
    expect(markup).toContain("Temporarily hidden skill-tree actions");
    expect(markup).toContain("Arrows navigate, Right expands, Left collapses");
  });

  it("caps nested skill rendering at the preliminary depth limit", () => {
    const nodeCount = SKILL_TREE_DEPTH_LIMIT + 6;
    const nodes = Array.from({ length: nodeCount }, (_, index) => ({
      ...createSnapshot().skillGraph!.nodes[0]!,
      id: `nod_skill_${index}`,
      label: `Skill ${index}`,
      normalizedLabel: `skill-${index}`,
      parentNodeId: index === 0 ? undefined : (`nod_skill_${index - 1}` as never),
      metadata: {
        skillId: `skl_${index}`,
        sortOrder: 0
      }
    }));
    const inventory = Array.from({ length: nodeCount }, (_, index) => ({
      skillId: `skl_${index}`,
      canonicalLabel: `Skill ${index}`,
      normalizedLabel: `skill-${index}`,
      sourceCanvasName: "Skill Graph",
      sourceNodeLabel: `Skill ${index}`,
      referenceCount: 0
    }));
    const edges = Array.from({ length: nodeCount - 1 }, (_, index) => ({
      id: `edg_skill_${index}`,
      canvasId: "can_skill_graph",
      sourceNodeId: `nod_skill_${index}`,
      targetNodeId: `nod_skill_${index + 1}`,
      kind: "contains" as const,
      workspaceId: "wrk_demo_owner",
      createdBy: "act_demo_owner",
      createdAt: "2026-04-22T08:00:00.000Z",
      updatedAt: "2026-04-22T08:00:00.000Z"
    }));

    const model = buildSkillsPanelModel({
      ...createSnapshot(),
      inventory,
      summary: {
        totalCanonicalSkills: nodeCount,
        totalReferenceNodes: 0,
        totalSkillGraphNodes: nodeCount
      },
      skillGraph: {
        ...createSnapshot().skillGraph!,
        nodes,
        edges
      }
    });

    let visibleDepth = 0;
    let cursor = model.treeRoots[0];

    while (cursor) {
      visibleDepth += 1;
      cursor = cursor.children.find((child) => child.kind === "skill");
    }

    expect(visibleDepth).toBe(SKILL_TREE_DEPTH_LIMIT);
  });

  it("returns an empty model without crashing before data loads", () => {
    const model = buildSkillsPanelModel(EMPTY_SKILLS_SNAPSHOT);

    expect(model.treeRoots).toHaveLength(0);
    expect(model.inventorySummary.totalCanonicalSkills).toBe(0);
    expect(model.hiddenFeatureNotes.length).toBeGreaterThan(0);
  });

  it("falls back to canonical inventory rows when the graph has no root skills", () => {
    const snapshot = createSnapshot();
    const rootlessNodes = snapshot.skillGraph!.nodes.map((node) =>
      node.role === "skill"
        ? {
            ...node,
            parentNodeId: "nod_parent_missing" as never
          }
        : node
    );

    const model = buildSkillsPanelModel({
      ...snapshot,
      skillGraph: {
        ...snapshot.skillGraph!,
        nodes: rootlessNodes
      }
    });

    expect(model.treeRoots.map((node) => node.label)).toContain("Frontend");
    expect(model.treeRoots.every((node) => node.kind === "skill")).toBe(true);
  });
});
