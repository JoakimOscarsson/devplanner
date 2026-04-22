import type {
  GoalProgressProjection,
  ProjectionLagSnapshot,
  ProjectionStatus,
  WorkspaceProgressOverview
} from "@pdp-helper/contracts-tracker";

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

export interface TrackerLagSummary {
  readonly currentCount: number;
  readonly staleCount: number;
  readonly rebuildingCount: number;
  readonly failedCount: number;
  readonly maxLagSeconds: number;
}

export interface TrackerOverviewPayload {
  readonly overview: WorkspaceProgressOverview;
  readonly goalSummaries: readonly TrackerGoalSummary[];
  readonly lagSummary: {
    readonly status: ProjectionStatus;
    readonly staleProjectionCount: number;
    readonly maxLagSeconds: number;
  };
}

export interface TrackerSelectedGoalProjection {
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

export interface TrackerSnapshot {
  readonly overview?: WorkspaceProgressOverview;
  readonly goalSummaries: readonly TrackerGoalSummary[];
  readonly lag: readonly ProjectionLagSnapshot[];
  readonly selectedGoalId?: GoalProgressProjection["goalId"];
  readonly selectedGoalProjection?: TrackerSelectedGoalProjection;
}

export interface TrackerGoalCardModel {
  readonly goalId: GoalProgressProjection["goalId"];
  readonly title: string;
  readonly status: GoalProgressProjection["status"];
  readonly statusTone: ProjectionStatus;
  readonly isSelected: boolean;
  readonly completionPercentLabel: string;
  readonly progressLabel: string;
  readonly hiddenSkillLabel: string;
}

export interface TrackerOverviewMetricsModel {
  readonly activeGoalCountLabel: string;
  readonly completedGoalCountLabel: string;
  readonly completionPercentLabel: string;
  readonly overdueGoalCountLabel: string;
}

export interface TrackerLagMetricsModel {
  readonly statusTone: ProjectionStatus | "none";
  readonly maxLagLabel: string;
  readonly summaryLabel: string;
}

export interface TrackerSelectedGoalModel {
  readonly title: string;
  readonly status: GoalProgressProjection["status"];
  readonly completionPercentLabel: string;
  readonly taskProgressLabel: string;
  readonly milestoneProgressLabel: string;
  readonly hiddenSkillLabel: string;
  readonly lagLabel: string;
  readonly workspaceContextLabel: string;
}

export interface TrackerPanelModel {
  readonly overviewMetrics: TrackerOverviewMetricsModel;
  readonly lagMetrics: TrackerLagMetricsModel;
  readonly goalCards: readonly TrackerGoalCardModel[];
  readonly selectedGoal: TrackerSelectedGoalModel | null;
}

export const EMPTY_TRACKER_SNAPSHOT: TrackerSnapshot = {
  goalSummaries: [],
  lag: []
};

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function formatLagSeconds(lagSeconds: number) {
  if (lagSeconds <= 0) {
    return "0s";
  }

  const minutes = Math.floor(lagSeconds / 60);
  const seconds = lagSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function compareGoalCards(
  left: TrackerGoalSummary,
  right: TrackerGoalSummary,
  selectedGoalId?: GoalProgressProjection["goalId"]
) {
  const leftSelectedWeight = left.goalId === selectedGoalId ? 0 : 1;
  const rightSelectedWeight = right.goalId === selectedGoalId ? 0 : 1;

  if (leftSelectedWeight !== rightSelectedWeight) {
    return leftSelectedWeight - rightSelectedWeight;
  }

  const lagWeight: Record<ProjectionStatus, number> = {
    failed: 0,
    stale: 1,
    rebuilding: 2,
    current: 3
  };

  if (lagWeight[left.lagStatus] !== lagWeight[right.lagStatus]) {
    return lagWeight[left.lagStatus] - lagWeight[right.lagStatus];
  }

  return left.title.localeCompare(right.title);
}

export function buildTrackerPanelModel(snapshot: TrackerSnapshot): TrackerPanelModel {
  const selectedGoalId =
    snapshot.selectedGoalId ??
    snapshot.selectedGoalProjection?.goal.goalId ??
    snapshot.goalSummaries[0]?.goalId;

  const goalCards = [...snapshot.goalSummaries]
    .sort((left, right) => compareGoalCards(left, right, selectedGoalId))
    .map((goal) => ({
      goalId: goal.goalId,
      title: goal.title,
      status: goal.status,
      statusTone: goal.lagStatus,
      isSelected: goal.goalId === selectedGoalId,
      completionPercentLabel: formatPercent(goal.completionPercent),
      progressLabel: `${goal.completedPlanItemCount}/${goal.totalPlanItemCount} plan items complete`,
      hiddenSkillLabel:
        goal.hiddenSkillCount === 0
          ? "No hidden skill links"
          : `${goal.hiddenSkillCount} hidden skill link${
              goal.hiddenSkillCount === 1 ? "" : "s"
            }`
    })) satisfies TrackerGoalCardModel[];

  const overviewMetrics = snapshot.overview
    ? {
        activeGoalCountLabel: String(snapshot.overview.activeGoalCount),
        completedGoalCountLabel: String(snapshot.overview.completedGoalCount),
        completionPercentLabel: formatPercent(snapshot.overview.completionPercent),
        overdueGoalCountLabel: String(snapshot.overview.overdueGoalCount)
      }
    : {
        activeGoalCountLabel: "0",
        completedGoalCountLabel: "0",
        completionPercentLabel: "0%",
        overdueGoalCountLabel: "0"
      };

  const maxLagSeconds = snapshot.lag.reduce(
    (currentMax, lagEntry) => Math.max(currentMax, lagEntry.lagSeconds),
    0
  );
  const staleCount = snapshot.lag.filter((entry) => entry.status === "stale").length;
  const lagMetrics =
    snapshot.lag.length === 0
      ? {
          statusTone: "none" as const,
          maxLagLabel: "0s",
          summaryLabel: "No projection lag reported yet."
        }
      : {
          statusTone:
            snapshot.lag.some((entry) => entry.status === "failed")
              ? ("failed" as const)
              : snapshot.lag.some((entry) => entry.status === "rebuilding")
                ? ("rebuilding" as const)
                : snapshot.lag.some((entry) => entry.status === "stale")
                  ? ("stale" as const)
                  : ("current" as const),
          maxLagLabel: formatLagSeconds(maxLagSeconds),
          summaryLabel:
            staleCount > 0
              ? `${staleCount} projection${staleCount === 1 ? "" : "s"} stale`
              : "All visible projections are current."
        };

  const selectedGoal = snapshot.selectedGoalProjection
    ? {
        title: snapshot.selectedGoalProjection.goal.title,
        status: snapshot.selectedGoalProjection.projection.status,
        completionPercentLabel: formatPercent(
          snapshot.selectedGoalProjection.goal.completionPercent
        ),
        taskProgressLabel: `${snapshot.selectedGoalProjection.projection.taskMetric.completedCount}/${snapshot.selectedGoalProjection.projection.taskMetric.totalCount} tasks complete`,
        milestoneProgressLabel: `${snapshot.selectedGoalProjection.projection.milestoneMetric.completedCount}/${snapshot.selectedGoalProjection.projection.milestoneMetric.totalCount} milestones complete`,
        hiddenSkillLabel:
          snapshot.selectedGoalProjection.goal.hiddenSkillCount === 0
            ? "No hidden skill links"
            : `${snapshot.selectedGoalProjection.goal.hiddenSkillCount} hidden skill link${
                snapshot.selectedGoalProjection.goal.hiddenSkillCount === 1 ? "" : "s"
              }`,
        lagLabel: snapshot.selectedGoalProjection.lag
          ? `${snapshot.selectedGoalProjection.lag.status} at ${formatLagSeconds(
              snapshot.selectedGoalProjection.lag.lagSeconds
            )}`
          : "No lag snapshot attached",
        workspaceContextLabel: `${snapshot.selectedGoalProjection.workspaceOverview.activeGoalCount} active goals • workspace completion ${formatPercent(
          snapshot.selectedGoalProjection.workspaceOverview.completionPercent
        )}`
      }
    : null;

  return {
    overviewMetrics,
    lagMetrics,
    goalCards,
    selectedGoal
  };
}
