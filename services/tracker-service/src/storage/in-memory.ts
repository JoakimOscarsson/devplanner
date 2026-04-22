import type { ActorId, IsoDateTime, WorkspaceId } from "@pdp-helper/contracts-core";
import type {
  GoalProgressProjection,
  ProjectionLagSnapshot,
  ProjectionStatus,
  WorkspaceProgressOverview
} from "@pdp-helper/contracts-tracker";

const workspaceId = "wrk_demo_owner" as WorkspaceId;
const actorId = "act_tracker" as ActorId;

export interface TrackerGoalSummary {
  readonly goalId: GoalProgressProjection["goalId"];
  readonly title: string;
  readonly status: GoalProgressProjection["status"];
  readonly completionPercent: number;
  readonly completedPlanItemCount: number;
  readonly totalPlanItemCount: number;
  readonly hiddenSkillCount: number;
  readonly lagStatus: ProjectionStatus;
  readonly lastSourceEventAt?: GoalProgressProjection["lastSourceEventAt"];
}

export interface TrackerGoalProjectionPayload {
  readonly projection: GoalProgressProjection;
  readonly goal: {
    readonly goalId: GoalProgressProjection["goalId"];
    readonly title: string;
    readonly completionPercent: number;
    readonly completedPlanItemCount: number;
    readonly totalPlanItemCount: number;
    readonly hiddenSkillCount: number;
  };
  readonly lag: ProjectionLagSnapshot | null;
  readonly workspaceOverview: {
    readonly completionPercent: number;
    readonly activeGoalCount: number;
  };
}

