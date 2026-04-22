import { useEffect, useState } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import type { GoalProgressProjection, ProjectionStatus } from "@pdp-helper/contracts-tracker";
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
  const [lagFilter, setLagFilter] = useState<ProjectionStatus | "all">("all");

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
  const model = buildTrackerPanelModel(activeSnapshot, {
    lagFilter
  });
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
    <article className="panel module-page">
      <header className="panel-header module-page__header">
        <div>
          <p className="section-kicker">Tracking</p>
          <h2>Tracking</h2>
          <p>
            Read-only progress views should help you decide what to do next, not
            force you back into the planner to interpret every number.
          </p>
        </div>
        <div
          className="module-page__status"
          style={{
            borderColor: statusStyle.borderColor,
            background: statusStyle.background,
            color: statusStyle.color
          }}
        >
          Status: {moduleStatus}
        </div>
      </header>

      <div className="module-page__grid module-page__grid--balanced">
        <section className="module-page__content">
          {loading ? <p className="callout">Loading tracker projections from the gateway.</p> : null}
          {error ? <p className="callout callout--error">{error}</p> : null}
          {inlineFeedback ? <p className="callout">{inlineFeedback}</p> : null}

          <div>
            <strong>Workspace overview</strong>
            <p className="module-note">
              The tracker keeps this read-only snapshot separate from planning edits.
            </p>
          </div>

          <div className="stats-grid">
            <article className="stats-card">
              <strong>{model.overviewMetrics.activeGoalCountLabel}</strong>
              <span>Active goals</span>
            </article>
            <article className="stats-card">
              <strong>{model.overviewMetrics.completionPercentLabel}</strong>
              <span>Workspace completion</span>
            </article>
            <article className="stats-card">
              <strong>{model.overviewMetrics.overdueGoalCountLabel}</strong>
              <span>Overdue goals</span>
            </article>
          </div>

          <div className="module-card module-card--stacked">
            <div>
              <strong>Projection lag</strong>
              <p>Keep an eye on staleness before trusting any progress view.</p>
            </div>

            <article
              className="module-inline-card"
              style={{
                borderColor: lagStyle.borderColor,
                background: lagStyle.background,
                color: lagStyle.color
              }}
            >
              <strong>Max lag: {model.lagMetrics.maxLagLabel}</strong>
              <span>{model.lagMetrics.summaryLabel}</span>
            </article>

            <div className="toolbar-cluster toolbar-cluster--compact">
              {(["all", "stale", "current"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  className={lagFilter === option ? "toolbar-button toolbar-button--active" : "toolbar-button"}
                  onClick={() => setLagFilter(option)}
                >
                  {option === "all"
                    ? "All projections"
                    : option === "stale"
                      ? "Stale only"
                      : "Current only"}
                </button>
              ))}
            </div>

            <div className="module-list">
              {model.lagEntries.map((entry) => (
                <article key={entry.projectionName} className="module-list__item">
                  <strong>{entry.projectionName}</strong>
                  <p>{entry.status}</p>
                  <span>{entry.lagLabel}</span>
                </article>
              ))}

              {model.lagEntries.length === 0 ? (
                <div className="module-empty">
                  <strong>No lag entries in this filter.</strong>
                  <p>Switch filters to inspect the full tracker state.</p>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="module-page__content">
          <div className="module-card module-card--stacked">
            <div>
              <strong>Goal focus</strong>
              <p>Select a goal to inspect its tracker-owned projection details.</p>
            </div>

            <div className="module-list">
              {model.goalCards.length === 0 ? (
                <div className="module-empty">
                  <strong>No tracker projections yet.</strong>
                  <p>This page will light up once planner events are flowing.</p>
                </div>
              ) : (
                model.goalCards.map((goalCard) => {
                  const goalLagStyle =
                    LAG_STYLES[goalCard.statusTone as keyof typeof LAG_STYLES] ?? LAG_STYLES.none;

                  return (
                    <button
                      key={goalCard.goalId}
                      type="button"
                      onClick={() => void selectGoal(goalCard.goalId)}
                      className={`module-list__item module-list__item--button${
                        goalCard.isSelected ? " module-list__item--selected" : ""
                      }`}
                      style={{
                        borderColor: goalCard.isSelected
                          ? goalLagStyle.borderColor
                          : undefined,
                        background: goalCard.isSelected
                          ? goalLagStyle.background
                          : undefined
                      }}
                    >
                      <strong>{goalCard.title}</strong>
                      <p>
                        {goalCard.status} • {goalCard.completionPercentLabel}
                      </p>
                      <span>{goalCard.progressLabel}</span>
                      <span>{goalCard.hiddenSkillLabel}</span>
                      {loadingGoalId === goalCard.goalId ? (
                        <span>Refreshing projection…</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="module-card module-card--stacked">
            <div>
              <strong>Selected goal projection</strong>
              <p>Use this as the main decision view for the currently selected goal.</p>
            </div>

            {model.selectedGoal ? (
              <>
                <article className="module-inline-card">
                  <strong>{model.selectedGoal.title}</strong>
                  <span>
                    {model.selectedGoal.status} • {model.selectedGoal.completionPercentLabel}
                  </span>
                </article>

                <div className="stats-grid">
                  <article className="stats-card">
                    <strong>{model.selectedGoal.taskProgressLabel}</strong>
                    <span>Tasks</span>
                  </article>
                  <article className="stats-card">
                    <strong>{model.selectedGoal.milestoneProgressLabel}</strong>
                    <span>Milestones</span>
                  </article>
                  <article className="stats-card">
                    <strong>{model.selectedGoal.hiddenSkillLabel}</strong>
                    <span>Hidden skill links</span>
                  </article>
                </div>

                <p className="module-note">{model.selectedGoal.lagLabel}</p>
                <p className="module-note">{model.selectedGoal.workspaceContextLabel}</p>
              </>
            ) : (
              <div className="module-empty">
                <strong>Choose a goal projection.</strong>
                <p>The detailed progress view will appear here.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </article>
  );
}
