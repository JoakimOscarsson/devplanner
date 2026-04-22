import { GatewayClient } from "@pdp-helper/runtime-web";
import type { GoalProgressProjection } from "@pdp-helper/contracts-tracker";
import type {
  TrackerLagSummary,
  TrackerOverviewPayload,
  TrackerSelectedGoalProjection,
  TrackerSnapshot
} from "./tracker-model";

export interface TrackerLagResponse {
  readonly lag: TrackerSnapshot["lag"];
  readonly summary: TrackerLagSummary;
}

export interface TrackerGatewayPort {
  getOverview(): Promise<TrackerOverviewPayload>;
  listLag(status?: string): Promise<TrackerLagResponse>;
  getGoalProjection(
    goalId: GoalProgressProjection["goalId"]
  ): Promise<TrackerSelectedGoalProjection>;
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

export function createTrackerGatewayPort(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): TrackerGatewayPort {
  const client = fetcher === fetch ? new GatewayClient(baseUrl) : null;
  const request = client
    ? client.request.bind(client)
    : createFetchRequest(baseUrl, fetcher);

  return {
    getOverview() {
      return request<TrackerOverviewPayload>("/api/v1/progress/overview");
    },

    listLag(status) {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      return request<TrackerLagResponse>(`/api/v1/progress/lag${query}`);
    },

    getGoalProjection(goalId) {
      return request<TrackerSelectedGoalProjection>(`/api/v1/progress/goals/${goalId}`);
    }
  };
}

export async function loadTrackerSnapshot(
  gateway: TrackerGatewayPort,
  options: {
    readonly selectedGoalId?: GoalProgressProjection["goalId"];
  } = {}
): Promise<TrackerSnapshot> {
  const [overview, lagResponse] = await Promise.all([
    gateway.getOverview(),
    gateway.listLag()
  ]);

  const selectedGoalId =
    overview.goalSummaries.some((goal) => goal.goalId === options.selectedGoalId)
      ? options.selectedGoalId
      : overview.goalSummaries[0]?.goalId;

  if (!selectedGoalId) {
    return {
      overview: overview.overview,
      goalSummaries: overview.goalSummaries,
      lag: lagResponse.lag
    };
  }

  const selectedGoalProjection = await gateway.getGoalProjection(selectedGoalId);

  return {
    overview: overview.overview,
    goalSummaries: overview.goalSummaries,
    lag: lagResponse.lag,
    selectedGoalId,
    selectedGoalProjection
  };
}
