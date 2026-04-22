import { useEffect, useState, type FormEvent } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import { gatewayUrl } from "../../lib/gateway";
import {
  createBrainstormGatewayPort,
  loadBrainstormSnapshot,
  type CreateBrainstormCanvasInput,
  type CreateBrainstormNodeInput
} from "./brainstorm-gateway";
import {
  buildBrainstormPanelModel,
  compareCanvases,
  EMPTY_BRAINSTORM_SNAPSHOT,
  type BrainstormCanvasGraph,
  type BrainstormSnapshot
} from "./brainstorm-model";
import {
  USER_NODE_CATEGORIES,
  type BrainstormCanvas
} from "./brainstorm-types";

type PendingAction = "canvas" | "node" | null;

export interface BrainstormSpotlightProps {
  readonly module?: ModuleCapability;
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: BrainstormSnapshot;
  readonly selectedCanvasId?: BrainstormCanvas["id"];
  readonly canvasHrefBuilder?: (canvas: BrainstormCanvas) => string | undefined;
  readonly onSelectedCanvasChange?: (canvasId: BrainstormCanvas["id"]) => void;
  readonly onCreateCanvas?: (
    input: CreateBrainstormCanvasInput
  ) => Promise<unknown> | unknown;
  readonly onCreateNode?: (
    input: CreateBrainstormNodeInput
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

const COLOR_SURFACES: Readonly<Record<string, string>> = {
  amber: "#fef3c7",
  blue: "#dbeafe",
  emerald: "#d1fae5",
  lime: "#ecfccb",
  rose: "#ffe4e6",
  slate: "#e2e8f0",
  stone: "#e7e5e4",
  teal: "#ccfbf1"
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load brainstorm data.";
}

function mergeCanvasGraph(
  snapshot: BrainstormSnapshot,
  canvasGraph: BrainstormCanvasGraph,
  selectedCanvasId?: BrainstormCanvas["id"]
): BrainstormSnapshot {
  return {
    canvases: snapshot.canvases,
    graphsByCanvasId: {
      ...snapshot.graphsByCanvasId,
      [canvasGraph.canvas.id]: canvasGraph
    },
    selectedCanvasId: selectedCanvasId ?? snapshot.selectedCanvasId
  };
}

export function BrainstormSpotlight({
  module,
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  selectedCanvasId,
  canvasHrefBuilder,
  onSelectedCanvasChange,
  onCreateCanvas,
  onCreateNode
}: BrainstormSpotlightProps) {
  const [localSnapshot, setLocalSnapshot] = useState<BrainstormSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [graphLoadingId, setGraphLoadingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [canvasName, setCanvasName] = useState("");
  const [nodeLabel, setNodeLabel] = useState("");
  const [nodeCategory, setNodeCategory] = useState<
    (typeof USER_NODE_CATEGORIES)[number]
  >("skill");

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
        const nextSnapshot = await loadBrainstormSnapshot(
          createBrainstormGatewayPort(gatewayBaseUrl)
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

  const activeSnapshot = localSnapshot ?? EMPTY_BRAINSTORM_SNAPSHOT;
  const activeSelectedCanvasId =
    selectedCanvasId ?? localSnapshot?.selectedCanvasId;
  const model = buildBrainstormPanelModel(activeSnapshot, {
    selectedCanvasId: activeSelectedCanvasId,
    canvasHrefBuilder
  });
  const selectedCanvasIdForActions =
    activeSelectedCanvasId ?? model.selectedCanvas?.id;
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ??
    STATUS_STYLES.unknown;

  async function selectCanvas(canvasId: BrainstormCanvas["id"]) {
    setFeedback(null);
    setError(null);

    onSelectedCanvasChange?.(canvasId);

    if (selectedCanvasId === undefined) {
      setLocalSnapshot((current) =>
        current
          ? {
              ...current,
              selectedCanvasId: canvasId
            }
          : current
      );
    }

    if (activeSnapshot.graphsByCanvasId[canvasId]) {
      return;
    }

    setGraphLoadingId(canvasId);

    try {
      const canvasGraph = await createBrainstormGatewayPort(
        gatewayBaseUrl
      ).getCanvasGraph(canvasId);

      setLocalSnapshot((current) =>
        mergeCanvasGraph(
          current ?? EMPTY_BRAINSTORM_SNAPSHOT,
          canvasGraph,
          selectedCanvasId === undefined ? canvasId : current?.selectedCanvasId
        )
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setGraphLoadingId(null);
    }
  }

  async function handleCreateCanvas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = canvasName.trim();

    if (!name) {
      return;
    }

    setPendingAction("canvas");
    setFeedback(null);
    setError(null);

    try {
      if (onCreateCanvas) {
        await onCreateCanvas({
          name,
          mode: "brainstorm"
        });
      } else {
        const response = await createBrainstormGatewayPort(
          gatewayBaseUrl
        ).createCanvas({
          name,
          mode: "brainstorm"
        });

        if (response.canvas) {
          const nextCanvas = response.canvas;

          setLocalSnapshot((current) => {
            const baseSnapshot = current ?? EMPTY_BRAINSTORM_SNAPSHOT;

            return {
              canvases: [...baseSnapshot.canvases, nextCanvas].sort(compareCanvases),
              graphsByCanvasId: baseSnapshot.graphsByCanvasId,
              selectedCanvasId:
                selectedCanvasId === undefined
                  ? nextCanvas.id
                  : baseSnapshot.selectedCanvasId
            };
          });
        }
      }

      setCanvasName("");
      setFeedback(`Canvas "${name}" is ready for the next shell handoff.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = nodeLabel.trim();
    const canvasId = selectedCanvasIdForActions;

    if (!label || !canvasId) {
      return;
    }

    setPendingAction("node");
    setFeedback(null);
    setError(null);

    try {
      const input = {
        canvasId,
        label,
        category: nodeCategory,
        role: "brainstorm" as const,
        source: "user" as const,
        position: {
          x: 0,
          y: 0
        }
      };

      if (onCreateNode) {
        await onCreateNode(input);
      } else {
        const gateway = createBrainstormGatewayPort(gatewayBaseUrl);
        const response = await gateway.createNode(input);

        if (response.node) {
          const nextNode = response.node;

          setLocalSnapshot((current) => {
            if (!current) {
              return current;
            }

            const currentCanvasGraph = current.graphsByCanvasId[canvasId];

            if (!currentCanvasGraph) {
              return current;
            }

            return mergeCanvasGraph(
              current,
              {
                ...currentCanvasGraph,
                nodes: [...currentCanvasGraph.nodes, nextNode]
              },
              selectedCanvasId === undefined ? canvasId : current.selectedCanvasId
            );
          });
        } else {
          const canvasGraph = await gateway.getCanvasGraph(canvasId);

          setLocalSnapshot((current) =>
            mergeCanvasGraph(
              current ?? EMPTY_BRAINSTORM_SNAPSHOT,
              canvasGraph,
              selectedCanvasId === undefined ? canvasId : current?.selectedCanvasId
            )
          );
        }
      }

      setNodeLabel("");
      setFeedback(`Added "${label}" to the selected canvas.`);
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
            <h2>Brainstorm module</h2>
            <p>
              Gateway-backed canvases, graph previews, and lightweight creation
              helpers now live in this module instead of a placeholder panel.
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
            <strong>Brainstorm canvases</strong>
            <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
              Select a canvas to inspect its graph, or let the shell inject its own
              selection and deep links later.
            </p>
          </div>

          {loading ? (
            <p className="callout">Loading canvases from the gateway graph proxy.</p>
          ) : null}

          {error ? <p className="callout callout--error">{error}</p> : null}
          {feedback ? <p className="callout">{feedback}</p> : null}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
              gap: "0.75rem"
            }}
          >
            {model.canvasSummaries.length === 0 ? (
              <article
                style={{
                  border: "1px dashed #d6d3d1",
                  borderRadius: "1rem",
                  padding: "1rem",
                  background: "#fafaf9"
                }}
              >
                <strong>No brainstorm canvases yet.</strong>
                <p style={{ margin: "0.5rem 0 0", color: "#57534e" }}>
                  Create the first demo canvas below.
                </p>
              </article>
            ) : (
              model.canvasSummaries.map((canvas) => (
                <button
                  key={canvas.id}
                  type="button"
                  onClick={() => void selectCanvas(canvas.id)}
                  style={{
                    textAlign: "left",
                    border: canvas.isSelected
                      ? "1px solid #0f766e"
                      : "1px solid #d6d3d1",
                    background: canvas.isSelected ? "#f0fdfa" : "#ffffff",
                    borderRadius: "1rem",
                    padding: "0.95rem",
                    cursor: "pointer",
                    display: "grid",
                    gap: "0.45rem"
                  }}
                >
                  <strong>{canvas.name}</strong>
                  <span style={{ color: "#57534e", fontSize: "0.92rem" }}>
                    {canvas.graphLoaded
                      ? `${canvas.nodeCount} nodes • ${canvas.edgeCount} links`
                      : "Preview loads on selection"}
                  </span>
                  <span style={{ color: "#0f766e", fontSize: "0.9rem" }}>
                    {canvas.href ?? "Module-managed preview"}
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
              gap: "0.8rem"
            }}
          >
            <div>
              <strong>Canvas preview</strong>
              <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
                Structured graph detail for the first demo slice.
              </p>
            </div>

            {model.selectedCanvas ? (
              <>
                <div
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    flexWrap: "wrap"
                  }}
                >
                  <div>
                    <strong>{model.selectedCanvas.name}</strong>
                    <p style={{ margin: "0.35rem 0 0", color: "#57534e" }}>
                      {model.selectedCanvas.graphLoaded
                        ? `${model.selectedCanvas.nodeCount} nodes and ${model.selectedCanvas.edgeCount} relationships`
                        : "Select this canvas to load its graph preview."}
                    </p>
                  </div>
                  {model.selectedCanvas.href ? (
                    <a href={model.selectedCanvas.href}>{model.selectedCanvas.href}</a>
                  ) : null}
                </div>

                {graphLoadingId === model.selectedCanvas.id ? (
                  <p className="callout">Refreshing the selected canvas graph.</p>
                ) : null}

                {model.selectedCanvas.graphLoaded ? (
                  <>
                    <div
                      style={{
                        display: "grid",
                        gap: "0.7rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))"
                      }}
                    >
                      {model.selectedCanvas.nodes.map((node) => (
                        <article
                          key={node.id}
                          style={{
                            border: "1px solid #d6d3d1",
                            borderRadius: "0.9rem",
                            padding: "0.85rem",
                            background:
                              COLOR_SURFACES[node.colorToken] ?? COLOR_SURFACES.slate,
                            display: "grid",
                            gap: "0.35rem"
                          }}
                        >
                          <strong>{node.label}</strong>
                          <span style={{ color: "#57534e", fontSize: "0.9rem" }}>
                            {node.category}
                            {node.parentLabel ? ` • child of ${node.parentLabel}` : ""}
                          </span>
                          <span style={{ color: "#44403c", fontSize: "0.88rem" }}>
                            Position {node.positionLabel}
                          </span>
                          <span style={{ color: "#44403c", fontSize: "0.88rem" }}>
                            {node.incomingCount} incoming • {node.outgoingCount} outgoing
                          </span>
                        </article>
                      ))}
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: "0.5rem"
                      }}
                    >
                      <strong>Relationships</strong>
                      {model.selectedCanvas.relationships.length === 0 ? (
                        <p style={{ margin: 0, color: "#57534e" }}>
                          No explicit relationships have been added yet.
                        </p>
                      ) : (
                        model.selectedCanvas.relationships.map((relationship) => (
                          <article
                            key={relationship.id}
                            style={{
                              border: "1px solid #e7e5e4",
                              borderRadius: "0.75rem",
                              padding: "0.7rem 0.85rem",
                              background: "#ffffff"
                            }}
                          >
                            <strong>{relationship.sourceLabel}</strong>
                            <span style={{ color: "#57534e" }}>
                              {" "}
                              {relationship.relationship}{" "}
                            </span>
                            <strong>{relationship.targetLabel}</strong>
                          </article>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, color: "#57534e" }}>
                    The canvas exists, but its graph detail has not been fetched into the
                    module yet.
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, color: "#57534e" }}>
                No brainstorm canvas is available yet.
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
              <strong>Create canvas</strong>
              <form
                onSubmit={(event) => void handleCreateCanvas(event)}
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.85rem"
                }}
              >
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Canvas name</span>
                  <input
                    value={canvasName}
                    onChange={(event) => setCanvasName(event.target.value)}
                    placeholder="Career themes"
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  />
                </label>
                <button
                  type="submit"
                  disabled={pendingAction === "canvas"}
                  style={{
                    border: "1px solid #0f766e",
                    background: "#0f766e",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.85rem",
                    cursor: pendingAction === "canvas" ? "wait" : "pointer"
                  }}
                >
                  {pendingAction === "canvas" ? "Creating canvas..." : "Create canvas"}
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
              <strong>Create node</strong>
              <form
                onSubmit={(event) => void handleCreateNode(event)}
                style={{
                  display: "grid",
                  gap: "0.65rem",
                  marginTop: "0.85rem"
                }}
              >
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Selected canvas</span>
                  <input
                    value={model.selectedCanvas?.name ?? "No canvas selected"}
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
                  <span>Node label</span>
                  <input
                    value={nodeLabel}
                    onChange={(event) => setNodeLabel(event.target.value)}
                    placeholder="Event-driven design"
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: "0.35rem" }}>
                  <span>Category</span>
                  <select
                    value={nodeCategory}
                    onChange={(event) =>
                      setNodeCategory(
                        event.target.value as (typeof USER_NODE_CATEGORIES)[number]
                      )
                    }
                    style={{
                      border: "1px solid #d6d3d1",
                      borderRadius: "0.75rem",
                      padding: "0.7rem 0.85rem"
                    }}
                  >
                    {USER_NODE_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={pendingAction === "node" || !selectedCanvasIdForActions}
                  style={{
                    border: "1px solid #1d4ed8",
                    background: "#1d4ed8",
                    color: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "0.7rem 0.85rem",
                    cursor:
                      pendingAction === "node" || !selectedCanvasIdForActions
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      pendingAction === "node" || !selectedCanvasIdForActions ? 0.7 : 1
                  }}
                >
                  {pendingAction === "node" ? "Creating node..." : "Create node"}
                </button>
              </form>
            </article>
          </div>
        </section>
      </div>
    </article>
  );
}
