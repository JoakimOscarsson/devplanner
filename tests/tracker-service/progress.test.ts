import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  GoalProgressProjection,
  ProjectionLagSnapshot,
  WorkspaceProgressOverview
} from "@pdp-helper/contracts-tracker";
import { createService } from "@pdp-helper/runtime-node";
import { trackerHealthRoute } from "../../services/tracker-service/src/routes/health";
import { trackerProgressRoutes } from "../../services/tracker-service/src/routes/progress";
import { resetTrackerStore } from "../../services/tracker-service/src/storage/in-memory";

async function waitForListening(server: ReturnType<typeof createService>) {
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });
}

async function readJson<TPayload>(response: Response) {
  return (await response.json()) as TPayload;
}

describe("tracker-service progress routes", () => {
  const servers: Array<ReturnType<typeof createService>> = [];

  beforeEach(() => {
    resetTrackerStore();
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
      name: "tracker-service-test",
      port: 0,
      routes: [trackerHealthRoute, ...trackerProgressRoutes]
    });
    servers.push(server);
    await waitForListening(server);

    const port = (server.address() as AddressInfo).port;

    return {
      baseUrl: `http://127.0.0.1:${port}`
    };
  }

  it("returns a demo-friendly overview with goal summaries and lag summary", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/progress/overview`);
    const payload = await readJson<{
      overview: WorkspaceProgressOverview;
      goalSummaries: Array<{
        goalId: string;
        title: string;
        status: GoalProgressProjection["status"];
        completionPercent: number;
        hiddenSkillCount: number;
        lagStatus: ProjectionLagSnapshot["status"];
      }>;
      lagSummary: {
        status: ProjectionLagSnapshot["status"];
        staleProjectionCount: number;
        maxLagSeconds: number;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.overview.activeGoalCount).toBeGreaterThan(0);
    expect(payload.goalSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Earn AWS Developer Associate",
          status: "on-track"
        }),
        expect.objectContaining({
          title: "Ship system design portfolio refresh",
          status: "at-risk",
          lagStatus: "stale"
        })
      ])
    );
    expect(payload.lagSummary.maxLagSeconds).toBeGreaterThan(0);
  });

  it("supports lag filtering without mutating the projection state", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/progress/lag?status=stale`);
    const payload = await readJson<{
      lag: ProjectionLagSnapshot[];
      summary: {
        staleCount: number;
        maxLagSeconds: number;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.lag.length).toBeGreaterThan(0);
    expect(payload.lag.every((entry) => entry.status === "stale")).toBe(true);
    expect(payload.summary.staleCount).toBe(payload.lag.length);
  });

  it("returns a selected goal projection with related lag and workspace context", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/progress/goals/gol_portfolio_refresh`);
    const payload = await readJson<{
      projection: GoalProgressProjection;
      goal: {
        goalId: string;
        title: string;
        completionPercent: number;
      };
      lag: ProjectionLagSnapshot | null;
      workspaceOverview: {
        completionPercent: number;
        activeGoalCount: number;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.goal.title).toBe("Ship system design portfolio refresh");
    expect(payload.projection.status).toBe("at-risk");
    expect(payload.lag?.status).toBe("stale");
    expect(payload.workspaceOverview.activeGoalCount).toBeGreaterThan(0);
  });

  it("returns a tracker-owned not-found error for unknown projections", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(`${baseUrl}/v1/progress/goals/gol_missing`);
    const payload = await readJson<{
      error: {
        code: string;
        message: string;
      };
    }>(response);

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("PROJECTION_NOT_FOUND");
  });
});