interface TrackerSeed {
  overview: WorkspaceProgressOverview;
  goalSummaries: TrackerGoalSummary[];
  goalProjections: Record<string, TrackerGoalProjectionPayload>;
  lagSnapshot: ProjectionLagSnapshot[];
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

function createGoalProjection(
  goalId: string,
  status: GoalProgressProjection["status"],
  taskCompletedCount: number,
  taskTotalCount: number,
  milestoneCompletedCount: number,
  milestoneTotalCount: number,
  hiddenSkillCount: number,
  timestamp: IsoDateTime
): GoalProgressProjection {
  return {
    id: `prj_${goalId}` as GoalProgressProjection["id"],
    goalId: goalId as GoalProgressProjection["goalId"],
    status,
    taskMetric: {
      completedCount: taskCompletedCount,
      totalCount: taskTotalCount,
      percentComplete:
        taskTotalCount === 0 ? 0 : Math.round((taskCompletedCount / taskTotalCount) * 100)
    },
    milestoneMetric: {
      completedCount: milestoneCompletedCount,
      totalCount: milestoneTotalCount,
      percentComplete:
        milestoneTotalCount === 0
          ? 0
          : Math.round((milestoneCompletedCount / milestoneTotalCount) * 100)
    },
    hiddenSkillCount,
    lastSourceEventAt: timestamp,
    ...auditFields(timestamp)
  };
}

function trackerSeed(): TrackerSeed {
  const currentTimestamp = now();

  const awsProjection = createGoalProjection(
    "gol_aws_cert",
    "on-track",
    3,
    4,
    1,
    1,
    0,
    currentTimestamp
  );
  const portfolioProjection = createGoalProjection(
    "gol_portfolio_refresh",
    "at-risk",
    1,
    4,
    0,
    1,
    2,
    currentTimestamp
  );

  const lagSnapshot = [
    {
      projectionName: "workspace-progress-overview",
      status: "current",
      lagSeconds: 12,
      lastAppliedEventAt: currentTimestamp
    },
    {
      projectionName: "goal-progress:gol_aws_cert",
      status: "current",
      lagSeconds: 45,
      lastAppliedEventAt: currentTimestamp
    },
    {
      projectionName: "goal-progress:gol_portfolio_refresh",
      status: "stale",
      lagSeconds: 780,
      lastAppliedEventAt: currentTimestamp
    }
  ] satisfies ProjectionLagSnapshot[];

  const goalSummaries = [
    {
      goalId: portfolioProjection.goalId,
      title: "Ship system design portfolio refresh",
      status: portfolioProjection.status,
      completionPercent: 25,
      completedPlanItemCount: 1,
      totalPlanItemCount: 4,
      hiddenSkillCount: portfolioProjection.hiddenSkillCount,
      lagStatus: "stale",
      lastSourceEventAt: portfolioProjection.lastSourceEventAt
    },
    {
      goalId: awsProjection.goalId,
      title: "Earn AWS Developer Associate",
      status: awsProjection.status,
      completionPercent: 75,
      completedPlanItemCount: 3,
      totalPlanItemCount: 4,
      hiddenSkillCount: awsProjection.hiddenSkillCount,
      lagStatus: "current",
      lastSourceEventAt: awsProjection.lastSourceEventAt
    }
  ] satisfies TrackerGoalSummary[];

  return {
    overview: {
      id: "prj_workspace_demo" as WorkspaceProgressOverview["id"],
      activeGoalCount: 2,
      completedGoalCount: 1,
      overdueGoalCount: 1,
      totalPlanItemCount: 8,
      completedPlanItemCount: 5,
      completionPercent: 63,
      lastSourceEventAt: currentTimestamp,
      ...auditFields(currentTimestamp)
    } satisfies WorkspaceProgressOverview,
    goalSummaries,
    goalProjections: {
      [awsProjection.goalId]: {
        projection: awsProjection,
        goal: {
          goalId: awsProjection.goalId,
          title: "Earn AWS Developer Associate",
          completionPercent: 75,
          completedPlanItemCount: 3,
          totalPlanItemCount: 4,
          hiddenSkillCount: awsProjection.hiddenSkillCount
        },
        lag:
          lagSnapshot.find((entry) => entry.projectionName === "goal-progress:gol_aws_cert") ??
          null,
        workspaceOverview: {
          completionPercent: 63,
          activeGoalCount: 2
        }
      },
      [portfolioProjection.goalId]: {
        projection: portfolioProjection,
        goal: {
          goalId: portfolioProjection.goalId,
          title: "Ship system design portfolio refresh",
          completionPercent: 25,
          completedPlanItemCount: 1,
          totalPlanItemCount: 4,
          hiddenSkillCount: portfolioProjection.hiddenSkillCount
        },
        lag:
          lagSnapshot.find(
            (entry) =>
              entry.projectionName === "goal-progress:gol_portfolio_refresh"
          ) ?? null,
        workspaceOverview: {
          completionPercent: 63,
          activeGoalCount: 2
        }
      }
    },
    lagSnapshot
  };
}

export const trackerStore = {
  overview: {} as WorkspaceProgressOverview,
  goalSummaries: [] as TrackerGoalSummary[],
  goalProjections: {} as Record<string, TrackerGoalProjectionPayload>,
  lagSnapshot: [] as ProjectionLagSnapshot[]
};

export function resetTrackerStore() {
  const seed = trackerSeed();

  trackerStore.overview = seed.overview;
  trackerStore.goalSummaries = seed.goalSummaries;
  trackerStore.goalProjections = seed.goalProjections;
  trackerStore.lagSnapshot = seed.lagSnapshot;
}

export function listGoalSummaries() {
  return trackerStore.goalSummaries;
}

export function listLagSnapshots(status?: ProjectionStatus) {
  if (!status) {
    return trackerStore.lagSnapshot;
  }

  return trackerStore.lagSnapshot.filter((entry) => entry.status === status);
}

export function summarizeLag(lagEntries: readonly ProjectionLagSnapshot[]) {
  const counts = {
    currentCount: 0,
    staleCount: 0,
    rebuildingCount: 0,
    failedCount: 0
  };

  for (const entry of lagEntries) {
    if (entry.status === "current") {
      counts.currentCount += 1;
    } else if (entry.status === "stale") {
      counts.staleCount += 1;
    } else if (entry.status === "rebuilding") {
      counts.rebuildingCount += 1;
    } else if (entry.status === "failed") {
      counts.failedCount += 1;
    }
  }

  return {
    ...counts,
    maxLagSeconds: lagEntries.reduce(
      (maxLagSeconds, entry) => Math.max(maxLagSeconds, entry.lagSeconds),
      0
    )
  };
}

export function overallLagStatus(lagEntries: readonly ProjectionLagSnapshot[]): ProjectionStatus {
  if (lagEntries.some((entry) => entry.status === "failed")) {
    return "failed";
  }

  if (lagEntries.some((entry) => entry.status === "rebuilding")) {
    return "rebuilding";
  }

  if (lagEntries.some((entry) => entry.status === "stale")) {
    return "stale";
  }

  return "current";
}

export function getGoalProjection(goalId: string) {
  return trackerStore.goalProjections[goalId];
}

resetTrackerStore();
