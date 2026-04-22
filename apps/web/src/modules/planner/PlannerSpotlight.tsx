import { useEffect, useState, type FormEvent } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import { PLAN_ITEM_KIND_VALUES, type Goal } from "@pdp-helper/contracts-planner";
import { gatewayUrl } from "../../lib/gateway";
import {
  createPlannerGatewayPort,
  loadPlannerSnapshot,
  type AddEvidenceNoteInput,
  type CreateGoalInput,
  type CreatePlanItemInput
} from "./planner-gateway";
import {
  buildPlannerPanelModel,
  compareGoals,
  EMPTY_PLANNER_SNAPSHOT,
  type PlannerGoalPlan,
  type PlannerSnapshot
} from "./planner-model";

type PendingAction = "goal" | "item" | "evidence" | null;

export interface PlannerSpotlightProps {
  readonly module?: ModuleCapability;
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: PlannerSnapshot;
  readonly selectedGoalId?: Goal["id"];
  readonly onSelectedGoalChange?: (goalId: Goal["id"]) => void;
  readonly onCreateGoal?: (input: CreateGoalInput) => Promise<unknown> | unknown;
  readonly onCreatePlanItem?: (
    input: CreatePlanItemInput
  ) => Promise<unknown> | unknown;
  readonly onAddEvidenceNote?: (
    input: AddEvidenceNoteInput
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load planner data.";
}

function mergeGoalPlan(
  snapshot: PlannerSnapshot,
  goalPlan: PlannerGoalPlan,
  selectedGoalId?: Goal["id"]
): PlannerSnapshot {
  return {
    goals: snapshot.goals,
    plansByGoalId: {
      ...snapshot.plansByGoalId,
      [goalPlan.goal.id]: goalPlan
    },
    selectedGoalId: selectedGoalId ?? snapshot.selectedGoalId
  };
}

export function PlannerSpotlight({
  module,
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  selectedGoalId,
  onSelectedGoalChange,
  onCreateGoal,
  onCreatePlanItem,
  onAddEvidenceNote
}: PlannerSpotlightProps) {
  const [localSnapshot, setLocalSnapshot] = useState<PlannerSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [planLoadingId, setPlanLoadingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalDescription, setGoalDescription] = useState("");
  const [planItemTitle, setPlanItemTitle] = useState("");
  const [planItemKind, setPlanItemKind] = useState<(typeof PLAN_ITEM_KIND_VALUES)[number]>(
    "task"
  );
  const [evidenceBody, setEvidenceBody] = useState("");

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLocalSnapshot(snapshot);
    setLoading(false);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    if (snapshot) {
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);

      try {
        const nextSnapshot = await loadPlannerSnapshot(
          createPlannerGatewayPort(gatewayBaseUrl)
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

  const activeSnapshot = localSnapshot ?? EMPTY_PLANNER_SNAPSHOT;
  const activeSelectedGoalId = selectedGoalId ?? localSnapshot?.selectedGoalId;
  const model = buildPlannerPanelModel(activeSnapshot, {
    selectedGoalId: activeSelectedGoalId
  });
  const selectedGoalIdForActions = activeSelectedGoalId ?? model.selectedGoal?.id;
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ??
    STATUS_STYLES.unknown;

  async function selectGoal(goalId: Goal["id"]) {
    setFeedback(null);
    setError(null);

    onSelectedGoalChange?.(goalId);

    if (selectedGoalId === undefined) {
      setLocalSnapshot((current) =>
        current
          ? {
              ...current,
              selectedGoalId: goalId
            }
          : current
      );
    }

    if (activeSnapshot.plansByGoalId[goalId]) {
      return;
    }

    setPlanLoadingId(goalId);

    try {
      const goalPlan = await createPlannerGatewayPort(gatewayBaseUrl).getGoalPlan(goalId);

      setLocalSnapshot((current) =>
        mergeGoalPlan(
          current ?? EMPTY_PLANNER_SNAPSHOT,
          goalPlan,
          selectedGoalId === undefined ? goalId : current?.selectedGoalId
        )
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPlanLoadingId(null);
    }
  }

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = goalTitle.trim();
    const description = goalDescription.trim();

    if (!title) {
      return;
    }

    setPendingAction("goal");
    setFeedback(null);
    setError(null);

    try {
      if (onCreateGoal) {
        await onCreateGoal({
          title,
          ...(description ? { description } : {})
        });
      } else {
        const response = await createPlannerGatewayPort(gatewayBaseUrl).createGoal({
          title,
          ...(description ? { description } : {})
        });
        const nextGoal = response.goal;

        if (nextGoal) {
          setLocalSnapshot((current) => {
            const baseSnapshot = current ?? EMPTY_PLANNER_SNAPSHOT;

            return {
              goals: [...baseSnapshot.goals, nextGoal].sort(compareGoals),
              plansByGoalId: baseSnapshot.plansByGoalId,
              selectedGoalId:
                selectedGoalId === undefined
                  ? nextGoal.id
                  : baseSnapshot.selectedGoalId
            };
          });
        }
      }

      setGoalTitle("");
      setGoalDescription("");
      setFeedback(`Goal "${title}" is ready for breakdown.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreatePlanItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const title = planItemTitle.trim();
    const goalId = selectedGoalIdForActions;

    if (!title || !goalId) {
      return;
    }

    setPendingAction("item");
    setFeedback(null);
    setError(null);

    try {
      const input: CreatePlanItemInput = {
        goalId,
        title,
        kind: planItemKind
      };

      if (onCreatePlanItem) {
        await onCreatePlanItem(input);
      } else {
        const gateway = createPlannerGatewayPort(gatewayBaseUrl);
        const response = await gateway.createPlanItem(input);
        const nextPlanItem = response.planItem;

        if (nextPlanItem) {
          setLocalSnapshot((current) => {
            if (!current) {
              return current;
            }

            const currentPlan = current.plansByGoalId[goalId];

            if (!currentPlan) {
              return current;
            }

            return mergeGoalPlan(
              current,
              {
                ...currentPlan,
                planItems: [...currentPlan.planItems, nextPlanItem]
              },
              selectedGoalId === undefined ? goalId : current.selectedGoalId
            );
          });
        } else {
          const goalPlan = await gateway.getGoalPlan(goalId);

          setLocalSnapshot((current) =>
            mergeGoalPlan(
              current ?? EMPTY_PLANNER_SNAPSHOT,
              goalPlan,
              selectedGoalId === undefined ? goalId : current?.selectedGoalId
            )
          );
        }
      }

      setPlanItemTitle("");
      setFeedback(`Added "${title}" to the selected goal.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddEvidenceNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = evidenceBody.trim();
    const goalId = selectedGoalIdForActions;

    if (!body || !goalId) {
      return;
    }

    setPendingAction("evidence");
    setFeedback(null);
    setError(null);

    try {
      const input: AddEvidenceNoteInput = {
        goalId,
        body
      };

      if (onAddEvidenceNote) {
        await onAddEvidenceNote(input);
      } else {
        const gateway = createPlannerGatewayPort(gatewayBaseUrl);
        const response = await gateway.addEvidenceNote(input);
        const nextEvidenceNote = response.evidenceNote;

        if (nextEvidenceNote) {
          setLocalSnapshot((current) => {
            if (!current) {
              return current;
            }

            const currentPlan = current.plansByGoalId[goalId];

            if (!currentPlan) {
              return current;
            }

            return mergeGoalPlan(
              current,
              {
                ...currentPlan,
                evidenceNotes: [...currentPlan.evidenceNotes, nextEvidenceNote]
              },
              selectedGoalId === undefined ? goalId : current.selectedGoalId
            );
          });
        } else {
          const goalPlan = await gateway.getGoalPlan(goalId);

          setLocalSnapshot((current) =>
            mergeGoalPlan(
              current ?? EMPTY_PLANNER_SNAPSHOT,
              goalPlan,
              selectedGoalId === undefined ? goalId : current?.selectedGoalId
            )
          );
        }
      }

      setEvidenceBody("");
      setFeedback("Evidence note added to the selected goal.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
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
            <h2>Planner module</h2>
            <p>
              Goals, plan items, and evidence notes now have a real demo flow
              through the gateway and planner service.
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

      <div
        style={{
          display: "grid",
          gap: "1rem"
        }}
      >
        <section
          style={{
            display: "grid",
            gap: "0.85rem"
          }}
        >
          <div>
            <strong>Goals</strong>
            <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
              Select a goal to inspect its current breakdown and evidence trail.
            </p>
          </div>

          {loading ? <p className="callout">Loading planner data from the gateway.</p> : null}
          {error ? <p className="callout callout--error">{error}</p> : null}
          {feedback ? <p className="callout">{feedback}</p> : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
              gap: "0.75rem"
            }}
          >
            {model.goalSummaries.length === 0 ? (
              <article
                style={{
                  border: "1px dashed #d6d3d1",
                  borderRadius: "1rem",
                  padding: "1rem",
                  background: "#fafaf9"
                }}
              >
                <strong>No goals yet.</strong>
                <p style={{ margin: "0.5rem 0 0", color: "#57534e" }}>
                  Create the first plan below.
                </p>
              </article>
            ) : (
              model.goalSummaries.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => void selectGoal(goal.id)}
                  style={{
                    textAlign: "left",
                    border: goal.isSelected
                      ? "1px solid #1d4ed8"
                      : "1px solid #d6d3d1",
                    background: goal.isSelected ? "#eff6ff" : "#ffffff",
                    borderRadius: "1rem",
                    padding: "0.95rem",
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.45rem"
                  }}
                >
                  <strong>{goal.title}</strong>
                  <span style={{ color: "#57534e", fontSize: "0.92rem" }}>
                    {goal.status}
                    {goal.targetDate ? ` • target ${goal.targetDate}` : ""}
                  </span>
                  <span style={{ color: "#1d4ed8", fontSize: "0.9rem" }}>
                    {goal.planLoaded
                      ? `${goal.planItemCount} plan items • ${goal.evidenceNoteCount} notes`
                      : "Breakdown loads on selection"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
            alignItems: "start"
          }}
        >
          <article
            style={{
              border: "1px solid #e7e5e4",
              borderRadius: "1rem",
              padding: "1rem",
              background: "#fafaf9",
              display: "grid",
              gap: "0.9rem"
            }}
          >
            <div>
              <strong>Selected goal</strong>
              <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
                Current plan items and evidence for the active goal.
              </p>
            </div>

            {model.selectedGoal ? (
              <>
                <div>
                  <strong>{model.selectedGoal.title}</strong>
                  <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
                    {model.selectedGoal.status}
                    {model.selectedGoal.targetDate
                      ? ` • target ${model.selectedGoal.targetDate}`
                      : ""}
                  </p>
                  {model.selectedGoal.description ? (
                    <p style={{ margin: "0.5rem 0 0", color: "#44403c" }}>
                      {model.selectedGoal.description}
                    </p>
                  ) : null}
                </div>

                {planLoadingId === model.selectedGoal.id ? (
                  <p className="callout">Refreshing the selected goal plan.</p>
                ) : null}

                <div
                  style={{
                    display: "grid",
                    gap: "0.55rem"
                  }}
                >
                  <strong>Plan items</strong>
                  {model.selectedGoal.planLoaded ? (
                    model.selectedGoal.planItems.length === 0 ? (
                      <p style={{ margin: 0, color: "#57534e" }}>
                        No plan items yet for this goal.
                      </p>
                    ) : (
                      model.selectedGoal.planItems.map((planItem) => (
                        <article
                          key={planItem.id}
                          style={{
                            border: "1px solid #d6d3d1",
                            borderRadius: "0.85rem",
                            padding: "0.8rem",
                            background: "#ffffff",
                            display: "grid",
                            gap: "0.25rem"
                          }}
                        >
                          <strong>{planItem.title}</strong>
                          <span style={{ color: "#57534e", fontSize: "0.92rem" }}>
                            {planItem.kind} • {planItem.status}
                          </span>
                          <span style={{ color: "#44403c", fontSize: "0.88rem" }}>
                            Visibility: {planItem.skillGraphVisibility}
                            {planItem.dueDate ? ` • due ${planItem.dueDate}` : ""}
                          </span>
                        </article>
                      ))
                    )
                  ) : (
                    <p style={{ margin: 0, color: "#57534e" }}>
                      Select this goal to load its current breakdown.
                    </p>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gap: "0.55rem"
                  }}
                >
                  <strong>Evidence notes</strong>
                  {model.selectedGoal.planLoaded ? (
                    model.selectedGoal.evidenceNotes.length === 0 ? (
                      <p style={{ margin: 0, color: "#57534e" }}>
                        No evidence notes yet for this goal.
                      </p>
                    ) : (
                      model.selectedGoal.evidenceNotes.map((note) => (
                        <article
                          key={note.id}
                          style={{
                            border: "1px solid #e7e5e4",
                            borderRadius: "0.75rem",
                            padding: "0.75rem 0.85rem",
                            background: "#ffffff",
                            display: "grid",
                            gap: "0.25rem"
                          }}
                        >
                          <span>{note.body}</span>
                          <span style={{ color: "#57534e", fontSize: "0.88rem" }}>
                            {note.planItemTitle
                              ? `Linked to ${note.planItemTitle}`
                              : "Linked to the goal"}
                            {note.attachmentCount > 0
                              ? ` • ${note.attachmentCount} attachment(s)`
                              : ""}
                          </span>
                        </article>
                      ))
                    )
                  ) : (
                    <p style={{ margin: 0, color: "#57534e" }}>
                      Select this goal to load evidence history.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: "#57534e" }}>
                No goal is available yet.
              </p>
            )}
          </article>

          <div
            style={{
              display: "grid",
              gap: "1rem"
            }}
          >
            <article
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: "1rem",
                padding: "1rem",
                background: "#ffffff"
              }}
            >
              <strong>Create goal</strong>
              <form
                onSubmit={(event) => void handleCreateGoal(event)}
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.85rem"
                }}
              >
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Goal title</span>
                  <input
                    value={goalTitle}
                    onChange={(event) => setGoalTitle(event.target.value)}
                    placeholder="Earn CKA certification"
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Description</span>
                  <textarea
                    value={goalDescription}
                    onChange={(event) => setGoalDescription(event.target.value)}
                    placeholder="Break this down into weekly labs and practice exams."
                    rows={3}
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem",
                      resize: "vertical"
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={pendingAction === "goal"}
                  style={{
                    border: "1px solid #0f766e",
                    background: "#0f766e",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.85rem",
                    cursor: pendingAction === "goal" ? "wait" : "pointer"
                  }}
                >
                  {pendingAction === "goal" ? "Creating goal..." : "Create goal"}
                </button>
              </form>
            </article>

            <article
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: "1rem",
                padding: "1rem",
                background: "#ffffff"
              }}
            >
              <strong>Add plan item</strong>
              <form
                onSubmit={(event) => void handleCreatePlanItem(event)}
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.85rem"
                }}
              >
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Selected goal</span>
                  <input
                    value={model.selectedGoal?.title ?? "No goal selected"}
                    readOnly
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem",
                      background: "#fafaf9"
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Plan item title</span>
                  <input
                    value={planItemTitle}
                    onChange={(event) => setPlanItemTitle(event.target.value)}
                    placeholder="Practice troubleshooting labs"
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Kind</span>
                  <select
                    value={planItemKind}
                    onChange={(event) =>
                      setPlanItemKind(
                        event.target.value as (typeof PLAN_ITEM_KIND_VALUES)[number]
                      )
                    }
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  >
                    {PLAN_ITEM_KIND_VALUES.map((kind: (typeof PLAN_ITEM_KIND_VALUES)[number]) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={pendingAction === "item" || !selectedGoalIdForActions}
                  style={{
                    border: "1px solid #1d4ed8",
                    background: "#1d4ed8",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.85rem",
                    cursor:
                      pendingAction === "item" || !selectedGoalIdForActions
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      pendingAction === "item" || !selectedGoalIdForActions ? 0.7 : 1
                  }}
                >
                  {pendingAction === "item" ? "Creating item..." : "Add plan item"}
                </button>
              </form>
            </article>

            <article
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: "1rem",
                padding: "1rem",
                background: "#ffffff"
              }}
            >
              <strong>Add evidence note</strong>
              <form
                onSubmit={(event) => void handleAddEvidenceNote(event)}
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.85rem"
                }}
              >
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Evidence note</span>
                  <textarea
                    value={evidenceBody}
                    onChange={(event) => setEvidenceBody(event.target.value)}
                    placeholder="Completed the first lab and captured the gotchas."
                    rows={3}
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem",
                      resize: "vertical"
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={pendingAction === "evidence" || !selectedGoalIdForActions}
                  style={{
                    border: "1px solid #7c3aed",
                    background: "#7c3aed",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.85rem",
                    cursor:
                      pendingAction === "evidence" || !selectedGoalIdForActions
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      pendingAction === "evidence" || !selectedGoalIdForActions
                        ? 0.7
                        : 1
                  }}
                >
                  {pendingAction === "evidence"
                    ? "Saving note..."
                    : "Add evidence note"}
                </button>
              </form>
            </article>
          </div>
        </section>
      </div>
    </article>
  );
}
