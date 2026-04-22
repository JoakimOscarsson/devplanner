import { useEffect, useState } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import type { GoalProgressProjection } from "@pdp-helper/contracts-tracker";
import { gatewayUrl } from "../../lib/gateway";
import { createTrackerGatewayPort, loadTrackerSnapshot } from "./tracker-gateway";
import {
  buildTrackerPanelModel,
  EMPTY_TRACKER_SNAPSHOT,
  type TrackerSnapshot
} from "./tracker-model";

export type { TrackerSnapshot } from "./tracker-model";

export interface TrackerSpotlightProps {
  readonly module?: ModuleCapability;
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: TrackerSnapshot;
  readonly selectedGoalId?: GoalProgressProjection["goalId"];
  readonly feedback?: string | null;
  readonly onSelectedGoalChange?: (
    goalId: GoalProgressProjection["goalId"]
  ) => Promise<unknown> | unknown;
}

const STATUS_STYLES = {
  up: {
    background: "#ecfdf5",
    borderColor: "#86efac",
    color: "#166534"
  },
  degraded: {
    background: "#fff7ed",
    borderColor: "#fdba74",
    color: "#9a3412"
  },
  down: {
    background: "#fef2f2",
    borderColor: "#fca5a5",
    color: "#991b1b"
  },
  unknown: {
    background: "#f5f5f4",
    borderColor: "#d6d3d1",
    color: "#44403c"
  }
} as const;

const LAG_STYLES = {
  current: {
    background: "#ecfdf5",
    borderColor: "#86efac",
    color: "#166534"
  },
  stale: {
    background: "#fff7ed",
    borderColor: "#fdba74",
    color: "#9a3412"
  },
  rebuilding: {
    background: "#eff6ff",
    borderColor: "#93c5fd",
    color: "#1d4ed8"
  },
  failed: {
    background: "#fef2f2",
    borderColor: "#fca5a5",
    color: "#991b1b"
  },
  none: {
    background: "#f5f5f4",
    borderColor: "#d6d3d1",
    color: "#44403c"
  }
} as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load tracker data.";
}

