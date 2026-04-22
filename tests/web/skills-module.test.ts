import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { ModuleCapability } from "@pdp-helper/contracts-core";
import {
  createSkillsGatewayPort,
  loadSkillsSnapshot
} from "../../apps/web/src/modules/skills/skills-gateway";
import {
  buildSkillsPanelModel,
  EMPTY_SKILLS_SNAPSHOT,
  type SkillsSnapshot
} from "../../apps/web/src/modules/skills/skills-model";
import { SkillsSpotlight } from "../../apps/web/src/modules/skills/SkillsSpotlight";

function createSnapshot(): SkillsSnapshot {
  return {
    inventory: [
      {
        skillId: "skl_typescript",
        canonicalLabel: "TypeScript",
        normalizedLabel: "typescript",
        sourceCanvasName: "Inbox",
        sourceNodeLabel: "TypeScript",
        referenceCount: 1
      },
      {
        skillId: "skl_event_architecture",
        canonicalLabel: "Event-Driven Architecture",
        normalizedLabel: "event-driven-architecture",
        sourceCanvasName: "Skill Graph",
        sourceNodeLabel: "Event-Driven Architecture",
        referenceCount: 1
      }
    ],
    summary: {
      totalCanonicalSkills: 2,
      totalReferenceNodes: 2,
      totalSkillGraphNodes: 4
    },
    duplicateCheck: {
      queryLabel: "TypeScript",
      normalizedLabel: "typescript",
      exactMatch: true,
      suggestedStrategy: "create-reference-to-existing",
      guidance:
        "A canonical skill already exists. Keep the existing canonical skill and create a reference node when you need another appearance in the graph.",
      candidates: [
        {
          skillId: "skl_typescript",
          canonicalLabel: "TypeScript",
          normalizedLabel: "typescript",
          sourceNodeId: "nod_brainstorm_typescript",
          sourceNodeLabel: "TypeScript",
          sourceCanvasName: "Inbox",
          similarityScore: 1,
          referenceCount: 1,
          matchKind: "exact"
        }
      ],
      summary: {
        totalCanonicalSkills: 2,
        totalReferenceNodes: 2,
        totalCandidates: 1,
        exactMatchCount: 1
      }
    }
  };
}

describe("skills module", () => {
  it("uses gateway skill routes for inventory and duplicate checks", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            inventory: [],
            summary: {
              totalCanonicalSkills: 0,
              totalReferenceNodes: 0,
              totalSkillGraphNodes: 0
            }
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
            normalizedLabel: "typescript",
            exactMatch: true,
            suggestedStrategy: "create-reference-to-existing",
            guidance: "Use a reference node.",
            candidates: [],
            summary: {
              totalCanonicalSkills: 2,
              totalReferenceNodes: 2,
              totalCandidates: 0,
              exactMatchCount: 0
            }
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const port = createSkillsGatewayPort("http://localhost:4000", fetcher);

    await port.getInventory();
    await port.checkDuplicate({
      label: "TypeScript"
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/skills",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/skills/check-duplicate",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: "TypeScript"
        })
      }
    );
  });

  it("loads a skills snapshot and builds a demo-oriented panel model", async () => {
    const snapshot = await loadSkillsSnapshot({
      getInventory: async () => ({
        inventory: createSnapshot().inventory,
        summary: createSnapshot().summary
      }),
      checkDuplicate: async () => createSnapshot().duplicateCheck!
    }, {
      initialLabelCheck: "TypeScript"
    });

    const model = buildSkillsPanelModel(snapshot);

    expect(model.inventorySummary.totalCanonicalSkills).toBe(2);
    expect(model.inventoryEntries[0]?.canonicalLabel).toBe("Event-Driven Architecture");
    expect(model.duplicateSummary?.strategyLabel).toContain("reference");
    expect(model.duplicateSummary?.candidateLabels).toEqual(["TypeScript"]);
  });

  it("renders inventory and duplicate guidance from a snapshot", () => {
    const module: ModuleCapability = {
      key: "skill-graph",
      title: "Skill Graph",
      description: "Canonical skills and reference nodes.",
      route: "/skills",
      service: "graph-service",
      version: "v1",
      optional: false,
      enabled: true,
      status: "up"
    };

    const markup = renderToStaticMarkup(
      createElement(SkillsSpotlight, {
        module,
        snapshot: createSnapshot(),
        feedback: "Duplicate check complete."
      })
    );

    expect(markup).toContain("Skill graph module");
    expect(markup).toContain("Canonical skill inventory");
    expect(markup).toContain("TypeScript");
    expect(markup).toContain("Duplicate guidance");
    expect(markup).toContain("create a reference node");
    expect(markup).toContain("Duplicate check complete.");
  });

  it("returns an empty model without crashing before data loads", () => {
    const model = buildSkillsPanelModel(EMPTY_SKILLS_SNAPSHOT);

    expect(model.inventoryEntries).toHaveLength(0);
    expect(model.inventorySummary.totalCanonicalSkills).toBe(0);
    expect(model.duplicateSummary).toBeNull();
  });
});
