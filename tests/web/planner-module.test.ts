import { describe, expect, it, vi } from "vitest";
import type {
  EvidenceNote,
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";
import {
  createPlannerGatewayPort,
  loadPlannerSnapshot
} from "../../apps/web/src/modules/planner/planner-gateway";
import {
  buildPlannerPanelModel,
  type PlannerSnapshot
} from "../../apps/web/src/modules/planner/planner-model";

const auditFields = {
  workspaceId: "wrk_demo_owner",
  createdBy: "act_demo_owner",
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z"
} as const;

function createGoal(
  id: string,
  title: string,
  status: Goal["status"] = "active"
): Goal {
  return {
    id: id as Goal["id"],
    title,
    status,
    ...auditFields
  };
}

function createPlanItem(
  id: string,
  goalId: string,
  title: string,
  kind: PlanItem["kind"],
  sortOrder: number
): PlanItem {
  return {
    id: id as PlanItem["id"],
    goalId: goalId as PlanItem["goalId"],
    title,
    kind,
    status: "not-started",
    sortOrder,
    skillGraphVisibility: "pending",
    ...auditFields
  };
}

function createEvidenceNote(
  id: string,
  goalId: string,
  body: string,
  planItemId?: string
): EvidenceNote {
  return {
    id: id as EvidenceNote["id"],
    goalId: goalId as EvidenceNote["goalId"],
    ...(planItemId ? { planItemId: planItemId as EvidenceNote["planItemId"] } : {}),
    body,
    attachments: [],
    ...auditFields
  };
}

function createSnapshot(): PlannerSnapshot {
  const certificationGoal = createGoal("gol_aws_cert", "Earn AWS Developer Associate");
  const designGoal = createGoal("gol_design", "Build event-driven architecture portfolio");

  return {
    goals: [designGoal, certificationGoal],
    plansByGoalId: {
      [certificationGoal.id]: {
        goal: certificationGoal,
        planItems: [
          createPlanItem(
            "pli_typescript",
            certificationGoal.id,
            "Refresh TypeScript fundamentals",
            "skill",
            0
          ),
          createPlanItem(
            "pli_mock_exam",
            certificationGoal.id,
            "Pass a mock exam",
            "milestone",
            1
          )
        ],
        evidenceNotes: [
          createEvidenceNote(
            "env_lab_notes",
            certificationGoal.id,
            "Completed the first study lab.",
            "pli_typescript"
          )
        ]
      }
    },
    selectedGoalId: certificationGoal.id
  };
}

describe("planner module", () => {
  it("uses gateway planner proxy routes for reads and writes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ goals: [createGoal("gol_a", "Inbox goal")] }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            goal: createGoal("gol_a", "Inbox goal"),
            planItems: [],
            evidenceNotes: []
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
        new Response(JSON.stringify({ goal: createGoal("gol_b", "Career goal", "draft") }), {
          status: 201,
          headers: {
            "content-type": "application/json"
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            planItem: createPlanItem("pli_a", "gol_a", "Do labs", "task", 0)
          }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            evidenceNote: createEvidenceNote(
              "env_a",
              "gol_a",
              "Finished the first lab.",
              "pli_a"
            )
          }),
          {
            status: 201,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const port = createPlannerGatewayPort("http://localhost:4000", fetcher);

    await port.listGoals();
    await port.getGoalPlan("gol_a" as Goal["id"]);
    await port.createGoal({ title: "Career goal" });
    await port.createPlanItem({
      goalId: "gol_a" as Goal["id"],
      title: "Do labs",
      kind: "task"
    });
    await port.addEvidenceNote({
      goalId: "gol_a" as Goal["id"],
      body: "Finished the first lab.",
      planItemId: "pli_a" as EvidenceNote["planItemId"]
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/goals",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/goals/gol_a/plan",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/goals",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: "Career goal"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      "http://localhost:4000/api/v1/goals/gol_a/items",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: "Do labs",
          kind: "task"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      "http://localhost:4000/api/v1/goals/gol_a/evidence-notes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          body: "Finished the first lab.",
          planItemId: "pli_a"
        })
      }
    );
  });

  it("loads and shapes a planner snapshot around the selected goal", async () => {
    const certificationGoal = createGoal("gol_aws_cert", "Earn AWS Developer Associate");
    const designGoal = createGoal("gol_design", "Build event-driven architecture portfolio");

    const snapshot = await loadPlannerSnapshot({
      listGoals: async () => ({
        goals: [designGoal, certificationGoal]
      }),
      getGoalPlan: async () => ({
        goal: certificationGoal,
        planItems: [
          createPlanItem(
            "pli_typescript",
            certificationGoal.id,
            "Refresh TypeScript fundamentals",
            "skill",
            0
          ),
          createPlanItem(
            "pli_mock_exam",
            certificationGoal.id,
            "Pass a mock exam",
            "milestone",
            1
          )
        ],
        evidenceNotes: [
          createEvidenceNote(
            "env_lab_notes",
            certificationGoal.id,
            "Completed the first study lab.",
            "pli_typescript"
          )
        ]
      })
    });

    const model = buildPlannerPanelModel(snapshot);

    expect(snapshot.selectedGoalId).toBe(designGoal.id);
    expect(model.goalSummaries.map((goal) => goal.title)).toEqual([
      "Build event-driven architecture portfolio",
      "Earn AWS Developer Associate"
    ]);
    expect(model.selectedGoal?.title).toBe("Build event-driven architecture portfolio");
  });

  it("builds demo-friendly summaries from injected planner data", () => {
    const model = buildPlannerPanelModel(createSnapshot());

    expect(model.goalSummaries).toEqual([
      expect.objectContaining({
        id: "gol_design",
        title: "Build event-driven architecture portfolio",
        isSelected: false,
        planLoaded: false,
        planItemCount: 0,
        evidenceNoteCount: 0
      }),
      expect.objectContaining({
        id: "gol_aws_cert",
        title: "Earn AWS Developer Associate",
        isSelected: true,
        planLoaded: true,
        planItemCount: 2,
        evidenceNoteCount: 1
      })
    ]);
    expect(model.selectedGoal?.planItems.map((planItem) => planItem.title)).toEqual([
      "Refresh TypeScript fundamentals",
      "Pass a mock exam"
    ]);
    expect(model.selectedGoal?.evidenceNotes[0]).toMatchObject({
      body: "Completed the first study lab.",
      planItemTitle: "Refresh TypeScript fundamentals"
    });
  });
});
