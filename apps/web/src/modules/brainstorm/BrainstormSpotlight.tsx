import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import { toGraphCanvasViewModel, type GraphNodeViewModel } from "@pdp-helper/ui-graph";
import { GraphCanvasSurface } from "../../lib/GraphCanvasSurface";
import { gatewayUrl } from "../../lib/gateway";
import {
  createDraftNodePosition,
  getShortcutHintRows,
  moveGraphNodePosition
} from "../../lib/graph-canvas-helpers";
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
  type BrainstormCanvas,
  type BrainstormNode
} from "./brainstorm-types";

type PendingAction = "canvas" | "node" | "mutation" | null;
type DraftRelationship = "root" | "child" | "sibling";

interface DragState {
  readonly canvasId: BrainstormCanvas["id"];
  readonly nodeId: BrainstormNode["id"];
  readonly originX: number;
  readonly originY: number;
  readonly pointerStartX: number;
  readonly pointerStartY: number;
}

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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load brainstorm data.";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
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

function replaceNodeInGraph(
  snapshot: BrainstormSnapshot,
  canvasId: BrainstormCanvas["id"],
  nextNode: BrainstormNode
) {
  const graph = snapshot.graphsByCanvasId[canvasId];

  if (!graph) {
    return snapshot;
  }

  return mergeCanvasGraph(snapshot, {
    ...graph,
    nodes: graph.nodes.map((node) => (node.id === nextNode.id ? nextNode : node))
  });
}

