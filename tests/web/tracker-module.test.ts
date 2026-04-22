import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ModuleCapability } from "@pdp-helper/contracts-core";
import type {
  GoalProgressProjection,
  ProjectionLagSnapshot,
  WorkspaceProgressOverview
} from "@pdp-helper/contracts-tracker";
import {
  TrackerSpotlight,
  type TrackerSnapshot
} from "../../apps/web/src/modules/tracker/TrackerSpotlight";
import {
  createTrackerGatewayPort,
  loadTrackerSnapshot
} from "../../apps/web/src/modules/tracker/tracker-gateway";
import {
  buildTrackerPanelModel,
  EMPTY_TRACKER_SNAPSHOT
} from "../../apps/web/src/modules/tracker/tracker-model";

const auditFields = {
  workspaceId: "wrk_demo_owner",
  createdBy: "act_demo_owner",
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z"
} as const;

function createOverview(): WorkspaceProgressOverview {
  return {
    id: "prj_workspace_demo" as WorkspaceProgressOverview["id"],
    activeGoalCount: 2,
    completedGoalCount: 1,
    overdueGoalCount: 1,
    totalPlanItemCount: 8,
    completedPlanItemCount: 5,
    completionPercent: 63,
    lastSourceEventAt: "2026-04-22T09:15:00.000Z" as WorkspaceProgressOverview["lastSourceEventAt"],
    ...auditFields
  };
}

function createProjection(
  goalId: string,
  status: GoalProgressProjection["status"],
  hiddenSkillCount: number
): GoalProgressProjection {
  return {
    id: `prj_${goalId}` as GoalProgressProjection["id"],
    goalId: goalId as GoalProgressProjection["goalId"],
    status,
    taskMetric: {
      completedCount: status === "at-risk" ? 1 : 3,
      totalCount: 4,
      percentComplete: status === "at-risk" ? 25 : 75
    },
    milestoneMetric: {
      completedCount: status === "at-risk" ? 0 : 1,
      totalCount: 1,
      percentComplete: status === "at-risk" ? 0 : 100
    },
    hiddenSkillCount,
    lastSourceEventAt: "2026-04-22T09:15:00.000Z" as GoalProgressProjection["lastSourceEventAt"],
    ...auditFields
  };
}

function createLag(
  projectionName: string,
  status: ProjectionLagSnapshot["status"],
  lagSeconds: number
): ProjectionLagSnapshot {
  return {
    projectionName,
    status,
    lagSeconds,
    lastAppliedEventAt: "2026-04-22T09:14:00.000Z" as ProjectionLagSnapshot["lastAppliedEventAt"]
  };
}

function createSnapshot(): TrackerSnapshot {
  return {
    overview: createOverview(),
    goalSummaries: [
      {
        goalId: "gol_portfolio_refresh" as GoalProgressProjection["goalId"],
        title: "Ship system design portfolio refresh",
        status: "at-risk",
        completionPercent: 25,
        completedPlanItemCount: 1,
        totalPlanItemCount: 4,
        hiddenSkillCount: 2,
        lagStatus: "stale",
        lastSourceEventAt: "2026-04-22T09:15:00.000Z" as GoalProgressProjection["lastSourceEventAt"]
      },
      {
        goalId: "gol_aws_cert" as GoalProgressProjection["goalId"],
        title: "Earn AWS Developer Associate",
        status: "on-track",
        completionPercent: 75,
        completedPlanItemCount: 3,
        totalPlanItemCount: 4,
        hiddenSkillCount: 0,
        lagStatus: "current",
        lastSourceEventAt: "2026-04-22T09:10:00.000Z" as GoalProgressProjection["lastSourceEventAt"]
      }
    ],
    lag: [
      createLag("goal-progress:gol_portfolio_refresh", "stale", 780),
      createLag("workspace-progress-overview", "current", 12)
    ],
    selectedGoalId: "gol_portfolio_refresh" as GoalProgressProjection["goalId"],
    selectedGoalProjection: {
      projection: createProjection("gol_portfolio_refresh", "at-risk", 2),
      goal: {
        goalId: "gol_portfolio_refresh" as GoalProgressProjection["goalId"],
        title: "Ship system design portfolio refresh",
        completionPercent: 25,
        completedPlanItemCount: 1,
        totalPlanItemCount: 4,
        hiddenSkillCount: 2
      },
      lag: createLag("goal-progress:gol_portfolio_refresh", "stale", 780),
      workspaceOverview: {
        completionPercent: 63,
        activeGoalCount: 2
      }
    }
  };
}

