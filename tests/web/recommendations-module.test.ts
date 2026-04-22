import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ProviderHealth,
  Recommendation,
  RecommendationDecision,
  RecommendationRun
} from "@pdp-helper/contracts-recommendation";
import type { ModuleCapability } from "@pdp-helper/contracts-core";
import {
  createRecommendationsGatewayPort,
  loadRecommendationsSnapshot
} from "../../apps/web/src/modules/recommendations/recommendations-gateway";
import {
  buildRecommendationsPanelModel,
  EMPTY_RECOMMENDATIONS_SNAPSHOT,
  type RecommendationsSnapshot
} from "../../apps/web/src/modules/recommendations/recommendations-model";
import { RecommendationsSpotlight } from "../../apps/web/src/modules/recommendations/RecommendationsSpotlight";

const auditFields = {
  workspaceId: "wrk_demo_owner",
  createdBy: "act_demo_owner",
  createdAt: "2026-04-22T08:00:00.000Z",
  updatedAt: "2026-04-22T08:00:00.000Z"
} as const;

function createRecommendation(
  id: string,
  title: string,
  status: Recommendation["status"],
  targetKind: Recommendation["target"]["targetKind"] = "goal"
): Recommendation {
  return {
    id: id as Recommendation["id"],
    runId: "rrn_demo" as Recommendation["runId"],
    status,
    origin: "built-in",
    action: "create-plan-item",
    title,
    target: {
      targetKind
    },
    payload: {},
    ...auditFields
  };
}

function createDecision(
  recommendationId: string,
  decision: RecommendationDecision["decision"],
  reason?: string
): RecommendationDecision {
  return {
    recommendationId: recommendationId as RecommendationDecision["recommendationId"],
    decision,
    decidedAt: "2026-04-22T08:15:00.000Z" as RecommendationDecision["decidedAt"],
    ...(reason ? { reason } : {}),
    ...auditFields
  };
}

function createProviderHealth(
  status: ProviderHealth["status"],
  message: string
): ProviderHealth {
  return {
    providerId: "prv_remote_ollama" as ProviderHealth["providerId"],
    providerKind: "ollama",
    status,
    checkedAt: "2026-04-22T08:10:00.000Z" as ProviderHealth["checkedAt"],
    lastSuccessfulAt:
      status === "up"
        ? ("2026-04-22T08:09:00.000Z" as ProviderHealth["lastSuccessfulAt"])
        : undefined,
    message,
    ...auditFields
  };
}

function createRun(
  id: string,
  status: RecommendationRun["status"],
  trigger: RecommendationRun["trigger"] = "manual"
): RecommendationRun {
  return {
    id: id as RecommendationRun["id"],
    providerId: "prv_remote_ollama" as RecommendationRun["providerId"],
    trigger,
    status,
    startedAt: "2026-04-22T08:20:00.000Z" as RecommendationRun["startedAt"],
    deferredReason:
      status === "deferred" ? "Provider is not healthy enough to accept new work." : undefined,
    ...auditFields
  };
}

function createSnapshot(): RecommendationsSnapshot {
  return {
    recommendations: [
      createRecommendation("rec_pending", "Add a practice project", "pending"),
      createRecommendation("rec_denied", "Create a skill graph alias", "denied", "skill")
    ],
    decisions: [createDecision("rec_denied", "denied", "Stay focused on the current milestone.")],
    providers: [
      createProviderHealth("degraded", "OLLAMA_BASE_URL is not configured. Manual runs will be deferred.")
    ],
    runs: [createRun("rrn_bootstrap", "deferred", "recovery")]
  };
}

describe("recommendations module", () => {
  it("uses gateway recommendation routes for reads, runs, and decisions", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendations: [createRecommendation("rec_pending", "Add a practice project", "pending")],
            decisions: [],
            providers: [createProviderHealth("degraded", "Provider is deferred.")],
            runs: [createRun("rrn_bootstrap", "deferred")],
            summary: {
              pending: 1,
              accepted: 0,
              denied: 0,
              queuedRuns: 0,
              deferredRuns: 1
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
            run: createRun("rrn_manual", "queued"),
            reason: "Manual recommendation run accepted."
          }),
          {
            status: 202,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accepted: true,
            recommendation: createRecommendation("rec_pending", "Add a practice project", "accepted"),
            decision: createDecision("rec_pending", "accepted", "Strong next step.")
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          }
        )
      );

    const port = createRecommendationsGatewayPort("http://localhost:4000", fetcher);

    await port.getFeed();
    await port.requestRun({
      providerId: "prv_remote_ollama" as RecommendationRun["providerId"]
    });
    await port.recordDecision({
      recommendationId: "rec_pending" as Recommendation["id"],
      decision: "accepted",
      reason: "Strong next step."
    });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "http://localhost:4000/api/v1/recommendations",
      undefined
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      "http://localhost:4000/api/v1/recommendations/runs",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          providerId: "prv_remote_ollama"
        })
      }
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      3,
      "http://localhost:4000/api/v1/recommendations/rec_pending/accept",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: "Strong next step."
        })
      }
    );
  });

  it("loads a snapshot and highlights pending review work", async () => {
    const snapshot = await loadRecommendationsSnapshot({
      getFeed: async () => ({
        ...createSnapshot(),
        summary: {
          pending: 1,
          accepted: 0,
          denied: 1,
          queuedRuns: 0,
          deferredRuns: 1
        }
      })
    });

    expect(snapshot.recommendations).toHaveLength(2);

    const model = buildRecommendationsPanelModel(snapshot);

    expect(model.pendingRecommendations).toHaveLength(1);
    expect(model.recentDecisions[0]?.reason).toContain("Stay focused");
    expect(model.providerSummary.statusTone).toBe("degraded");
    expect(model.runSummary.deferredRuns).toBe(1);
  });

  it("renders provider health, feed visibility, and decision history", () => {
    const module: ModuleCapability = {
      key: "recommendations",
      title: "Recommendations",
      description: "Recommendation review and provider orchestration.",
      route: "/recommendations",
      service: "recommendation-service",
      version: "v1",
      optional: true,
      enabled: true,
      status: "up"
    };

    const markup = renderToStaticMarkup(
      createElement(RecommendationsSpotlight, {
        module,
        snapshot: createSnapshot(),
        feedback: "Decision recorded."
      })
    );

    expect(markup).toContain("Recommendations module");
    expect(markup).toContain("Provider health");
    expect(markup).toContain("Add a practice project");
    expect(markup).toContain("Stay focused on the current milestone.");
    expect(markup).toContain("Decision recorded.");
    expect(markup).toContain("Review queue");
  });

  it("returns an empty model without crashing when the feed has not loaded", () => {
    const model = buildRecommendationsPanelModel(EMPTY_RECOMMENDATIONS_SNAPSHOT);

    expect(model.pendingRecommendations).toHaveLength(0);
    expect(model.runSummary.totalRuns).toBe(0);
    expect(model.providerSummary.message).toContain("not reported");
  });
});
