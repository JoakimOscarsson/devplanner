import { GatewayClient } from "@pdp-helper/runtime-web";
import type {
  EvidenceNote,
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";
import {
  compareGoals,
  type PlannerGoalPlan,
  type PlannerSnapshot
} from "./planner-model";

export interface PlannerGoalsResponse {
  readonly goals: readonly Goal[];
}

export interface CreateGoalInput {
  readonly title: string;
  readonly description?: string;
  readonly targetDate?: Goal["targetDate"];
}

export interface CreateGoalResponse {
  readonly goal?: Goal;
}

export interface CreatePlanItemInput {
  readonly goalId: Goal["id"];
  readonly title: string;
  readonly description?: string;
  readonly kind: PlanItem["kind"];
  readonly sortOrder?: number;
  readonly parentPlanItemId?: PlanItem["parentPlanItemId"];
  readonly linkedSkillId?: PlanItem["linkedSkillId"];
  readonly linkedGraphNodeId?: PlanItem["linkedGraphNodeId"];
  readonly dueDate?: PlanItem["dueDate"];
}

export interface CreatePlanItemResponse {
  readonly planItem?: PlanItem;
}

export interface AddEvidenceNoteInput {
  readonly goalId: Goal["id"];
  readonly body: string;
  readonly planItemId?: EvidenceNote["planItemId"];
  readonly attachments?: readonly string[];
}

export interface AddEvidenceNoteResponse {
  readonly evidenceNote?: EvidenceNote;
}

export interface PlannerGatewayPort {
  listGoals(): Promise<PlannerGoalsResponse>;
  getGoalPlan(goalId: Goal["id"]): Promise<PlannerGoalPlan>;
  createGoal(input: CreateGoalInput): Promise<CreateGoalResponse>;
  createPlanItem(input: CreatePlanItemInput): Promise<CreatePlanItemResponse>;
  addEvidenceNote(input: AddEvidenceNoteInput): Promise<AddEvidenceNoteResponse>;
}

function createFetchRequest(baseUrl: string, fetcher: typeof fetch) {
  return async function request<TPayload>(path: string, init?: RequestInit) {
    const response = await fetcher(`${baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(`Gateway request failed for ${path} with ${response.status}.`);
    }

    return (await response.json()) as TPayload;
  };
}

export function createPlannerGatewayPort(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): PlannerGatewayPort {
  const client = fetcher === fetch ? new GatewayClient(baseUrl) : null;
  const request =
    client
      ? client.request.bind(client)
      : createFetchRequest(baseUrl, fetcher);

  return {
    listGoals() {
      return request<PlannerGoalsResponse>("/api/v1/goals");
    },

    getGoalPlan(goalId) {
      return request<PlannerGoalPlan>(`/api/v1/goals/${goalId}/plan`);
    },

    createGoal(input) {
      return request<CreateGoalResponse>("/api/v1/goals", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          ...(input.targetDate ? { targetDate: input.targetDate } : {})
        })
      });
    },

    createPlanItem(input) {
      return request<CreatePlanItemResponse>(`/api/v1/goals/${input.goalId}/items`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: input.title,
          kind: input.kind,
          ...(typeof input.sortOrder === "number" ? { sortOrder: input.sortOrder } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.parentPlanItemId ? { parentPlanItemId: input.parentPlanItemId } : {}),
          ...(input.linkedSkillId ? { linkedSkillId: input.linkedSkillId } : {}),
          ...(input.linkedGraphNodeId ? { linkedGraphNodeId: input.linkedGraphNodeId } : {}),
          ...(input.dueDate ? { dueDate: input.dueDate } : {})
        })
      });
    },

    addEvidenceNote(input) {
      return request<AddEvidenceNoteResponse>(
        `/api/v1/goals/${input.goalId}/evidence-notes`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            body: input.body,
            ...(input.planItemId ? { planItemId: input.planItemId } : {}),
            ...(input.attachments && input.attachments.length > 0
              ? { attachments: [...input.attachments] }
              : {})
          })
        }
      );
    }
  };
}

export async function loadPlannerSnapshot(
  gateway: Pick<PlannerGatewayPort, "listGoals" | "getGoalPlan">,
  options: {
    readonly selectedGoalId?: Goal["id"];
  } = {}
): Promise<PlannerSnapshot> {
  const response = await gateway.listGoals();
  const goals = [...response.goals].sort(compareGoals);
  const preferredSelectedGoalId = options.selectedGoalId;
  const selectedGoalId = goals.some((goal) => goal.id === preferredSelectedGoalId)
    ? preferredSelectedGoalId
    : goals[0]?.id;

  if (!selectedGoalId) {
    return {
      goals,
      plansByGoalId: {}
    };
  }

  const selectedPlan = await gateway.getGoalPlan(selectedGoalId);

  return {
    goals,
    plansByGoalId: {
      [selectedGoalId]: selectedPlan
    },
    selectedGoalId
  };
}