describe("tracker module", () => {
  it("uses gateway tracker proxy routes for overview, lag, and goal projections", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            overview: createOverview(),
            goalSummaries: createSnapshot().goalSummaries,
            lagSummary: {
              status: "stale",
              staleProjectionCount: 1,
              maxLagSeconds: 780
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
            lag: createSnapshot().lag,
            summary: {
              currentCount: 1,
              staleCount: 1,
              rebuildingCount: 0,
              failedCount: 0,
              maxLagSeconds: 780
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
        new Response(JSON.stringify(createSnapshot().selectedGoalProjection), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    const port = createTrackerGatewayPort("http://localhost:4000", fetcher);

    await port.getOverview();
    await port.listLag();
    await port.getGoalProjection("gol_portfolio_refresh" as GoalProgressProjection["goalId"]);

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/progress/overview",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/progress/lag",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/progress/goals/gol_portfolio_refresh",
      undefined
    );
  });

  it("loads a tracker snapshot and preserves the selected goal focus", async () => {
    const snapshot = await loadTrackerSnapshot(
      {
        getOverview: async () => ({
          overview: createOverview(),
          goalSummaries: createSnapshot().goalSummaries,
          lagSummary: {
            status: "stale",
            staleProjectionCount: 1,
            maxLagSeconds: 780
          }
        }),
        listLag: async () => ({
          lag: createSnapshot().lag,
          summary: {
            currentCount: 1,
            staleCount: 1,
            rebuildingCount: 0,
            failedCount: 0,
            maxLagSeconds: 780
          }
        }),
        getGoalProjection: async () => createSnapshot().selectedGoalProjection
      },
      {
        selectedGoalId: "gol_portfolio_refresh" as GoalProgressProjection["goalId"]
      }
    );

    expect(snapshot.selectedGoalId).toBe("gol_portfolio_refresh");
    expect(snapshot.selectedGoalProjection?.goal.title).toBe(
      "Ship system design portfolio refresh"
    );
  });

  it("builds a demo-friendly tracker panel model", () => {
    const model = buildTrackerPanelModel(createSnapshot(), {
      lagFilter: "stale"
    });

    expect(model.overviewMetrics.completionPercentLabel).toBe("63%");
    expect(model.lagMetrics.maxLagLabel).toContain("13m");
    expect(model.goalCards[0]).toMatchObject({
      title: "Ship system design portfolio refresh",
      isSelected: true,
      statusTone: "stale"
    });
    expect(model.selectedGoal?.title).toBe("Ship system design portfolio refresh");
    expect(model.lagEntries).toHaveLength(1);
    expect(model.lagEntries[0]?.projectionName).toContain("goal-progress");
  });

  it("renders overview, lag, and selected goal projection details", () => {
    const module: ModuleCapability = {
      key: "tracker",
      title: "Tracker",
      description: "Projection-based progress monitoring.",
      route: "/tracker",
      service: "tracker-service",
      version: "v1",
      optional: true,
      enabled: true,
      status: "up"
    };

    const markup = renderToStaticMarkup(
      createElement(TrackerSpotlight, {
        module,
        snapshot: createSnapshot(),
        feedback: "Projection refreshed from the latest planner events."
      })
    );

    expect(markup).toContain("Tracking");
    expect(markup).toContain("Workspace overview");
    expect(markup).toContain("Projection lag");
    expect(markup).toContain("Stale only");
    expect(markup).toContain("Goal focus");
    expect(markup).toContain("Ship system design portfolio refresh");
    expect(markup).toContain("Projection refreshed from the latest planner events.");
  });

  it("returns an empty tracker model without crashing", () => {
    const model = buildTrackerPanelModel(EMPTY_TRACKER_SNAPSHOT);

    expect(model.goalCards).toHaveLength(0);
    expect(model.selectedGoal).toBeNull();
    expect(model.lagMetrics.summaryLabel).toContain("No projection lag");
  });
});