function removeNodeFromGraph(
  snapshot: BrainstormSnapshot,
  canvasId: BrainstormCanvas["id"],
  nodeId: BrainstormNode["id"]
) {
  const graph = snapshot.graphsByCanvasId[canvasId];

  if (!graph) {
    return snapshot;
  }

  return mergeCanvasGraph(snapshot, {
    ...graph,
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
    )
  });
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
  const gateway = useMemo(
    () => createBrainstormGatewayPort(gatewayBaseUrl),
    [gatewayBaseUrl]
  );
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
  const [selectedNodeId, setSelectedNodeId] = useState<BrainstormNode["id"] | null>(null);
  const [reparentMode, setReparentMode] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<BrainstormNode["id"] | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef<BrainstormSnapshot | null>(snapshot ?? null);
  const dragStateRef = useRef<DragState | null>(null);
  const didAutoFocusWorkspace = useRef(false);

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
        const nextSnapshot = await loadBrainstormSnapshot(gateway);

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
  }, [gateway, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_BRAINSTORM_SNAPSHOT;
  const activeSelectedCanvasId =
    selectedCanvasId ?? localSnapshot?.selectedCanvasId;
  const model = buildBrainstormPanelModel(activeSnapshot, {
    selectedCanvasId: activeSelectedCanvasId,
    canvasHrefBuilder
  });
  const selectedCanvas = model.selectedCanvas;
  const selectedCanvasIdForActions = activeSelectedCanvasId ?? selectedCanvas?.id;
  const selectedGraph = selectedCanvasIdForActions
    ? activeSnapshot.graphsByCanvasId[selectedCanvasIdForActions]
    : undefined;
  const canvasView = selectedGraph
    ? toGraphCanvasViewModel({
        mode: selectedGraph.canvas.mode,
        nodes: selectedGraph.nodes,
        edges: selectedGraph.edges
      })
    : { nodes: [], edges: [] };
  const nodesById = new Map(
    (selectedGraph?.nodes ?? []).map((node) => [node.id, node] as const)
  );
  const viewNodesById = new Map(
    canvasView.nodes.map((node) => [node.id, node] as const)
  );
  const selectedNode = selectedNodeId
    ? nodesById.get(selectedNodeId)
    : undefined;
  const selectedViewNode = selectedNodeId
    ? viewNodesById.get(selectedNodeId)
    : undefined;
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ??
    STATUS_STYLES.unknown;

  useEffect(() => {
    snapshotRef.current = localSnapshot;
  }, [localSnapshot]);

  useEffect(() => {
    if (didAutoFocusWorkspace.current || loading || !selectedCanvas) {
      return;
    }

    didAutoFocusWorkspace.current = true;
    workspaceRef.current?.focus();
  }, [loading, selectedCanvas]);

  useEffect(() => {
    if (!selectedGraph) {
      setSelectedNodeId(null);
      setReparentMode(false);
      return;
    }

    if (
      selectedNodeId &&
      !selectedGraph.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(null);
      setReparentMode(false);
    }
  }, [selectedGraph, selectedNodeId]);

  useEffect(() => {
    if (!draggingNodeId) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;

      if (!dragState) {
        return;
      }

      const dx = event.clientX - dragState.pointerStartX;
      const dy = event.clientY - dragState.pointerStartY;
      const position = {
        x: Math.max(0, Math.round(dragState.originX + dx)),
        y: Math.max(0, Math.round(dragState.originY + dy))
      };

      setLocalSnapshot((current) => {
        if (!current) {
          return current;
        }

        const graph = current.graphsByCanvasId[dragState.canvasId];

        if (!graph) {
          return current;
        }

        return mergeCanvasGraph(current, {
          ...graph,
          nodes: graph.nodes.map((node) =>
            node.id === dragState.nodeId ? { ...node, position } : node
          )
        });
      });
    }

    async function handlePointerUp() {
      const dragState = dragStateRef.current;

      dragStateRef.current = null;
      setDraggingNodeId(null);

      if (!dragState) {
        return;
      }

      const graph = snapshotRef.current?.graphsByCanvasId[dragState.canvasId];
      const node = graph?.nodes.find((entry) => entry.id === dragState.nodeId);

      if (!node) {
        return;
      }

      try {
        await gateway.updateNode({
          canvasId: dragState.canvasId,
          nodeId: dragState.nodeId,
          position: node.position
        });
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [draggingNodeId, gateway]);

  async function refreshCanvasGraph(canvasId: BrainstormCanvas["id"]) {
    setGraphLoadingId(canvasId);

    try {
      const canvasGraph = await gateway.getCanvasGraph(canvasId);
      setLocalSnapshot((current) =>
        mergeCanvasGraph(
          current ?? EMPTY_BRAINSTORM_SNAPSHOT,
          canvasGraph,
          selectedCanvasId === undefined ? canvasId : current?.selectedCanvasId
        )
      );
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setGraphLoadingId(null);
    }
  }

  async function selectCanvas(canvasId: BrainstormCanvas["id"]) {
    setFeedback(null);
    setError(null);
    setSelectedNodeId(null);
    setReparentMode(false);

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

    await refreshCanvasGraph(canvasId);
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
        const response = await gateway.createCanvas({
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
              selectedCanvasId: nextCanvas.id
            };
          });
        }
      }

      setCanvasName("");
      setFeedback(`Canvas "${name}" is ready.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function createNodeFromComposer(relationship: DraftRelationship) {
    const label = nodeLabel.trim();
    const canvasId = selectedCanvasIdForActions;

    if (!label || !canvasId) {
      setFeedback("Add a label and choose a canvas before creating a node.");
      return;
    }

    const selectedViewNodeForDraft = selectedViewNode;

    if ((relationship === "child" || relationship === "sibling") && !selectedViewNodeForDraft) {
      setFeedback(
        relationship === "child"
          ? "Select a node first, then create the child."
          : "Select a node first, then create the sibling."
      );
      return;
    }

    const input = {
      canvasId,
      label,
      category: nodeCategory,
      role: "brainstorm" as const,
      source: "user" as const,
      position: createDraftNodePosition({
        relationship,
        nodeCount: canvasView.nodes.length,
        selectedNode: selectedViewNodeForDraft
      }),
      ...(relationship === "child" && selectedViewNodeForDraft
        ? { parentNodeId: selectedViewNodeForDraft.id as BrainstormNode["id"] }
        : {}),
      ...(relationship === "sibling" && selectedNode?.parentNodeId
        ? { parentNodeId: selectedNode.parentNodeId }
        : {})
    } satisfies CreateBrainstormNodeInput;

    setPendingAction("node");
    setFeedback(null);
    setError(null);

    try {
      if (onCreateNode) {
        await onCreateNode(input);
      } else {
        await gateway.createNode(input);
        await refreshCanvasGraph(canvasId);
      }

      setNodeLabel("");
      setFeedback(
        relationship === "root"
          ? `Added "${label}" to ${selectedCanvas?.name ?? "the canvas"}.`
          : relationship === "child"
            ? `Added child "${label}".`
            : `Added sibling "${label}".`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function moveSelectedNode(direction: "left" | "right" | "up" | "down") {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedNode) {
      return;
    }

    const nextPosition = moveGraphNodePosition(selectedNode.position, direction);

    try {
      const response = await gateway.updateNode({
        canvasId,
        nodeId: selectedNode.id,
        position: nextPosition
      });

      if (response.node) {
        setLocalSnapshot((current) =>
          current ? replaceNodeInGraph(current, canvasId, response.node!) : current
        );
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function detachSelectedNode() {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedNode) {
      return;
    }

    setPendingAction("mutation");

    try {
      await gateway.updateNode({
        canvasId,
        nodeId: selectedNode.id,
        parentNodeId: null
      });
      await refreshCanvasGraph(canvasId);
      setFeedback(`Detached "${selectedNode.label}" from its parent.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSelectedNode() {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedNode) {
      return;
    }

    setPendingAction("mutation");

    try {
      await gateway.deleteNode({
        canvasId,
        nodeId: selectedNode.id
      });
      setLocalSnapshot((current) =>
        current ? removeNodeFromGraph(current, canvasId, selectedNode.id) : current
      );
      setFeedback(`Removed "${selectedNode.label}".`);
      setSelectedNodeId(null);
      setReparentMode(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleNodeClick(node: GraphNodeViewModel) {
    if (
      reparentMode &&
      selectedNode &&
      selectedCanvasIdForActions &&
      node.id !== selectedNode.id
    ) {
      try {
        setPendingAction("mutation");
        await gateway.updateNode({
          canvasId: selectedCanvasIdForActions,
          nodeId: selectedNode.id,
          parentNodeId: node.id as BrainstormNode["id"]
        });
        await refreshCanvasGraph(selectedCanvasIdForActions);
        setFeedback(`Moved "${selectedNode.label}" under "${node.label}".`);
        setReparentMode(false);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
      } finally {
        setPendingAction(null);
      }

      return;
    }

    setSelectedNodeId(node.id as BrainstormNode["id"]);
    setFeedback(null);
    workspaceRef.current?.focus();
  }

  function handleNodePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: GraphNodeViewModel
  ) {
    const selectedNodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

    if (!selectedNodeRecord || !selectedCanvasIdForActions || reparentMode) {
      return;
    }

    dragStateRef.current = {
      canvasId: selectedCanvasIdForActions,
      nodeId: node.id as BrainstormNode["id"],
      originX: selectedNodeRecord.position.x,
      originY: selectedNodeRecord.position.y,
      pointerStartX: event.clientX,
      pointerStartY: event.clientY
    };

    setSelectedNodeId(node.id as BrainstormNode["id"]);
    setDraggingNodeId(node.id as BrainstormNode["id"]);
    workspaceRef.current?.focus();
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (isTypingTarget(event.target)) {
      return;
    }

    switch (event.key) {
      case "c":
      case "C":
        event.preventDefault();
        await createNodeFromComposer("child");
        break;
      case "s":
      case "S":
        event.preventDefault();
        await createNodeFromComposer("sibling");
        break;
      case "n":
      case "N":
        event.preventDefault();
        await createNodeFromComposer("root");
        break;
      case "ArrowLeft":
        event.preventDefault();
        await moveSelectedNode("left");
        break;
      case "ArrowRight":
        event.preventDefault();
        await moveSelectedNode("right");
        break;
      case "ArrowUp":
        event.preventDefault();
        await moveSelectedNode("up");
        break;
      case "ArrowDown":
        event.preventDefault();
        await moveSelectedNode("down");
        break;
      case "Delete":
      case "Backspace":
        if (selectedNode) {
          event.preventDefault();
          await deleteSelectedNode();
        }
        break;
      case "m":
      case "M":
        if (selectedNode) {
          event.preventDefault();
          setReparentMode((current) => !current);
        }
        break;
      case "Escape":
        event.preventDefault();
        setReparentMode(false);
        break;
      default:
        break;
    }
  }

  return (
    <article
      ref={workspaceRef}
      className="panel"
      onKeyDown={(event) => void handleKeyDown(event)}
      tabIndex={0}
    >
      <header className="panel-header">
        <div className="module-header">
          <div>
            <h2>Mind-map canvas</h2>
            <p>
              Work directly on the mind-map canvas. Root nodes, children, siblings,
              re-parenting, delete, keyboard nudging, and drag positioning all stay in
              one place.
            </p>
          </div>
          <div
            style={{
              border: `1px solid ${statusStyle.borderColor}`,
              background: statusStyle.background,
              color: statusStyle.color
            }}
            className="status-pill"
          >
            {moduleStatus}
          </div>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <section className="workspace-card workspace-card--sidebar">
            <div className="workspace-card__header">
              <strong>Canvases</strong>
              <p>Separate mind-map canvases keep brainstorming uncluttered.</p>
            </div>

            {loading ? <p className="callout">Loading canvases from the gateway graph proxy.</p> : null}
            {error ? <p className="callout callout--error">{error}</p> : null}
            {feedback ? <p className="callout">{feedback}</p> : null}

            <div className="stack-list">
              {model.canvasSummaries.map((canvas) => (
                <button
                  key={canvas.id}
                  type="button"
                  className={
                    canvas.isSelected
                      ? "stack-list__item stack-list__item--active"
                      : "stack-list__item"
                  }
                  onClick={() => void selectCanvas(canvas.id)}
                >
                  <span>{canvas.name}</span>
                  <span>
                    {canvas.graphLoaded
                      ? `${canvas.nodeCount} nodes`
                      : "Load preview"}
                  </span>
                </button>
              ))}
            </div>

            <form className="stack-form" onSubmit={(event) => void handleCreateCanvas(event)}>
              <label className="stack-form__field">
                <span>New canvas</span>
                <input
                  value={canvasName}
                  onChange={(event) => setCanvasName(event.target.value)}
                  placeholder="Career themes"
                />
              </label>
              <button type="submit" disabled={pendingAction === "canvas"}>
                {pendingAction === "canvas" ? "Creating..." : "Create canvas"}
              </button>
            </form>
          </section>

          <section className="workspace-card workspace-card--sidebar">
            <div className="workspace-card__header">
              <strong>Quick create</strong>
              <p>Use the composer buttons or the keyboard shortcuts below.</p>
            </div>

            <div className="stack-form">
              <label className="stack-form__field">
                <span>Label</span>
                <input
                  value={nodeLabel}
                  onChange={(event) => setNodeLabel(event.target.value)}
                  placeholder="Event-driven design"
                />
              </label>
              <label className="stack-form__field">
                <span>Category</span>
                <select
                  value={nodeCategory}
                  onChange={(event) =>
                    setNodeCategory(
                      event.target.value as (typeof USER_NODE_CATEGORIES)[number]
                    )
                  }
                >
                  {USER_NODE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <div className="segmented-actions">
                <button
                  type="button"
                  onClick={() => void createNodeFromComposer("root")}
                  disabled={pendingAction === "node" || !selectedCanvasIdForActions}
                >
                  Create root node
                </button>
                <button
                  type="button"
                  onClick={() => void createNodeFromComposer("child")}
                  disabled={pendingAction === "node" || !selectedNode}
                >
                  Create child
                </button>
                <button
                  type="button"
                  onClick={() => void createNodeFromComposer("sibling")}
                  disabled={pendingAction === "node" || !selectedNode}
                >
                  Create sibling
                </button>
              </div>
            </div>
          </section>

          <section className="workspace-card workspace-card--sidebar">
            <div className="workspace-card__header">
              <strong>Selected node</strong>
              <p>
                {selectedNode
                  ? "Use keyboard arrows to move it, or drag it directly on the canvas."
                  : "Select a node to enable node actions."}
              </p>
            </div>

            {selectedNode ? (
              <div className="node-inspector">
                <strong>{selectedNode.label}</strong>
                <span>{selectedNode.category}</span>
                <span>
                  Position {selectedNode.position.x}, {selectedNode.position.y}
                </span>
                <span>
                  {selectedNode.parentNodeId
                    ? `Parent: ${nodesById.get(selectedNode.parentNodeId)?.label ?? "Unknown"}`
                    : "Root node"}
                </span>
                <div className="segmented-actions">
                  <button
                    type="button"
                    onClick={() => setReparentMode((current) => !current)}
                    disabled={pendingAction === "mutation"}
                  >
                    {reparentMode ? "Cancel reparent mode" : "Reparent mode"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void detachSelectedNode()}
                    disabled={pendingAction === "mutation" || !selectedNode.parentNodeId}
                  >
                    Detach
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteSelectedNode()}
                    disabled={pendingAction === "mutation"}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <p className="muted-copy">
                Nothing selected yet. Reparent mode unlocks once a node is selected.
              </p>
            )}

            <p className="section-kicker">Hotkeys</p>
            <ul className="shortcut-list">
              {getShortcutHintRows().map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="workspace-main">
          <div className="workspace-summary">
            <div className="summary-chip">
              <strong>{selectedCanvas?.name ?? "No canvas selected"}</strong>
              <span>
                {selectedCanvas
                  ? `${selectedCanvas.nodeCount} nodes • ${selectedCanvas.edgeCount} links`
                  : "Create or select a canvas"}
              </span>
            </div>
            <div className="summary-chip">
              <strong>{selectedNode ? selectedNode.label : "No active node"}</strong>
              <span>
                {reparentMode
                  ? "Click another node to make it the new parent."
                  : "Click a node to select it."}
              </span>
            </div>
          </div>

          {graphLoadingId === selectedCanvasIdForActions ? (
            <p className="callout">Refreshing canvas graph…</p>
          ) : null}

          <GraphCanvasSurface
            title={selectedCanvas?.name ?? "Brainstorm canvas"}
            nodes={canvasView.nodes}
            edges={canvasView.edges}
            selectedNodeId={selectedNodeId ?? undefined}
            pendingParentNodeId={reparentMode ? selectedNodeId ?? undefined : undefined}
            draggingNodeId={draggingNodeId ?? undefined}
            emptyMessage="Create a node to start the mind-map. Child nodes will appear connected automatically."
            onCanvasClick={() => {
              workspaceRef.current?.focus();
              setSelectedNodeId(null);
              if (reparentMode) {
                setReparentMode(false);
              }
            }}
            onNodeClick={(node) => void handleNodeClick(node)}
            onNodePointerDown={handleNodePointerDown}
            renderNodeMeta={(node) => {
              const nodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

              return nodeRecord?.parentNodeId
                ? `Child of ${nodesById.get(nodeRecord.parentNodeId)?.label ?? "Unknown"}`
                : "Top-level";
            }}
          />
        </section>
      </div>
    </article>
  );
}
