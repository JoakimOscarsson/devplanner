import type {
  EvidenceNote,
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";

export interface PlannerGoalPlan {
  readonly goal: Goal;
  readonly planItems: readonly PlanItem[];
  readonly evidenceNotes: readonly EvidenceNote[];
}

export interface PlannerSnapshot {
  readonly goals: readonly Goal[];
  readonly plansByGoalId: Readonly<Record<string, PlannerGoalPlan>>;
  readonly selectedGoalId?: Goal["id"];
}

export interface PlannerGoalSummary {
  readonly id: Goal["id"];
  readonly title: string;
  readonly status: Goal["status"];
  readonly targetDate?: Goal["targetDate"];
  readonly isSelected: boolean;
  readonly planLoaded: boolean;
  readonly planItemCount: number;
  readonly evidenceNoteCount: number;
}

export interface PlannerPlanItemSummary {
  readonly id: PlanItem["id"];
  readonly title: string;
  readonly kind: PlanItem["kind"];
  readonly status: PlanItem["status"];
  readonly sortOrder: number;
  readonly skillGraphVisibility: PlanItem["skillGraphVisibility"];
  readonly dueDate?: PlanItem["dueDate"];
}

export interface PlannerEvidenceSummary {
  readonly id: EvidenceNote["id"];
  readonly body: string;
  readonly planItemTitle?: string;
  readonly attachmentCount: number;
}

export interface PlannerSelectedGoalModel {
  readonly id: Goal["id"];
  readonly title: string;
  readonly status: Goal["status"];
  readonly description?: string;
  readonly targetDate?: Goal["targetDate"];
  readonly planLoaded: boolean;
  readonly planItems: readonly PlannerPlanItemSummary[];
  readonly evidenceNotes: readonly PlannerEvidenceSummary[];
}

export interface PlannerPanelModel {
  readonly goalSummaries: readonly PlannerGoalSummary[];
  readonly selectedGoal: PlannerSelectedGoalModel | null;
}

export interface PlannerPanelModelOptions {
  readonly selectedGoalId?: Goal["id"];
}

export const EMPTY_PLANNER_SNAPSHOT: PlannerSnapshot = {
  goals: [],
  plansByGoalId: {}
};

const GOAL_STATUS_SORT_WEIGHT: Readonly<Record<Goal["status"], number>> = {
  active: 0,
  draft: 1,
  paused: 2,
  completed: 3,
  archived: 4
};

export function compareGoals(left: Goal, right: Goal) {
  const leftWeight = GOAL_STATUS_SORT_WEIGHT[left.status] ?? Number.MAX_SAFE_INTEGER;
  const rightWeight = GOAL_STATUS_SORT_WEIGHT[right.status] ?? Number.MAX_SAFE_INTEGER;

  if (leftWeight !== rightWeight) {
    return leftWeight - rightWeight;
  }

  return left.title.localeCompare(right.title);
}

export function buildPlannerPanelModel(
  snapshot: PlannerSnapshot,
  options: PlannerPanelModelOptions = {}
): PlannerPanelModel {
  const goals = [...snapshot.goals].sort(compareGoals);
  const preferredSelectedGoalId = options.selectedGoalId ?? snapshot.selectedGoalId;
  const selectedGoalId = goals.some((goal) => goal.id === preferredSelectedGoalId)
    ? preferredSelectedGoalId
    : goals[0]?.id;

  const goalSummaries = goals.map((goal) => {
    const plan = snapshot.plansByGoalId[goal.id];

    return {
      id: goal.id,
      title: goal.title,
      status: goal.status,
      targetDate: goal.targetDate,
      isSelected: goal.id === selectedGoalId,
      planLoaded: Boolean(plan),
      planItemCount: plan?.planItems.length ?? 0,
      evidenceNoteCount: plan?.evidenceNotes.length ?? 0
    } satisfies PlannerGoalSummary;
  });

  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);

  if (!selectedGoal) {
    return {
      goalSummaries,
      selectedGoal: null
    };
  }

  const selectedPlan = snapshot.plansByGoalId[selectedGoal.id];

  if (!selectedPlan) {
    return {
      goalSummaries,
      selectedGoal: {
        id: selectedGoal.id,
        title: selectedGoal.title,
        status: selectedGoal.status,
        description: selectedGoal.description,
        targetDate: selectedGoal.targetDate,
        planLoaded: false,
        planItems: [],
        evidenceNotes: []
      }
    };
  }

  const planItems = [...selectedPlan.planItems]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((planItem) => ({
      id: planItem.id,
      title: planItem.title,
      kind: planItem.kind,
      status: planItem.status,
      sortOrder: planItem.sortOrder,
      skillGraphVisibility: planItem.skillGraphVisibility,
      dueDate: planItem.dueDate
    })) satisfies PlannerPlanItemSummary[];

  const planItemsById = new Map(
    selectedPlan.planItems.map((planItem) => [planItem.id, planItem] as const)
  );
  const evidenceNotes = [...selectedPlan.evidenceNotes]
    .map((evidenceNote) => ({
      id: evidenceNote.id,
      body: evidenceNote.body,
      planItemTitle: evidenceNote.planItemId
        ? planItemsById.get(evidenceNote.planItemId)?.title
        : undefined,
      attachmentCount: evidenceNote.attachments?.length ?? 0
    }))
    .sort((left, right) => left.body.localeCompare(right.body)) satisfies
    PlannerEvidenceSummary[];

  return {
    goalSummaries,
    selectedGoal: {
      id: selectedGoal.id,
      title: selectedGoal.title,
      status: selectedGoal.status,
      description: selectedGoal.description,
      targetDate: selectedGoal.targetDate,
      planLoaded: true,
      planItems,
      evidenceNotes
    }
  };
}
