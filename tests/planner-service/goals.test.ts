import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  EvidenceNote,
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";
import { createService } from "@pdp-helper/runtime-node";
import { plannerHealthRoute } from "../../services/planner-service/src/routes/health";
import { plannerGoalRoutes } from "../../services/planner-service/src/routes/goals";
import { resetPlannerStore } from "../../services/planner-service/src/storage/in-memory";

async function waitForListening(server: ReturnType<typeof createService>) {
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });
}

async function readJson<TPayload>(response: Response) {
  return (await response.json()) as TPayload;
}

describe("planner-service goal routes", () => {
  const servers: Array<ReturnType<typeof createService>> = [];

  beforeEach(() => {
    resetPlannerStore();
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
      name: "planner-service-test",
      port: 0,
      routes: [plannerHealthRoute, ...plannerGoalRoutes]
    });
    servers.push(server);
    await waitForListening(server);

    const port = (server.address() as AddressInfo).port;

    return {
      baseUrl: `http://127.0.0.1:${port}`
    };
  }

  it("creates goals, plan items, and evidence notes through HTTP", async () => {
    const { baseUrl } = await startServer();

    const createGoalResponse = await fetch(`${baseUrl}/v1/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "Prepare for Kubernetes Associate",
        description: "Build a small study plan around the certification."
      })
    });

    const createGoalPayload = await readJson<{ goal: Goal }>(createGoalResponse);

    expect(createGoalResponse.status).toBe(201);
    expect(createGoalPayload.goal.id).toMatch(/^gol_/);
    expect(createGoalPayload.goal.title).toBe("Prepare for Kubernetes Associate");
    expect(createGoalPayload.goal.status).toBe("draft");

    const createItemResponse = await fetch(
      `${baseUrl}/v1/goals/${createGoalPayload.goal.id}/items`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: "Study cluster architecture",
          description: "Review control plane and node responsibilities.",
          kind: "task",
          sortOrder: 0
        })
      }
    );

    const createItemPayload = await readJson<{ planItem: PlanItem }>(
      createItemResponse
    );

    expect(createItemResponse.status).toBe(201);
    expect(createItemPayload.planItem.id).toMatch(/^pli_/);
    expect(createItemPayload.planItem.goalId).toBe(createGoalPayload.goal.id);
    expect(createItemPayload.planItem.kind).toBe("task");
    expect(createItemPayload.planItem.skillGraphVisibility).toBe("pending");

    const createEvidenceResponse = await fetch(
      `${baseUrl}/v1/goals/${createGoalPayload.goal.id}/evidence-notes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          planItemId: createItemPayload.planItem.id,
          body: "Completed the first study session.",
          attachments: ["notes.md"]
        })
      }
    );

    const createEvidencePayload = await readJson<{ evidenceNote: EvidenceNote }>(
      createEvidenceResponse
    );

    expect(createEvidenceResponse.status).toBe(201);
    expect(createEvidencePayload.evidenceNote.id).toMatch(/^env_/);
    expect(createEvidencePayload.evidenceNote.goalId).toBe(
      createGoalPayload.goal.id
    );
    expect(createEvidencePayload.evidenceNote.planItemId).toBe(
      createItemPayload.planItem.id
    );

    const listResponse = await fetch(`${baseUrl}/v1/goals`);
    const listPayload = await readJson<{ goals: Goal[] }>(listResponse);

    expect(listResponse.status).toBe(200);
    expect(
      listPayload.goals.some((goal) => goal.id === createGoalPayload.goal.id)
    ).toBe(true);

    const goalResponse = await fetch(
      `${baseUrl}/v1/goals/${createGoalPayload.goal.id}`
    );
    const goalPayload = await readJson<{ goal: Goal }>(goalResponse);

    expect(goalResponse.status).toBe(200);
    expect(goalPayload.goal.id).toBe(createGoalPayload.goal.id);

    const planResponse = await fetch(
      `${baseUrl}/v1/goals/${createGoalPayload.goal.id}/plan`
    );
    const planPayload = await readJson<{
      goal: Goal;
      planItems: PlanItem[];
      evidenceNotes: EvidenceNote[];
    }>(planResponse);

    expect(planResponse.status).toBe(200);
    expect(planPayload.goal.id).toBe(createGoalPayload.goal.id);
    expect(
      planPayload.planItems.some(
        (planItem) => planItem.id === createItemPayload.planItem.id
      )
    ).toBe(true);
    expect(
      planPayload.evidenceNotes.some(
        (evidenceNote) => evidenceNote.id === createEvidencePayload.evidenceNote.id
      )
    ).toBe(true);
  });

  it("rejects invalid goal, item, and evidence payloads", async () => {
    const { baseUrl } = await startServer();

    const goalResponse = await fetch(`${baseUrl}/v1/goals`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "",
        description: "",
        targetDate: "2026-99-99"
      })
    });
    const goalPayload = await readJson<{
      error: {
        code: string;
        details?: { issues: Array<{ path: string; rule: string; message: string }> };
      };
    }>(goalResponse);

    expect(goalResponse.status).toBe(422);
    expect(goalPayload.error.code).toBe("VALIDATION_FAILED");
    expect(goalPayload.error.details?.issues.some((issue) => issue.path === "title")).toBe(
      true
    );

    const itemResponse = await fetch(`${baseUrl}/v1/goals/gol_missing/items`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        title: "",
        kind: "unknown",
        sortOrder: "zero"
      })
    });
    const itemPayload = await readJson<{
      error: {
        code: string;
        details?: { issues: Array<{ path: string; rule: string; message: string }> };
      };
    }>(itemResponse);

    expect(itemResponse.status).toBe(422);
    expect(itemPayload.error.code).toBe("VALIDATION_FAILED");
    expect(itemPayload.error.details?.issues.some((issue) => issue.path === "kind")).toBe(
      true
    );

    const evidenceResponse = await fetch(
      `${baseUrl}/v1/goals/gol_missing/evidence-notes`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          body: "",
          attachments: [""]
        })
      }
    );
    const evidencePayload = await readJson<{
      error: {
        code: string;
        details?: { issues: Array<{ path: string; rule: string; message: string }> };
      };
    }>(evidenceResponse);

    expect(evidenceResponse.status).toBe(422);
    expect(evidencePayload.error.code).toBe("VALIDATION_FAILED");
    expect(
      evidencePayload.error.details?.issues.some((issue) => issue.path === "body")
    ).toBe(true);
  });
});
