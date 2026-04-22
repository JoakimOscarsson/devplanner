import { ID_PREFIXES, type ActorId, type IsoDateTime, type WorkspaceId } from "@pdp-helper/contracts-core";
import type { GoalId, PlanItemId } from "@pdp-helper/contracts-core";
import type {
  EvidenceNote,
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";

const workspaceId = "wrk_demo_owner" as WorkspaceId;
const actorId = "act_demo_owner" as ActorId;

interface PlannerSeed {
  goals: Goal[];
  planItems: PlanItem[];
  evidenceNotes: EvidenceNote[];
}

function now(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

function auditFields(timestamp = now()) {
  return {
    workspaceId,
    createdBy: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function plannerSeed(): PlannerSeed {
  return {
    goals: [
      {
        id: "gol_aws_cert" as Goal["id"],
        title: "Earn AWS Developer Associate",
        description: "Use the planner to structure the certification path.",
        status: "active",
        sourceGraphNodeId: "nod_brainstorm_aws" as Goal["sourceGraphNodeId"],
        targetDate: "2026-08-31" as Goal["targetDate"],
        ...auditFields()
      }
    ] satisfies Goal[],
    planItems: [
      {
        id: "pli_foundations" as PlanItem["id"],
        goalId: "gol_aws_cert" as PlanItem["goalId"],
        title: "Refresh TypeScript fundamentals",
        kind: "skill",
        status: "in-progress",
        sortOrder: 0,
        linkedSkillId: "skl_typescript" as PlanItem["linkedSkillId"],
        skillGraphVisibility: "accepted",
        ...auditFields()
      },
      {
        id: "pli_course" as PlanItem["id"],
        goalId: "gol_aws_cert" as PlanItem["goalId"],
        title: "Watch the cloud architecture prep course",
        kind: "task",
        status: "not-started",
        sortOrder: 1,
        skillGraphVisibility: "pending",
        ...auditFields()
      },
      {
        id: "pli_mock_exam" as PlanItem["id"],
        goalId: "gol_aws_cert" as PlanItem["goalId"],
        title: "Pass a mock exam",
        kind: "milestone",
        status: "not-started",
        sortOrder: 2,
        skillGraphVisibility: "pending",
        ...auditFields()
      }
    ] satisfies PlanItem[],
    evidenceNotes: [
      {
        id: "env_lab_notes" as EvidenceNote["id"],
        goalId: "gol_aws_cert" as EvidenceNote["goalId"],
        planItemId: "pli_foundations" as EvidenceNote["planItemId"],
        body: "Built a small event-driven demo app and documented the architecture choices.",
        attachments: [],
        ...auditFields()
      }
    ] satisfies EvidenceNote[]
  };
}

function assertGoal(goalId: GoalId) {
  const goal = plannerStore.goals.find((entry) => entry.id === goalId);

  if (!goal) {
    throw {
      code: "NOT_FOUND",
      message: `Goal ${goalId} was not found.`,
      status: 404,
      retryable: false
    };
  }

  return goal;
}

function assertPlanItem(goalId: GoalId, planItemId: PlanItemId) {
  const planItem = plannerStore.planItems.find(
    (entry) => entry.goalId === goalId && entry.id === planItemId
  );

  if (!planItem) {
    throw {
      code: "NOT_FOUND",
      message: `Plan item ${planItemId} was not found.`,
      status: 404,
      retryable: false
    };
  }

  return planItem;
}

function nextSortOrder(goalId: GoalId) {
  return plannerStore.planItems.filter((entry) => entry.goalId === goalId).length;
}

export const plannerStore = {
  workspaceId,
  goals: [] as Goal[],
  planItems: [] as PlanItem[],
  evidenceNotes: [] as EvidenceNote[]
};

export function resetPlannerStore() {
  const seed = plannerSeed();

  plannerStore.goals = seed.goals;
  plannerStore.planItems = seed.planItems;
  plannerStore.evidenceNotes = seed.evidenceNotes;
}

export function listGoals() {
  return plannerStore.goals;
}

export function getGoal(goalId: GoalId) {
  return assertGoal(goalId);
}

export function listGoalPlan(goalId: GoalId) {
  const goal = assertGoal(goalId);

  return {
    goal,
    planItems: plannerStore.planItems.filter((entry) => entry.goalId === goalId),
    evidenceNotes: plannerStore.evidenceNotes.filter((entry) => entry.goalId === goalId)
  };
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  targetDate?: Goal["targetDate"];
  sourceGraphNodeId?: Goal["sourceGraphNodeId"];
}

export function createGoal(input: CreateGoalInput) {
  const timestamp = now();
  const goal: Goal = {
    id: buildId(ID_PREFIXES.goal) as Goal["id"],
    title: input.title,
    status: "draft",
    ...(input.description ? { description: input.description } : {}),
    ...(input.targetDate ? { targetDate: input.targetDate } : {}),
    ...(input.sourceGraphNodeId ? { sourceGraphNodeId: input.sourceGraphNodeId } : {}),
    ...auditFields(timestamp)
  };

  plannerStore.goals = [...plannerStore.goals, goal];

  return goal;
}

export interface CreatePlanItemInput {
  title: string;
  kind: PlanItem["kind"];
  description?: string;
  sortOrder?: number;
  parentPlanItemId?: PlanItemId;
  linkedSkillId?: PlanItem["linkedSkillId"];
  linkedGraphNodeId?: PlanItem["linkedGraphNodeId"];
  dueDate?: PlanItem["dueDate"];
}

export function createPlanItem(goalId: GoalId, input: CreatePlanItemInput) {
  assertGoal(goalId);

  if (input.parentPlanItemId) {
    assertPlanItem(goalId, input.parentPlanItemId);
  }

  const timestamp = now();
  const planItem: PlanItem = {
    id: buildId(ID_PREFIXES.planItem) as PlanItem["id"],
    goalId,
    title: input.title,
    kind: input.kind,
    status: "not-started",
    sortOrder: input.sortOrder ?? nextSortOrder(goalId),
    skillGraphVisibility: input.linkedSkillId ? "accepted" : "pending",
    ...(input.description ? { description: input.description } : {}),
    ...(input.parentPlanItemId ? { parentPlanItemId: input.parentPlanItemId } : {}),
    ...(input.linkedSkillId ? { linkedSkillId: input.linkedSkillId } : {}),
    ...(input.linkedGraphNodeId ? { linkedGraphNodeId: input.linkedGraphNodeId } : {}),
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    ...auditFields(timestamp)
  };

  plannerStore.planItems = [...plannerStore.planItems, planItem];

  return planItem;
}

export interface AddEvidenceNoteInput {
  body: string;
  planItemId?: PlanItemId;
  attachments?: string[];
}

export function addEvidenceNote(goalId: GoalId, input: AddEvidenceNoteInput) {
  assertGoal(goalId);

  if (input.planItemId) {
    assertPlanItem(goalId, input.planItemId);
  }

  const timestamp = now();
  const evidenceNote: EvidenceNote = {
    id: buildId(ID_PREFIXES.evidenceNote) as EvidenceNote["id"],
    goalId,
    body: input.body,
    ...(input.planItemId ? { planItemId: input.planItemId } : {}),
    ...(input.attachments ? { attachments: [...input.attachments] } : {}),
    ...auditFields(timestamp)
  };

  plannerStore.evidenceNotes = [...plannerStore.evidenceNotes, evidenceNote];

  return evidenceNote;
}

resetPlannerStore();
