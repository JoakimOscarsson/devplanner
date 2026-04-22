import type {
  ProviderHealth,
  Recommendation,
  RecommendationDecision,
  RecommendationRun
} from "@pdp-helper/contracts-recommendation";

export interface RecommendationsSnapshot {
  readonly recommendations: readonly Recommendation[];
  readonly decisions: readonly RecommendationDecision[];
  readonly providers: readonly ProviderHealth[];
  readonly runs: readonly RecommendationRun[];
}

export const EMPTY_RECOMMENDATIONS_SNAPSHOT: RecommendationsSnapshot = {
  recommendations: [],
  decisions: [],
  providers: [],
  runs: []
};

function compareUpdatedAt(
  left: { updatedAt: string },
  right: { updatedAt: string }
) {
  return right.updatedAt.localeCompare(left.updatedAt);
}

function compareDecisionTime(
  left: RecommendationDecision,
  right: RecommendationDecision
) {
  return right.decidedAt.localeCompare(left.decidedAt);
}

export function buildRecommendationsPanelModel(
  snapshot: RecommendationsSnapshot
) {
  const pendingRecommendations = snapshot.recommendations
    .filter((recommendation) => recommendation.status === "pending")
    .sort(compareUpdatedAt);
  const decidedRecommendations = snapshot.recommendations
    .filter((recommendation) => recommendation.status !== "pending")
    .sort(compareUpdatedAt);
  const recentDecisions = [...snapshot.decisions].sort(compareDecisionTime);
  const activeProvider = snapshot.providers[0];
  const totalRuns = snapshot.runs.length;
  const queuedRuns = snapshot.runs.filter((run) => run.status === "queued").length;
  const deferredRuns = snapshot.runs.filter((run) => run.status === "deferred").length;

  return {
    pendingRecommendations,
    decidedRecommendations,
    recentDecisions,
    providerSummary: {
      statusTone: activeProvider?.status ?? "unknown",
      message:
        activeProvider?.message ??
        "Provider health has not reported yet for this environment.",
      checkedAt: activeProvider?.checkedAt,
      lastSuccessfulAt: activeProvider?.lastSuccessfulAt
    },
    runSummary: {
      totalRuns,
      queuedRuns,
      deferredRuns,
      latestRun: [...snapshot.runs].sort(compareUpdatedAt)[0]
    }
  };
}