export function TrackerSpotlight({
  module,
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  selectedGoalId,
  feedback,
  onSelectedGoalChange
}: TrackerSpotlightProps) {
  const [localSnapshot, setLocalSnapshot] = useState<TrackerSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [inlineFeedback, setInlineFeedback] = useState<string | null>(feedback ?? null);
  const [loadingGoalId, setLoadingGoalId] = useState<string | null>(null);

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLocalSnapshot(snapshot);
    setLoading(false);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    setInlineFeedback(feedback ?? null);
  }, [feedback]);

  useEffect(() => {
    if (snapshot) {
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);

      try {
        const nextSnapshot = await loadTrackerSnapshot(
          createTrackerGatewayPort(gatewayBaseUrl),
          {
            selectedGoalId
          }
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
  }, [gatewayBaseUrl, selectedGoalId, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_TRACKER_SNAPSHOT;
  const model = buildTrackerPanelModel(activeSnapshot);
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.unknown;
  const lagStyle =
    LAG_STYLES[model.lagMetrics.statusTone as keyof typeof LAG_STYLES] ?? LAG_STYLES.none;

  async function selectGoal(goalId: GoalProgressProjection["goalId"]) {
    setInlineFeedback(null);
    setError(null);

    onSelectedGoalChange?.(goalId);

    setLoadingGoalId(goalId);

    try {
      const gateway = createTrackerGatewayPort(gatewayBaseUrl);
      const selectedGoalProjection = await gateway.getGoalProjection(goalId);

      setLocalSnapshot((current) => ({
        overview: current?.overview,
        goalSummaries: current?.goalSummaries ?? [],
        lag: current?.lag ?? [],
        selectedGoalId: goalId,
        selectedGoalProjection
      }));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoadingGoalId(null);
    }
  }

  return (
    <article className="panel">
      <header className="panel-header">
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap"
          }}
        >
          <div style={{ maxWidth: "42rem" }}>
            <h2>Tracker module</h2>
            <p>
              Projection-based views, lag visibility, and selected goal rollups stay
              read-only and tracker-owned.
            </p>
          </div>
          <div
            style={{
              border: `1px solid ${statusStyle.borderColor}`,
              background: statusStyle.background,
              color: statusStyle.color,
              borderRadius: "999px",
              padding: "0.4rem 0.85rem",
              fontSize: "0.9rem",
              fontWeight: 600
            }}
          >
            Status: {moduleStatus}
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gap: "1rem" }}>
        {loading ? <p className="callout">Loading tracker projections from the gateway.</p> : null}
        {error ? <p className="callout callout--error">{error}</p> : null}
        {inlineFeedback ? <p className="callout">{inlineFeedback}</p> : null}

        <section
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))"
          }}
        >
          <article
            style={{
              border: "1px solid #e7e5e4",
              borderRadius: "1rem",
              padding: "1rem",
              background: "#fafaf9"
            }}
          >
            <strong>Workspace overview</strong>
            <p style={{ margin: "0.5rem 0 0", color: "#57534e" }}>
              {model.overviewMetrics.activeGoalCountLabel} active goals
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "#44403c" }}>
              {model.overviewMetrics.completionPercentLabel} complete across tracked plan
              items
            </p>
            <p style={{ margin: "0.35rem 0 0", color: "#44403c" }}>
              {model.overviewMetrics.overdueGoalCountLabel} overdue goal
              {model.overviewMetrics.overdueGoalCountLabel === "1" ? "" : "s"}
            </p>
          </article>

          <article
            style={{
              border: `1px solid ${lagStyle.borderColor}`,
              borderRadius: "1rem",
              padding: "1rem",
              background: lagStyle.background,
              color: lagStyle.color
            }}
          >
            <strong>Projection lag</strong>
            <p style={{ margin: "0.5rem 0 0" }}>Max lag: {model.lagMetrics.maxLagLabel}</p>
            <p style={{ margin: "0.35rem 0 0" }}>{model.lagMetrics.summaryLabel}</p>
          </article>
        </section>

        <section style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <strong>Goal projections</strong>
            <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
              Select a tracked goal to inspect its projection health and workspace context.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
              gap: "0.75rem"
            }}
          >
            {model.goalCards.length === 0 ? (
              <article
                style={{
                  border: "1px dashed #d6d3d1",
                  borderRadius: "1rem",
                  padding: "1rem",
                  background: "#fafaf9"
                }}
              >
                <strong>No tracker projections yet.</strong>
                <p style={{ margin: "0.5rem 0 0", color: "#57534e" }}>
                  This module will light up once planner events are flowing.
                </p>
              </article>
            ) : (
              model.goalCards.map((goalCard) => {
                const goalLagStyle =
                  LAG_STYLES[goalCard.statusTone as keyof typeof LAG_STYLES] ?? LAG_STYLES.none;

                return (
                  <button
                    key={goalCard.goalId}
                    type="button"
                    onClick={() => void selectGoal(goalCard.goalId)}
                    style={{
                      textAlign: "left",
                      border: goalCard.isSelected
                        ? `1px solid ${goalLagStyle.borderColor}`
                        : "1px solid #d6d3d1",
                      background: goalCard.isSelected ? goalLagStyle.background : "#ffffff",
                      borderRadius: "1rem",
                      padding: "0.95rem",
                      cursor: "pointer",
                      display: "grid",
                      gap: "0.4rem"
                    }}
                  >
                    <strong>{goalCard.title}</strong>
                    <span style={{ color: "#57534e", fontSize: "0.92rem" }}>
                      {goalCard.status} • {goalCard.completionPercentLabel}
                    </span>
                    <span style={{ color: "#44403c", fontSize: "0.88rem" }}>
                      {goalCard.progressLabel}
                    </span>
                    <span style={{ color: goalLagStyle.color, fontSize: "0.88rem" }}>
                      {goalCard.hiddenSkillLabel}
                    </span>
                    {loadingGoalId === goalCard.goalId ? (
                      <span style={{ color: "#1d4ed8", fontSize: "0.88rem" }}>
                        Refreshing projection...
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section
          style={{
            border: "1px solid #e7e5e4",
            borderRadius: "1rem",
            padding: "1rem",
            background: "#fafaf9",
            display: "grid",
            gap: "0.75rem"
          }}
        >
          <strong>Selected goal projection</strong>
          {model.selectedGoal ? (
            <>
              <div>
                <strong>{model.selectedGoal.title}</strong>
                <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
                  {model.selectedGoal.status} • {model.selectedGoal.completionPercentLabel}
                </p>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
                  gap: "0.75rem"
                }}
              >
                <article
                  style={{
                    border: "1px solid #d6d3d1",
                    borderRadius: "0.85rem",
                    padding: "0.85rem",
                    background: "#ffffff"
                  }}
                >
                  <strong>Task progress</strong>
                  <p style={{ margin: "0.4rem 0 0", color: "#44403c" }}>
                    {model.selectedGoal.taskProgressLabel}
                  </p>
                </article>
                <article
                  style={{
                    border: "1px solid #d6d3d1",
                    borderRadius: "0.85rem",
                    padding: "0.85rem",
                    background: "#ffffff"
                  }}
                >
                  <strong>Milestones</strong>
                  <p style={{ margin: "0.4rem 0 0", color: "#44403c" }}>
                    {model.selectedGoal.milestoneProgressLabel}
                  </p>
                </article>
                <article
                  style={{
                    border: "1px solid #d6d3d1",
                    borderRadius: "0.85rem",
                    padding: "0.85rem",
                    background: "#ffffff"
                  }}
                >
                  <strong>Hidden skill links</strong>
                  <p style={{ margin: "0.4rem 0 0", color: "#44403c" }}>
                    {model.selectedGoal.hiddenSkillLabel}
                  </p>
                </article>
              </div>
              <p style={{ margin: 0, color: "#44403c" }}>{model.selectedGoal.lagLabel}</p>
              <p style={{ margin: 0, color: "#57534e" }}>
                {model.selectedGoal.workspaceContextLabel}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, color: "#57534e" }}>
              Choose a goal projection to inspect the current tracker snapshot.
            </p>
          )}
        </section>
      </div>
    </article>
  );
}
