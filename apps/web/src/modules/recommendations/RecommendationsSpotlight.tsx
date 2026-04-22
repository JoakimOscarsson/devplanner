import { useEffect, useState, type FormEvent } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import type {
  Recommendation,
  RecommendationDecision
} from "@pdp-helper/contracts-recommendation";
import { gatewayUrl } from "../../lib/gateway";
import {
  createRecommendationsGatewayPort,
  loadRecommendationsSnapshot
} from "./recommendations-gateway";
import {
  buildRecommendationsPanelModel,
  EMPTY_RECOMMENDATIONS_SNAPSHOT,
  type RecommendationsSnapshot
} from "./recommendations-model";

export interface RecommendationsSpotlightProps {
  readonly module?: ModuleCapability;
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: RecommendationsSnapshot;
  readonly feedback?: string | null;
  readonly onRequestRun?: () => Promise<unknown> | unknown;
  readonly onRecordDecision?: (
    input: {
      recommendationId: Recommendation["id"];
      decision: RecommendationDecision["decision"];
      reason?: string;
    }
  ) => Promise<unknown> | unknown;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load recommendations.";
}

export function RecommendationsSpotlight({
  module,
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  feedback: feedbackOverride,
  onRequestRun,
  onRecordDecision
}: RecommendationsSpotlightProps) {
  const [localSnapshot, setLocalSnapshot] = useState<RecommendationsSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(feedbackOverride ?? null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [decisionReasonById, setDecisionReasonById] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLocalSnapshot(snapshot);
    setLoading(false);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    if (feedbackOverride === undefined) {
      return;
    }

    setFeedback(feedbackOverride);
  }, [feedbackOverride]);

  useEffect(() => {
    if (snapshot) {
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);

      try {
        const nextSnapshot = await loadRecommendationsSnapshot(
          createRecommendationsGatewayPort(gatewayBaseUrl)
        );

        if (!active) {
          return;
        }

        setLocalSnapshot(nextSnapshot);
        setError(null);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(requestError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [gatewayBaseUrl, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_RECOMMENDATIONS_SNAPSHOT;
  const model = buildRecommendationsPanelModel(activeSnapshot);
  const moduleStatus = module?.status ?? "unknown";

  async function handleRequestRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("run");
    setFeedback(null);
    setError(null);

    try {
      if (onRequestRun) {
        await onRequestRun();
      } else {
        const response = await createRecommendationsGatewayPort(
          gatewayBaseUrl
        ).requestRun({});

        setLocalSnapshot((current) =>
          current
            ? {
                ...current,
                runs: [...current.runs, response.run]
              }
            : current
        );
        setFeedback(response.reason);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDecision(
    recommendationId: Recommendation["id"],
    decision: RecommendationDecision["decision"]
  ) {
    setPendingAction(recommendationId);
    setFeedback(null);
    setError(null);

    try {
      const reason = decisionReasonById[recommendationId]?.trim();

      if (onRecordDecision) {
        await onRecordDecision({
          recommendationId,
          decision,
          ...(reason ? { reason } : {})
        });
      } else {
        const response = await createRecommendationsGatewayPort(
          gatewayBaseUrl
        ).recordDecision({
          recommendationId,
          decision,
          ...(reason ? { reason } : {})
        });

        setLocalSnapshot((current) => {
          if (!current) {
            return current;
          }

          const nextRecommendations = current.recommendations.map((entry) =>
            entry.id === recommendationId ? response.recommendation : entry
          );
          const nextDecisions = [
            ...current.decisions.filter(
              (entry) => entry.recommendationId !== recommendationId
            ),
            response.decision
          ];

          return {
            ...current,
            recommendations: nextRecommendations,
            decisions: nextDecisions
          };
        });
      }

      setDecisionReasonById((current) => ({
        ...current,
        [recommendationId]: ""
      }));
      setFeedback("Decision recorded.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <article className="panel">
      <header className="panel-header">
        <h2>Recommendations module</h2>
        <p>
          Review provider health, queue visibility, and accept or deny
          recommendation records without mutating graph or planner ownership
          directly.
        </p>
      </header>

      <div className="module-card__topline">
        <span>Module status</span>
        <span className={`status-pill status-pill--${moduleStatus}`}>
          {moduleStatus}
        </span>
      </div>

      <div className="callout">
        <p>
          <strong>Provider health</strong>
        </p>
        <p>{model.providerSummary.message}</p>
        <p>
          Last healthy signal:{" "}
          {model.providerSummary.lastSuccessfulAt ?? "No successful check yet."}
        </p>
      </div>

      <form onSubmit={handleRequestRun} className="spotlight-form">
        <button type="submit" disabled={pendingAction === "run"}>
          {pendingAction === "run" ? "Requesting run..." : "Request manual run"}
        </button>
        <p className="form-hint">
          Demo runs stay inside the recommendation service and only surface queue
          state.
        </p>
      </form>

      {feedback ? <p className="callout">{feedback}</p> : null}
      {error ? <p className="callout callout--error">{error}</p> : null}

      <div className="content-grid">
        <section>
          <div className="panel-header">
            <h3>Review queue</h3>
            <p>
              {loading
                ? "Loading recommendation feed..."
                : `${model.pendingRecommendations.length} pending recommendation(s).`}
            </p>
          </div>
          <div className="health-list">
            {model.pendingRecommendations.length === 0 ? (
              <p className="health-empty">No pending recommendations to review.</p>
            ) : (
              model.pendingRecommendations.map((recommendation) => (
                <article key={recommendation.id} className="module-card">
                  <div className="module-card__topline">
                    <strong>{recommendation.title}</strong>
                    <span className="status-pill status-pill--degraded">
                      {recommendation.status}
                    </span>
                  </div>
                  <p>{recommendation.rationale ?? "No rationale supplied."}</p>
                  <p>
                    Target: {recommendation.target.targetKind} via {recommendation.action}
                  </p>
                  <label className="field-label">
                    Review note
                    <textarea
                      value={decisionReasonById[recommendation.id] ?? ""}
                      onChange={(event) =>
                        setDecisionReasonById((current) => ({
                          ...current,
                          [recommendation.id]: event.target.value
                        }))
                      }
                      rows={3}
                    />
                  </label>
                  <div className="hero-actions">
                    <button
                      type="button"
                      disabled={pendingAction === recommendation.id}
                      onClick={() =>
                        void handleDecision(recommendation.id, "accepted")
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={pendingAction === recommendation.id}
                      onClick={() =>
                        void handleDecision(recommendation.id, "denied")
                      }
                    >
                      Deny
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section>
          <div className="panel-header">
            <h3>Decision visibility</h3>
            <p>
              {model.runSummary.totalRuns} run(s), {model.runSummary.deferredRuns} deferred.
            </p>
          </div>
          <div className="health-list">
            {model.recentDecisions.length === 0 ? (
              <p className="health-empty">No decisions have been recorded yet.</p>
            ) : (
              model.recentDecisions.map((decision) => (
                <article key={decision.recommendationId} className="health-row">
                  <div>
                    <strong>{decision.recommendationId}</strong>
                    <p>{decision.reason ?? "No review note recorded."}</p>
                  </div>
                  <span
                    className={`status-pill status-pill--${
                      decision.decision === "accepted" ? "up" : "down"
                    }`}
                  >
                    {decision.decision}
                  </span>
                </article>
              ))
            )}
            <div className="callout">
              <p>
                <strong>Run queue</strong>
              </p>
              <p>Queued runs: {model.runSummary.queuedRuns}</p>
              <p>Deferred runs: {model.runSummary.deferredRuns}</p>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
