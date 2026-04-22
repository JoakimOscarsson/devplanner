import { GatewayClient } from "@pdp-helper/runtime-web";
import type {
  Recommendation,
  RecommendationDecision,
  RecommendationRun
} from "@pdp-helper/contracts-recommendation";
import type { ProviderId } from "@pdp-helper/contracts-core";
import type { RecommendationsSnapshot } from "./recommendations-model";

export interface RecommendationFeedResponse extends RecommendationsSnapshot {
  readonly summary: {
    pending: number;
    accepted: number;
    denied: number;
    queuedRuns: number;
    deferredRuns: number;
  };
}

export interface RequestRecommendationRunInput {
  readonly providerId?: ProviderId;
  readonly trigger?: RecommendationRun["trigger"];
  readonly target?: Recommendation["target"];
}

export interface RecommendationRunResponse {
  readonly run: RecommendationRun;
  readonly reason: string;
}

export interface RecommendationDecisionInput {
  readonly recommendationId: Recommendation["id"];
  readonly decision: RecommendationDecision["decision"];
  readonly reason?: string;
}

export interface RecommendationDecisionResponse {
  readonly accepted: true;
  readonly recommendation: Recommendation;
  readonly decision: RecommendationDecision;
}

export interface RecommendationsGatewayPort {
  getFeed(): Promise<RecommendationFeedResponse>;
  requestRun(input: RequestRecommendationRunInput): Promise<RecommendationRunResponse>;
  recordDecision(
    input: RecommendationDecisionInput
  ): Promise<RecommendationDecisionResponse>;
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

export function createRecommendationsGatewayPort(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): RecommendationsGatewayPort {
  const client = fetcher === fetch ? new GatewayClient(baseUrl) : null;
  const request =
    client
      ? client.request.bind(client)
      : createFetchRequest(baseUrl, fetcher);

  return {
    getFeed() {
      return request<RecommendationFeedResponse>("/api/v1/recommendations");
    },

    requestRun(input) {
      return request<RecommendationRunResponse>("/api/v1/recommendations/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ...(input.providerId ? { providerId: input.providerId } : {}),
          ...(input.trigger ? { trigger: input.trigger } : {}),
          ...(input.target ? { target: input.target } : {})
        })
      });
    },

    recordDecision(input) {
      return request<RecommendationDecisionResponse>(
        `/api/v1/recommendations/${input.recommendationId}/${input.decision === "accepted" ? "accept" : "deny"}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            ...(input.reason ? { reason: input.reason } : {})
          })
        }
      );
    }
  };
}

export async function loadRecommendationsSnapshot(
  gateway: Pick<RecommendationsGatewayPort, "getFeed">
): Promise<RecommendationsSnapshot> {
  const feed = await gateway.getFeed();

  return {
    recommendations: [...feed.recommendations],
    decisions: [...feed.decisions],
    providers: [...feed.providers],
    runs: [...feed.runs]
  };
}
