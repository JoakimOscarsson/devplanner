import type { ActorId, IsoDateTime, ProviderId, WorkspaceId } from "@pdp-helper/contracts-core";
import type {
  ProviderHealth,
  Recommendation,
  RecommendationDecision,
  RecommendationRun,
  RecommendationTargetRef
} from "@pdp-helper/contracts-recommendation";

const workspaceId = "wrk_demo_owner" as WorkspaceId;
const actorId = "act_recommendation" as ActorId;
const providerId = "prv_remote_ollama" as ProviderId;

function now(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

function auditFields() {
  const timestamp = now();

  return {
    workspaceId,
    createdBy: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildProviderHealth(): ProviderHealth {
  const timestamp = now();
  const providerConfigured = Boolean(process.env.OLLAMA_BASE_URL);

  return {
    providerId,
    providerKind: "ollama",
    status: providerConfigured ? "up" : "degraded",
    checkedAt: timestamp,
    lastSuccessfulAt: providerConfigured ? timestamp : undefined,
    message: providerConfigured
      ? "External Ollama endpoint configured."
      : "OLLAMA_BASE_URL is not configured. Manual runs will be deferred.",
    workspaceId,
    createdBy: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildInitialRecommendations(): Recommendation[] {
  return [
    {
      id: "rec_event_driven" as Recommendation["id"],
      runId: "rrn_bootstrap" as Recommendation["runId"],
      status: "pending",
      origin: "built-in",
      action: "create-plan-item",
      title: "Add an event-driven practice project",
      rationale:
        "This goal would strengthen both system design and implementation fluency.",
      target: {
        targetKind: "goal",
        goalId: "gol_aws_cert" as RecommendationTargetRef["goalId"]
      },
      payload: {
        suggestedPlanItemTitle: "Build a small event-driven service mesh prototype"
      },
      ...auditFields()
    },
    {
      id: "rec_visibility" as Recommendation["id"],
      runId: "rrn_bootstrap" as Recommendation["runId"],
      status: "pending",
      origin: "system",
      action: "annotate",
      title: "Add a short review note to the skills slice",
      rationale:
        "A visible note helps explain why the current skill-graph work is still optional in the demo.",
      target: {
        targetKind: "skill",
        skillId: "skl_event_driven_architecture" as RecommendationTargetRef["skillId"]
      },
      payload: {
        suggestedNote:
          "Explain that the skill graph becomes more valuable after brainstorm and planner flows settle."
      },
      ...auditFields()
    }
  ];
}

function buildInitialRuns(): RecommendationRun[] {
  return [
    {
      id: "rrn_bootstrap" as RecommendationRun["id"],
      providerId,
      trigger: "recovery",
      status: "deferred",
      startedAt: now(),
      deferredReason: "Provider is not healthy enough to accept new work.",
      ...auditFields()
    }
  ];
}

export let providerHealth = buildProviderHealth();
export let recommendations = buildInitialRecommendations();
export let decisions: RecommendationDecision[] = [];
export let runs = buildInitialRuns();

let runSequence = 1;

export function resetRecommendationStore() {
  providerHealth = buildProviderHealth();
  recommendations = buildInitialRecommendations();
  decisions = [];
  runs = buildInitialRuns();
  runSequence = 1;
}

export function listRecommendations(filters: {
  status?: Recommendation["status"];
  targetKind?: Recommendation["target"]["targetKind"];
} = {}) {
  return recommendations.filter((recommendation) => {
    if (filters.status && recommendation.status !== filters.status) {
      return false;
    }

    if (
      filters.targetKind &&
      recommendation.target.targetKind !== filters.targetKind
    ) {
      return false;
    }

    return true;
  });
}

export function listRuns(filters: {
  providerId?: ProviderId;
  status?: RecommendationRun["status"];
} = {}) {
  return runs.filter((run) => {
    if (filters.providerId && run.providerId !== filters.providerId) {
      return false;
    }

    if (filters.status && run.status !== filters.status) {
      return false;
    }

    return true;
  });
}

export function getRecommendationSummary() {
  return {
    pending: recommendations.filter((entry) => entry.status === "pending").length,
    accepted: recommendations.filter((entry) => entry.status === "accepted").length,
    denied: recommendations.filter((entry) => entry.status === "denied").length,
    queuedRuns: runs.filter((entry) => entry.status === "queued").length,
    deferredRuns: runs.filter((entry) => entry.status === "deferred").length
  };
}

export function recordRecommendationDecision(input: {
  recommendationId: Recommendation["id"];
  decision: RecommendationDecision["decision"];
  reason?: string;
}) {
  const recommendation = recommendations.find(
    (entry) => entry.id === input.recommendationId
  );

  if (!recommendation) {
    return null;
  }

  const timestamp = now();

  recommendation.status = input.decision;
  recommendation.updatedAt = timestamp;

  const decision: RecommendationDecision = {
    recommendationId: recommendation.id,
    decision: input.decision,
    decidedAt: timestamp,
    ...(input.reason ? { reason: input.reason } : {}),
    workspaceId: recommendation.workspaceId,
    createdBy: recommendation.createdBy,
    createdAt: recommendation.createdAt,
    updatedAt: timestamp
  };

  decisions = [
    ...decisions.filter(
      (entry) => entry.recommendationId !== input.recommendationId
    ),
    decision
  ];

  return {
    recommendation,
    decision
  };
}

export function updateProviderHealth(input: {
  status: ProviderHealth["status"];
  message?: string;
}) {
  const timestamp = now();

  providerHealth = {
    ...providerHealth,
    status: input.status,
    checkedAt: timestamp,
    updatedAt: timestamp,
    lastSuccessfulAt:
      input.status === "up"
        ? timestamp
        : providerHealth.lastSuccessfulAt,
    ...(input.message ? { message: input.message } : {})
  };

  return providerHealth;
}

export function createRecommendationRun(input: {
  providerId?: ProviderId;
  trigger?: RecommendationRun["trigger"];
  target?: RecommendationTargetRef;
}) {
  const timestamp = now();
  const runId = `rrn_manual_${String(runSequence).padStart(2, "0")}` as RecommendationRun["id"];
  runSequence += 1;
  const deferred = providerHealth.status !== "up";
  const run: RecommendationRun = {
    id: runId,
    providerId: input.providerId ?? providerHealth.providerId,
    trigger: input.trigger ?? "manual",
    status: deferred ? "deferred" : "queued",
    startedAt: timestamp,
    ...(deferred
      ? {
          deferredReason: "Provider is not healthy enough to accept new work."
        }
      : {}),
    ...auditFields()
  };

  runs = [...runs, run];

  return {
    run,
    reason: deferred
      ? "Provider is not healthy enough to accept new work."
      : "Manual recommendation run accepted."
  };
}
