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
import {
  type GraphNodeViewModel
} from "@pdp-helper/ui-graph";
import { gatewayUrl } from "../../lib/gateway";
import {
  GRAPH_MOVE_STEP,
  getGraphCanvasBounds,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH
} from "../../lib/graph-canvas-helpers";
import { BrainstormCanvasSurface } from "./BrainstormCanvasSurface";
import {
  createBrainstormGatewayPort,
  loadBrainstormSnapshot,
  type CreateBrainstormCanvasInput,
  type CreateBrainstormNodeInput
} from "./brainstorm-gateway";
import {
  buildBrainstormPanelModel,
  compareCanvases,
  deriveBrainstormCreateNodeInput,
  deriveBrainstormReparentUpdate,
  EMPTY_BRAINSTORM_SNAPSHOT,
  type BrainstormCanvasGraph,
  type BrainstormSnapshot
} from "./brainstorm-model";
import {
  USER_NODE_CATEGORIES,
  type BrainstormCanvas,
  type BrainstormNode,
  type BrainstormPosition
} from "./brainstorm-types";

type PendingAction = "canvas" | "node" | "mutation" | null;
type NodeEditorMode = "create-root" | "create-child" | "create-sibling" | "edit";

interface NodeEditorState {
  readonly mode: NodeEditorMode;
  readonly nodeId?: BrainstormNode["id"];
}

interface NodeEditorDraft {
  readonly label: string;
  readonly category: (typeof USER_NODE_CATEGORIES)[number];
  readonly description: string;
}

interface PanState {
  readonly pointerStartX: number;
  readonly pointerStartY: number;
  readonly originX: number;
  readonly originY: number;
  hasMoved: boolean;
}

interface DragState {
  readonly canvasId: BrainstormCanvas["id"];
  readonly nodeId: BrainstormNode["id"];
  readonly subtreeIds: readonly BrainstormNode["id"][];
  readonly originPositions: Readonly<Record<string, BrainstormPosition>>;
  readonly pointerStartX: number;
  readonly pointerStartY: number;
  hasMoved: boolean;
}

interface ReparentTargetState {
  readonly nodeId: BrainstormNode["id"];
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

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load brainstorm data.";
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest("[data-brainstorm-hotkeys='allow']")) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    tagName === "button" ||
    tagName === "a" ||
    target.isContentEditable
  );
}

function createEmptyNodeDraft(): NodeEditorDraft {
  return {
    label: "",
    category: "skill",
    description: ""
  };
}

function createNodeDraftFromNode(node: BrainstormNode): NodeEditorDraft {
  return {
    label: node.label,
    category: node.category as (typeof USER_NODE_CATEGORIES)[number],
    description: node.description ?? ""
  };
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

function clampPosition(position: BrainstormPosition): BrainstormPosition {
  return {
    x: Math.max(0, Math.round(position.x)),
    y: Math.max(0, Math.round(position.y))
  };
}

function collectSubtreeNodeIds(
  nodes: readonly BrainstormNode[],
  rootNodeId: BrainstormNode["id"]
): readonly BrainstormNode["id"][] {
  const childIdsByParentId = new Map<string, BrainstormNode["id"][]>();

  for (const node of nodes) {
    if (!node.parentNodeId) {
      continue;
    }

    const current = childIdsByParentId.get(node.parentNodeId) ?? [];
    current.push(node.id);
    childIdsByParentId.set(node.parentNodeId, current);
  }

  const visited = new Set<BrainstormNode["id"]>();
  const queue: BrainstormNode["id"][] = [rootNodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift();

    if (!currentNodeId || visited.has(currentNodeId)) {
      continue;
    }

    visited.add(currentNodeId);

    for (const childId of childIdsByParentId.get(currentNodeId) ?? []) {
      queue.push(childId);
    }
  }

  return [...visited];
}

function shiftSubtreePositions(
  graph: BrainstormCanvasGraph,
  subtreeNodeIds: ReadonlySet<BrainstormNode["id"]>,
  delta: {
    readonly x: number;
    readonly y: number;
  },
  originPositions?: Readonly<Record<string, BrainstormPosition>>
): BrainstormCanvasGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => {
      if (!subtreeNodeIds.has(node.id)) {
        return node;
      }

      const basePosition = originPositions?.[node.id] ?? node.position;

      return {
        ...node,
        position: clampPosition({
          x: basePosition.x + delta.x,
          y: basePosition.y + delta.y
        })
      };
    })
  };
}

function resolveSubtreeSpacing(
  graph: BrainstormCanvasGraph,
  subtreeNodeIds: ReadonlySet<BrainstormNode["id"]>
): BrainstormCanvasGraph {
  const movingNodes = graph.nodes.filter((node) => subtreeNodeIds.has(node.id));
  const staticNodes = graph.nodes.filter((node) => !subtreeNodeIds.has(node.id));

  if (movingNodes.length === 0 || staticNodes.length === 0) {
    return graph;
  }

  const horizontalPadding = 36;
  const verticalPadding = 28;
  let offsetY = 0;
  let iterationCount = 0;

  const overlaps = (node: BrainstormNode, other: BrainstormNode) => {
    const left = node.position.x;
    const right = node.position.x + GRAPH_NODE_WIDTH;
    const top = node.position.y + offsetY;
    const bottom = top + GRAPH_NODE_HEIGHT;
    const otherLeft = other.position.x;
    const otherRight = other.position.x + GRAPH_NODE_WIDTH;
    const otherTop = other.position.y;
    const otherBottom = other.position.y + GRAPH_NODE_HEIGHT;

    return !(
      right + horizontalPadding <= otherLeft ||
      left >= otherRight + horizontalPadding ||
      bottom + verticalPadding <= otherTop ||
      top >= otherBottom + verticalPadding
    );
  };

  while (
    movingNodes.some((node) => staticNodes.some((otherNode) => overlaps(node, otherNode))) &&
    iterationCount < 120
  ) {
    offsetY += verticalPadding;
    iterationCount += 1;
  }

  if (offsetY === 0) {
    return graph;
  }

  return shiftSubtreePositions(graph, subtreeNodeIds, {
    x: 0,
    y: offsetY
  });
}

function getDescendantNodeIds(
  nodes: readonly BrainstormNode[],
  rootNodeId: BrainstormNode["id"]
): ReadonlySet<BrainstormNode["id"]> {
  const subtreeIds = new Set(collectSubtreeNodeIds(nodes, rootNodeId));
  subtreeIds.delete(rootNodeId);
  return subtreeIds;
}

function getViewResetOffset(
  nodes: readonly GraphNodeViewModel[],
  viewport?: {
    readonly width: number;
    readonly height: number;
  }
): {
  readonly x: number;
  readonly y: number;
} {
  if (nodes.length === 0) {
    return { x: 48, y: 36 };
  }

  const bounds = getGraphCanvasBounds(nodes);
  const viewportWidth = viewport?.width ?? 920;
  const viewportHeight = viewport?.height ?? 660;

  return {
    x: Math.round(Math.max(24, (viewportWidth - bounds.width) / 2)),
    y: Math.round(Math.max(24, (viewportHeight - bounds.height) / 2))
  };
}

function isSameNodeDraft(left: NodeEditorDraft, right: NodeEditorDraft) {
  return (
    left.label === right.label &&
    left.category === right.category &&
    left.description === right.description
  );
}

function BrainstormNodeModal({
  state,
  draft,
  pending,
  parentLabel,
  dirty,
  onDraftChange,
  onCancel,
  onSubmit
}: {
  readonly state: NodeEditorState;
  readonly draft: NodeEditorDraft;
  readonly pending: boolean;
  readonly parentLabel?: string;
  readonly dirty: boolean;
  readonly onDraftChange: (draft: NodeEditorDraft) => void;
  readonly onCancel: () => void;
  readonly onSubmit: () => void;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const pointerStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const firstFocusable = formRef.current?.querySelector<HTMLElement>(
      "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])"
    );
    firstFocusable?.focus();
  }, []);

  const title =
    state.mode === "edit"
      ? "Edit node"
      : state.mode === "create-child"
        ? "Add child node"
        : state.mode === "create-sibling"
          ? "Add sibling node"
          : "Add root node";

  return (
    <div
      className="skill-modal-backdrop"
      role="presentation"
      onPointerDown={(event) => {
        if (pending) {
          return;
        }
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        if (pending) {
          pointerStartedOnBackdrop.current = false;
          return;
        }
        if (
          pointerStartedOnBackdrop.current &&
          event.target === event.currentTarget
        ) {
          onCancel();
        }

        pointerStartedOnBackdrop.current = false;
      }}
      onPointerCancel={() => {
        pointerStartedOnBackdrop.current = false;
      }}
    >
      <form
        ref={formRef}
        className="skill-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="brainstorm-node-editor-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (pending) {
              return;
            }
            onCancel();
            return;
          }

          if (event.key !== "Tab") {
            return;
          }

          const focusableElements = Array.from(
            formRef.current?.querySelectorAll<HTMLElement>(
              "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])"
            ) ?? []
          );

          if (focusableElements.length === 0) {
            return;
          }

          const firstFocusable = focusableElements[0];
          const lastFocusable = focusableElements[focusableElements.length - 1];

          if (!firstFocusable || !lastFocusable) {
            return;
          }

          if (event.shiftKey && document.activeElement === firstFocusable) {
            event.preventDefault();
            lastFocusable.focus();
            return;
          }

          if (!event.shiftKey && document.activeElement === lastFocusable) {
            event.preventDefault();
            firstFocusable.focus();
          }
        }}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="skill-modal__header">
          <h2 id="brainstorm-node-editor-title">{title}</h2>
          {parentLabel ? (
            <p className="skill-modal__subcopy">Connected under {parentLabel}</p>
          ) : null}
        </div>

        <div className="skill-modal__body">
          <label className="skill-modal__field">
            <span>Label *</span>
            <input
              value={draft.label}
              placeholder="e.g. Event-driven design"
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  label: event.target.value
                })
              }
            />
          </label>

          <label className="skill-modal__field">
            <span>Category</span>
            <select
              value={draft.category}
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  category: event.target.value as (typeof USER_NODE_CATEGORIES)[number]
                })
              }
            >
              {USER_NODE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="skill-modal__field">
            <span>Description</span>
            <textarea
              value={draft.description}
              placeholder="Optional context..."
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  description: event.target.value
                })
              }
            />
          </label>
        </div>

        <div className="skill-modal__actions">
          <button
            type="button"
            className="skill-modal__secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button type="submit" disabled={pending || draft.label.trim().length === 0}>
            {state.mode === "edit" ? "Save" : "Add"}
          </button>
        </div>
        {dirty ? <p className="brainstorm-modal__note">Unsaved changes</p> : null}
      </form>
    </div>
  );
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
  const [selectedNodeId, setSelectedNodeId] = useState<BrainstormNode["id"] | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [reparentTarget, setReparentTarget] = useState<ReparentTargetState | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<BrainstormNode["id"] | null>(null);
  const [editorState, setEditorState] = useState<NodeEditorState | null>(null);
  const [editorDraft, setEditorDraft] = useState<NodeEditorDraft>(createEmptyNodeDraft);
  const [editorInitialDraft, setEditorInitialDraft] = useState<NodeEditorDraft>(
    createEmptyNodeDraft
  );
  const [viewportOffset, setViewportOffset] = useState({ x: 48, y: 36 });
  const [isPanning, setIsPanning] = useState(false);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef<BrainstormSnapshot | null>(snapshot ?? null);
  const panStateRef = useRef<PanState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const didAutoFocusWorkspace = useRef(false);
  const refreshSequenceRef = useRef(0);
  const suppressCanvasClickRef = useRef(false);

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
        if (active) {
          setError(getErrorMessage(requestError));
        }
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

  useEffect(() => {
    snapshotRef.current = localSnapshot;
  }, [localSnapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_BRAINSTORM_SNAPSHOT;
  const activeSelectedCanvasId = selectedCanvasId ?? localSnapshot?.selectedCanvasId;
  const model = buildBrainstormPanelModel(activeSnapshot, {
    selectedCanvasId: activeSelectedCanvasId,
    canvasHrefBuilder
  });
  const selectedCanvas = model.selectedCanvas;
  const selectedCanvasIdForActions = activeSelectedCanvasId ?? selectedCanvas?.id;
  const selectedGraph = selectedCanvasIdForActions
    ? activeSnapshot.graphsByCanvasId[selectedCanvasIdForActions]
    : undefined;
  const canvasView = model.selectedCanvas?.graphView ?? { nodes: [], edges: [] };
  const nodesById = new Map(
    (selectedGraph?.nodes ?? []).map((node) => [node.id, node] as const)
  );
  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) : undefined;
  const parentLabel =
    selectedNode?.parentNodeId && nodesById.get(selectedNode.parentNodeId)
      ? nodesById.get(selectedNode.parentNodeId)?.label
      : undefined;
  const selectedNodeCount = selectedGraph?.nodes.length ?? 0;
  const linkCount = selectedGraph?.edges.length ?? 0;
  const selectedNodeParentLabel = selectedNode?.parentNodeId
    ? nodesById.get(selectedNode.parentNodeId)?.label ?? "Unknown"
    : "Root node";
  const connectBlockedNodeIds = useMemo(
    () =>
      selectedNode && selectedGraph
        ? getDescendantNodeIds(selectedGraph.nodes, selectedNode.id)
        : new Set<BrainstormNode["id"]>(),
    [selectedGraph, selectedNode]
  );
  const reparentCandidateNodeIds = useMemo(
    () =>
      [...canvasView.nodes]
        .sort((left, right) => {
          if (left.position.y !== right.position.y) {
            return left.position.y - right.position.y;
          }

          if (left.position.x !== right.position.x) {
            return left.position.x - right.position.x;
          }

          return left.label.localeCompare(right.label, undefined, {
            sensitivity: "base"
          });
        })
        .map((node) => node.id)
        .filter(
          (nodeId) =>
            nodeId !== selectedNode?.id &&
            !connectBlockedNodeIds.has(nodeId as BrainstormNode["id"])
        ) as BrainstormNode["id"][],
    [canvasView.nodes, connectBlockedNodeIds, selectedNode?.id]
  );
  const isGraphLoading =
    !!selectedCanvasIdForActions &&
    graphLoadingId === selectedCanvasIdForActions &&
    !selectedGraph;
  const canMutateSelection = !!selectedNode && pendingAction !== "mutation";

  useEffect(() => {
    if (didAutoFocusWorkspace.current || loading || !selectedCanvas) {
      return;
    }

    didAutoFocusWorkspace.current = true;
    workspaceRef.current?.focus();
  }, [loading, selectedCanvas]);

  useEffect(() => {
    setViewportOffset(getViewResetOffset(canvasView.nodes, getCanvasViewportSize()));
    setConnectMode(false);
    setReparentTarget(null);
  }, [canvasView.nodes, selectedCanvasIdForActions]);

  useEffect(() => {
    if (!connectMode) {
      setReparentTarget(null);
      return;
    }

    if (reparentCandidateNodeIds.length === 0) {
      setReparentTarget(null);
      return;
    }

    const firstCandidateNodeId = reparentCandidateNodeIds[0];

    if (!firstCandidateNodeId) {
      setReparentTarget(null);
      return;
    }

    setReparentTarget((current) =>
      current && reparentCandidateNodeIds.includes(current.nodeId)
        ? current
        : { nodeId: firstCandidateNodeId }
    );
  }, [connectMode, reparentCandidateNodeIds]);

  useEffect(() => {
    if (!selectedGraph) {
      setSelectedNodeId(null);
      setConnectMode(false);
      return;
    }

    if (
      selectedNodeId &&
      !selectedGraph.nodes.some((node) => node.id === selectedNodeId)
    ) {
      setSelectedNodeId(null);
      setConnectMode(false);
    }
  }, [selectedGraph, selectedNodeId]);

  useEffect(() => {
    if (!selectedGraph || canvasView.nodes.length === 0) {
      return;
    }

    const positionsById = new Map(
      canvasView.nodes.map((node) => [node.id, node.position] as const)
    );
    const needsSync = selectedGraph.nodes.some((node) => {
      const nextPosition = positionsById.get(node.id);

      return (
        nextPosition &&
        (nextPosition.x !== node.position.x || nextPosition.y !== node.position.y)
      );
    });

    if (!needsSync) {
      return;
    }

    setLocalSnapshot((current) => {
      if (!current) {
        return current;
      }

      return mergeCanvasGraph(current, {
        ...selectedGraph,
        nodes: selectedGraph.nodes.map((node) => ({
          ...node,
          position: positionsById.get(node.id) ?? node.position
        }))
      });
    });
  }, [canvasView.nodes, selectedGraph]);

  useEffect(() => {
    if (!panStateRef.current && !dragStateRef.current) {
      return;
    }

    const dragThreshold = 8;

    function handlePointerMove(event: PointerEvent) {
      const panState = panStateRef.current;
      const dragState = dragStateRef.current;

      if (panState) {
        const deltaX = event.clientX - panState.pointerStartX;
        const deltaY = event.clientY - panState.pointerStartY;

        if (!panState.hasMoved) {
          const distance = Math.hypot(deltaX, deltaY);

          if (distance < 6) {
            return;
          }

          panState.hasMoved = true;
        }

        suppressCanvasClickRef.current = true;
        setIsPanning(true);
        setViewportOffset({
          x: Math.round(panState.originX + deltaX),
          y: Math.round(panState.originY + deltaY)
        });
        return;
      }

      if (!dragState) {
        return;
      }

      const deltaX = event.clientX - dragState.pointerStartX;
      const deltaY = event.clientY - dragState.pointerStartY;

      if (!dragState.hasMoved) {
        const distance = Math.hypot(deltaX, deltaY);

        if (distance < dragThreshold) {
          return;
        }

        dragState.hasMoved = true;
        suppressCanvasClickRef.current = true;
        setDraggingNodeId(dragState.nodeId);
      }

      setLocalSnapshot((current) => {
        if (!current) {
          return current;
        }

        const graph = current.graphsByCanvasId[dragState.canvasId];

        if (!graph) {
          return current;
        }

        return mergeCanvasGraph(
          current,
          shiftSubtreePositions(
            graph,
            new Set(dragState.subtreeIds),
            {
              x: deltaX,
              y: deltaY
            },
            dragState.originPositions
          )
        );
      });
    }

    async function handlePointerUp() {
      const panState = panStateRef.current;
      const dragState = dragStateRef.current;

      panStateRef.current = null;
      dragStateRef.current = null;
      setIsPanning(false);

      if (panState) {
        window.setTimeout(() => {
          suppressCanvasClickRef.current = false;
        }, 0);
        return;
      }

      setDraggingNodeId(null);

      if (!dragState || !dragState.hasMoved) {
        return;
      }

      window.setTimeout(() => {
        suppressCanvasClickRef.current = false;
      }, 0);

      const currentSnapshot = snapshotRef.current;
      const graph = currentSnapshot?.graphsByCanvasId[dragState.canvasId];

      if (!currentSnapshot || !graph) {
        return;
      }

      const resolvedGraph = resolveSubtreeSpacing(
        graph,
        new Set(dragState.subtreeIds)
      );

      if (resolvedGraph !== graph) {
        setLocalSnapshot((current) =>
          current ? mergeCanvasGraph(current, resolvedGraph) : current
        );
      }

      setPendingAction("mutation");

      try {
        const nodesToPersist = (resolvedGraph ?? graph).nodes.filter((node) =>
          dragState.subtreeIds.includes(node.id as BrainstormNode["id"])
        );

        await Promise.all(
          nodesToPersist.map((node) =>
            gateway.updateNode({
              canvasId: dragState.canvasId,
              nodeId: node.id,
              position: node.position
            })
          )
        );

        await refreshCanvasGraph(dragState.canvasId, {
          preferredSelectedNodeId: dragState.nodeId
        });
        setError(null);
        setFeedback(`Moved "${nodesById.get(dragState.nodeId)?.label ?? "node"}".`);
      } catch (requestError) {
        await refreshCanvasGraph(dragState.canvasId, {
          preferredSelectedNodeId: dragState.nodeId
        });
        setFeedback(null);
        setError(getErrorMessage(requestError));
      } finally {
        setPendingAction(null);
      }
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [gateway, nodesById]);

  async function refreshCanvasGraph(
    canvasId: BrainstormCanvas["id"],
    options: {
      readonly preferredSelectedNodeId?: BrainstormNode["id"] | null;
    } = {}
  ) {
    const requestSequence = refreshSequenceRef.current + 1;
    refreshSequenceRef.current = requestSequence;
    setGraphLoadingId(canvasId);

    try {
      const canvasGraph = await gateway.getCanvasGraph(canvasId);

      if (refreshSequenceRef.current !== requestSequence) {
        return;
      }

      setLocalSnapshot((current) =>
        mergeCanvasGraph(
          current ?? EMPTY_BRAINSTORM_SNAPSHOT,
          canvasGraph,
          current?.selectedCanvasId
        )
      );
      if (options.preferredSelectedNodeId !== undefined) {
        setSelectedNodeId(options.preferredSelectedNodeId);
      }
      setError(null);
    } catch (requestError) {
      if (refreshSequenceRef.current === requestSequence) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      if (refreshSequenceRef.current === requestSequence) {
        setGraphLoadingId(null);
      }
    }
  }

  async function selectCanvas(canvasId: BrainstormCanvas["id"]) {
    setFeedback(null);
    setError(null);
    setSelectedNodeId(null);
    setConnectMode(false);

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
              graphsByCanvasId: {
                ...baseSnapshot.graphsByCanvasId,
                [nextCanvas.id]: {
                  canvas: nextCanvas,
                  nodes: [],
                  edges: []
                }
              },
              selectedCanvasId: nextCanvas.id
            };
          });
          setSelectedNodeId(null);
        }
      }

      setCanvasName("");
      setFeedback(`Canvas "${name}" is ready.`);
      workspaceRef.current?.focus();
    } catch (requestError) {
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  function openNodeEditor(mode: NodeEditorMode) {
    if (!selectedCanvasIdForActions) {
      return;
    }

    if (mode === "create-root" && isGraphLoading) {
      return;
    }

    if (!selectedGraph && mode !== "create-root") {
      return;
    }

    if ((mode === "create-child" || mode === "create-sibling" || mode === "edit") && !selectedNode) {
      return;
    }

    setFeedback(null);
    setError(null);
    setConnectMode(false);
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (mode === "edit" && selectedNode) {
      const nextDraft = createNodeDraftFromNode(selectedNode);
      setEditorState({
        mode,
        nodeId: selectedNode.id
      });
      setEditorDraft(nextDraft);
      setEditorInitialDraft(nextDraft);
      return;
    }

    const nextDraft = createEmptyNodeDraft();
    setEditorState({
      mode,
      ...(selectedNode ? { nodeId: selectedNode.id } : {})
    });
    setEditorDraft(nextDraft);
    setEditorInitialDraft(nextDraft);
  }

  function restoreFocusAfterEditorClose() {
    const target = returnFocusRef.current;

    if (target && target.isConnected) {
      target.focus();
      return;
    }

    workspaceRef.current?.focus();
  }

  function getCanvasViewportSize() {
    const viewport = canvasViewportRef.current;

    if (!viewport) {
      return undefined;
    }

    return {
      width: viewport.clientWidth,
      height: viewport.clientHeight
    };
  }

  function closeNodeEditor() {
    if (pendingAction === "node") {
      return;
    }

    if (!isSameNodeDraft(editorDraft, editorInitialDraft)) {
      const confirmed = globalThis.confirm("Discard your unsaved node changes?");

      if (!confirmed) {
        return;
      }
    }

    setEditorState(null);
    setEditorDraft(createEmptyNodeDraft());
    setEditorInitialDraft(createEmptyNodeDraft());
    restoreFocusAfterEditorClose();
  }

  async function submitNodeEditor() {
    if (!editorState || !selectedCanvasIdForActions) {
      return;
    }

    const label = editorDraft.label.trim();

    if (!label) {
      return;
    }

    setPendingAction("node");
    setError(null);
    setFeedback(null);

    try {
      if (editorState.mode === "edit" && editorState.nodeId) {
        await gateway.updateNode({
          canvasId: selectedCanvasIdForActions,
          nodeId: editorState.nodeId,
          label,
          category: editorDraft.category,
          description: editorDraft.description.trim().length > 0 ? editorDraft.description : null
        });
        await refreshCanvasGraph(selectedCanvasIdForActions, {
          preferredSelectedNodeId: editorState.nodeId
        });
        setError(null);
        setFeedback(`Updated "${label}".`);
      } else if (selectedGraph) {
        const createInput = {
          ...deriveBrainstormCreateNodeInput(selectedGraph, {
            intent:
              editorState.mode === "create-child"
                ? "child"
                : editorState.mode === "create-sibling"
                  ? "sibling"
                  : "root",
            anchorNodeId: editorState.nodeId,
            label,
            category: editorDraft.category
          }),
          ...(editorDraft.description.trim().length > 0
            ? { description: editorDraft.description }
            : {})
        };
        const response = onCreateNode
          ? await onCreateNode(createInput)
          : await gateway.createNode(createInput);

        const createdNodeId =
          typeof response === "object" &&
          response !== null &&
          "node" in response &&
          response.node &&
          typeof response.node === "object" &&
          "id" in response.node
            ? (response.node.id as BrainstormNode["id"])
            : null;

        await refreshCanvasGraph(selectedCanvasIdForActions, {
          preferredSelectedNodeId: createdNodeId
        });
        setFeedback(
          editorState.mode === "create-root"
            ? `Added "${label}" to ${selectedCanvas?.name ?? "the canvas"}.`
            : editorState.mode === "create-child"
              ? `Added child "${label}".`
              : `Added sibling "${label}".`
        );
        setError(null);
      } else {
        setFeedback(null);
        setError("Select a loaded canvas before adding nodes.");
        return;
      }

      setEditorState(null);
      setEditorDraft(createEmptyNodeDraft());
      setEditorInitialDraft(createEmptyNodeDraft());
      restoreFocusAfterEditorClose();
    } catch (requestError) {
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function moveSelectedSubtree(direction: "left" | "right" | "up" | "down") {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedGraph || !selectedNode || pendingAction === "mutation") {
      return;
    }

    const step =
      direction === "left"
        ? { x: -GRAPH_MOVE_STEP, y: 0 }
        : direction === "right"
          ? { x: GRAPH_MOVE_STEP, y: 0 }
          : direction === "up"
            ? { x: 0, y: -GRAPH_MOVE_STEP }
            : { x: 0, y: GRAPH_MOVE_STEP };

    const subtreeIds = new Set(collectSubtreeNodeIds(selectedGraph.nodes, selectedNode.id));
    const shiftedGraph = resolveSubtreeSpacing(
      shiftSubtreePositions(selectedGraph, subtreeIds, step),
      subtreeIds
    );

    setLocalSnapshot((current) =>
      current ? mergeCanvasGraph(current, shiftedGraph) : current
    );

    setPendingAction("mutation");

    try {
      await Promise.all(
        shiftedGraph.nodes
          .filter((node) => subtreeIds.has(node.id))
          .map((node) =>
            gateway.updateNode({
              canvasId,
              nodeId: node.id,
              position: node.position
            })
          )
      );
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: selectedNode.id
      });
      setError(null);
      setFeedback(`Moved "${selectedNode.label}".`);
    } catch (requestError) {
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: selectedNode.id
      });
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function detachSelectedNode() {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedNode || pendingAction === "mutation") {
      return;
    }

    setPendingAction("mutation");

    try {
      await gateway.updateNode({
        canvasId,
        nodeId: selectedNode.id,
        parentNodeId: null
      });
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: selectedNode.id
      });
      setConnectMode(false);
      workspaceRef.current?.focus();
      setError(null);
      setFeedback(`Detached "${selectedNode.label}" from its parent.`);
    } catch (requestError) {
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function deleteSelectedNode() {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedNode || pendingAction === "mutation") {
      return;
    }

    const subtreeCount = collectSubtreeNodeIds(selectedGraph?.nodes ?? [], selectedNode.id).length;
    const descendantCount = subtreeCount - 1;

    if (!globalThis.confirm(
      descendantCount > 0
        ? `Delete "${selectedNode.label}" and ${descendantCount} descendant${descendantCount === 1 ? "" : "s"}?`
        : `Delete "${selectedNode.label}"?`
    )) {
      return;
    }

    setPendingAction("mutation");

    try {
      await gateway.deleteNode({
        canvasId,
        nodeId: selectedNode.id
      });
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: null
      });
      setError(null);
      setFeedback(`Removed "${selectedNode.label}".`);
      setSelectedNodeId(null);
      setConnectMode(false);
      workspaceRef.current?.focus();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  function previewReparentTarget(nodeId: BrainstormNode["id"]) {
    setReparentTarget({ nodeId });
    setError(null);
    setFeedback(
      `Ready to move "${selectedNode?.label ?? "node"}" under "${nodesById.get(nodeId)?.label ?? "the selected parent"}". Press Enter to confirm.`
    );
  }

  async function handleNodeClick(node: GraphNodeViewModel) {
    if (
      connectMode &&
      selectedNode &&
      selectedCanvasIdForActions &&
      selectedGraph
    ) {
      if (node.id === selectedNode.id) {
        return;
      }
      if (connectBlockedNodeIds.has(node.id as BrainstormNode["id"])) {
        setFeedback(null);
        setError("A node cannot be moved under one of its own descendants.");
        return;
      }
      previewReparentTarget(node.id as BrainstormNode["id"]);

      return;
    }

    setSelectedNodeId(node.id as BrainstormNode["id"]);
    if (connectMode) {
      setReparentTarget({ nodeId: node.id as BrainstormNode["id"] });
    }
    setError(null);
    setFeedback(null);
  }

  function handleNodeFocus(node: GraphNodeViewModel) {
    if (
      !connectMode ||
      !selectedNode ||
      node.id === selectedNode.id ||
      connectBlockedNodeIds.has(node.id as BrainstormNode["id"])
    ) {
      return;
    }

    previewReparentTarget(node.id as BrainstormNode["id"]);
  }

  function handleNodePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    node: GraphNodeViewModel
  ) {
    const selectedNodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

    if (
      !selectedNodeRecord ||
      !selectedCanvasIdForActions ||
      connectMode ||
      event.button !== 0
    ) {
      return;
    }

    const subtreeIds = collectSubtreeNodeIds(
      selectedGraph?.nodes ?? [],
      node.id as BrainstormNode["id"]
    );

    dragStateRef.current = {
      canvasId: selectedCanvasIdForActions,
      nodeId: node.id as BrainstormNode["id"],
      subtreeIds,
      originPositions: Object.fromEntries(
        (selectedGraph?.nodes ?? [])
          .filter((entry) => subtreeIds.includes(entry.id))
          .map((entry) => [entry.id, entry.position])
      ),
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      hasMoved: false
    };

    setSelectedNodeId(node.id as BrainstormNode["id"]);
    setDraggingNodeId(null);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    if (canvasView.nodes.length === 0) {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".brainstorm-node")
    ) {
      return;
    }

    panStateRef.current = {
      pointerStartX: event.clientX,
      pointerStartY: event.clientY,
      originX: viewportOffset.x,
      originY: viewportOffset.y,
      hasMoved: false
    };

    workspaceRef.current?.focus();
  }

  async function applyReparentTarget() {
    if (
      !connectMode ||
      !selectedNode ||
      !selectedCanvasIdForActions ||
      !selectedGraph ||
      !reparentTarget?.nodeId ||
      pendingAction === "mutation"
    ) {
      return;
    }

    if (
      reparentTarget.nodeId === selectedNode.id ||
      connectBlockedNodeIds.has(reparentTarget.nodeId)
    ) {
      setFeedback(null);
      setError("A node cannot be moved under one of its own descendants.");
      return;
    }

    try {
      setPendingAction("mutation");
      await gateway.updateNode({
        canvasId: selectedCanvasIdForActions,
        nodeId: selectedNode.id,
        ...deriveBrainstormReparentUpdate(selectedGraph, {
          nodeId: selectedNode.id,
          nextParentNodeId: reparentTarget.nodeId
        })
      });
      await refreshCanvasGraph(selectedCanvasIdForActions, {
        preferredSelectedNodeId: selectedNode.id
      });
      setFeedback(
        `Moved "${selectedNode.label}" under "${nodesById.get(reparentTarget.nodeId)?.label ?? "the selected parent"}".`
      );
      setError(null);
      setConnectMode(false);
      setReparentTarget(null);
      workspaceRef.current?.focus();
    } catch (requestError) {
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (editorState || isTypingTarget(event.target) || pendingAction === "mutation") {
      return;
    }

    switch (event.key) {
      case "c":
      case "C":
        event.preventDefault();
        openNodeEditor("create-child");
        break;
      case "a":
      case "A":
        event.preventDefault();
        openNodeEditor("create-sibling");
        break;
      case "n":
      case "N":
        if (!isGraphLoading) {
          event.preventDefault();
          openNodeEditor("create-root");
        }
        break;
      case "Enter":
        if (connectMode) {
          event.preventDefault();
          await applyReparentTarget();
        } else if (selectedNode) {
          event.preventDefault();
          openNodeEditor("edit");
        }
        break;
      case "ArrowLeft":
        if (connectMode) {
          event.preventDefault();
          setConnectMode(false);
          setReparentTarget(null);
        } else if (selectedNode) {
          event.preventDefault();
          await moveSelectedSubtree("left");
        }
        break;
      case "ArrowRight":
        if (connectMode) {
          event.preventDefault();
          await applyReparentTarget();
        } else if (selectedNode) {
          event.preventDefault();
          await moveSelectedSubtree("right");
        }
        break;
      case "ArrowUp":
        if (connectMode) {
          event.preventDefault();
          if (reparentCandidateNodeIds.length > 0) {
            const currentIndex = reparentTarget
              ? reparentCandidateNodeIds.indexOf(reparentTarget.nodeId)
              : 0;
            const nextIndex =
              currentIndex <= 0 ? reparentCandidateNodeIds.length - 1 : currentIndex - 1;
            const nextNodeId = reparentCandidateNodeIds[nextIndex];

            if (nextNodeId) {
              previewReparentTarget(nextNodeId);
            }
          }
        } else if (selectedNode) {
          event.preventDefault();
          await moveSelectedSubtree("up");
        }
        break;
      case "ArrowDown":
        if (connectMode) {
          event.preventDefault();
          if (reparentCandidateNodeIds.length > 0) {
            const currentIndex = reparentTarget
              ? reparentCandidateNodeIds.indexOf(reparentTarget.nodeId)
              : -1;
            const nextIndex =
              currentIndex >= reparentCandidateNodeIds.length - 1 ? 0 : currentIndex + 1;
            const nextNodeId = reparentCandidateNodeIds[nextIndex];

            if (nextNodeId) {
              previewReparentTarget(nextNodeId);
            }
          }
        } else if (selectedNode) {
          event.preventDefault();
          await moveSelectedSubtree("down");
        }
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
        if (selectedNode && reparentCandidateNodeIds.length > 0) {
          event.preventDefault();
          setConnectMode((current) => {
            const next = !current;
            if (!next) {
              setReparentTarget(null);
            }
            return next;
          });
        }
        break;
      case "Escape":
        event.preventDefault();
        setConnectMode(false);
        setReparentTarget(null);
        setEditorState(null);
        setSelectedNodeId(null);
        setFeedback(null);
        break;
      default:
        break;
    }
  }

  return (
    <article
      ref={workspaceRef}
      className="panel panel--clean brainstorm-page"
      onKeyDown={(event) => void handleKeyDown(event)}
      tabIndex={0}
    >
      {loading ? <p className="callout" role="status" aria-live="polite">Loading canvases…</p> : null}
      {error ? <p className="callout callout--error" role="alert">{error}</p> : null}
      {feedback ? <p className="callout" role="status" aria-live="polite">{feedback}</p> : null}

      <div className="brainstorm-layout">
        <aside className="brainstorm-sidebar">
          <section className="brainstorm-sidebar__section">
            <div className="brainstorm-sidebar__header">
              <strong>Canvases</strong>
              <span>{module?.status ?? "active"}</span>
            </div>
            <div className="brainstorm-canvas-list">
              {model.canvasSummaries.map((canvas) => (
                <button
                  key={canvas.id}
                  type="button"
                  aria-pressed={canvas.isSelected}
                  className={
                    canvas.isSelected
                      ? "brainstorm-canvas-list__item brainstorm-canvas-list__item--active"
                      : "brainstorm-canvas-list__item"
                  }
                  onClick={() => {
                    void selectCanvas(canvas.id);
                    workspaceRef.current?.focus();
                  }}
                >
                  <strong>{canvas.name}</strong>
                  <span>
                    {canvas.graphLoaded ? `${canvas.nodeCount} nodes` : "Open"}
                  </span>
                </button>
              ))}
            </div>

            <form className="brainstorm-canvas-create" onSubmit={(event) => void handleCreateCanvas(event)}>
              <input
                value={canvasName}
                onChange={(event) => setCanvasName(event.target.value)}
                placeholder="New canvas"
              />
              <button type="submit" disabled={pendingAction === "canvas"}>
                Add
              </button>
            </form>
          </section>

          <section className="brainstorm-sidebar__section">
            <div className="brainstorm-sidebar__header">
              <strong>Selection</strong>
              <span>{selectedNode ? selectedNode.category : "none"}</span>
            </div>
            {selectedNode ? (
              <div className="brainstorm-selection-card">
                <strong>{selectedNode.label}</strong>
                <span>{selectedNodeParentLabel}</span>
                {selectedNode.description ? <span>{selectedNode.description}</span> : null}
                <span>
                  {selectedNode.position.x}, {selectedNode.position.y}
                </span>
              </div>
            ) : (
              <p className="brainstorm-muted-copy">
                Select a node to edit it, move it under another node, or drag the whole branch.
              </p>
            )}

            <ul className="brainstorm-shortcuts">
              {connectMode ? (
                <>
                  <li>
                    <code>↑ ↓</code> choose parent
                  </li>
                  <li>
                    <code>Enter</code> apply move
                  </li>
                  <li>
                    <code>Esc</code> cancel
                  </li>
                </>
              ) : selectedNode ? (
                <>
                  <li>
                    <code>N</code> add root
                  </li>
                  <li>
                    <code>C</code> add child
                  </li>
                  <li>
                    <code>A</code> add sibling
                  </li>
                  <li>
                    <code>Enter</code> edit
                  </li>
                  <li>
                    <code>M</code> move under
                  </li>
                  <li>
                    <code>Delete</code> remove
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <code>N</code> add root
                  </li>
                  <li>Select a node to edit, reparent, or remove it.</li>
                </>
              )}
            </ul>
          </section>
        </aside>

        <section className="brainstorm-main">
          <div className="brainstorm-toolbar">
            <div className="brainstorm-toolbar__context">
              <strong>{selectedCanvas?.name ?? "No canvas selected"}</strong>
              <span>
                {selectedCanvas
                  ? `${selectedNodeCount} nodes • ${linkCount} links`
                  : "Create or select a canvas"}
              </span>
            </div>

            <div className="brainstorm-toolbar__actions">
              <button
                type="button"
                onClick={() => {
                  openNodeEditor("create-root");
                  workspaceRef.current?.focus();
                }}
                disabled={!selectedCanvasIdForActions || isGraphLoading || pendingAction === "mutation"}
              >
                Add root
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  openNodeEditor("create-child");
                  workspaceRef.current?.focus();
                }}
                disabled={!canMutateSelection}
              >
                Child
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  openNodeEditor("create-sibling");
                  workspaceRef.current?.focus();
                }}
                disabled={!canMutateSelection}
              >
                Sibling
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  openNodeEditor("edit");
                  workspaceRef.current?.focus();
                }}
                disabled={!canMutateSelection}
              >
                Edit
              </button>
              <button
                type="button"
                aria-pressed={connectMode}
                className={
                  connectMode
                    ? "skill-tree-toolbar__button skill-tree-toolbar__button--active"
                    : "skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                }
                onClick={() => {
                  setConnectMode((current) => {
                    const next = !current;
                    if (!next) {
                      setReparentTarget(null);
                    }
                    return next;
                  });
                  workspaceRef.current?.focus();
                }}
                disabled={!canMutateSelection || reparentCandidateNodeIds.length === 0}
              >
                {connectMode ? "Choose parent" : "Move under"}
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  setViewportOffset(
                    getViewResetOffset(canvasView.nodes, getCanvasViewportSize())
                  );
                  workspaceRef.current?.focus();
                }}
                disabled={canvasView.nodes.length === 0}
              >
                Reset view
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  void detachSelectedNode();
                }}
                disabled={!selectedNode?.parentNodeId || pendingAction === "mutation"}
              >
                Detach
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  void deleteSelectedNode();
                }}
                disabled={!canMutateSelection}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="brainstorm-toolbar__hint">
            {connectMode
              ? "Choose a new parent with the mouse or arrow keys, then press Enter or Right Arrow to apply. Escape cancels."
              : "Drag empty space to pan. Drag a node to move its whole branch. Child and sibling creation keep connections automatic and spaced."}
          </div>

          {graphLoadingId === selectedCanvasIdForActions ? (
            <p className="callout" role="status" aria-live="polite">Refreshing canvas…</p>
          ) : null}

          <div ref={canvasViewportRef}>
            <BrainstormCanvasSurface
              nodes={canvasView.nodes}
              edges={canvasView.edges}
              selectedNodeId={selectedNodeId ?? undefined}
              reparentTargetNodeId={reparentTarget?.nodeId}
              connectMode={connectMode}
              draggingNodeId={draggingNodeId ?? undefined}
              panning={isPanning}
              blockedNodeIds={connectBlockedNodeIds}
              viewportOffset={viewportOffset}
              emptyTitle={
                isGraphLoading
                  ? "Loading canvas"
                  : selectedCanvas
                    ? "Mind-map canvas"
                    : "Start a canvas"
              }
              emptyMessage={
                isGraphLoading
                  ? "Loading nodes and connections for this canvas…"
                  : selectedCanvas
                    ? "Add a root node to begin the mind-map. Children and sibling nodes stay connected automatically."
                    : "Create a canvas in the sidebar to begin your first mind-map."
              }
              loading={isGraphLoading}
              onCanvasClick={() => {
                if (suppressCanvasClickRef.current) {
                  suppressCanvasClickRef.current = false;
                  return;
                }
                setSelectedNodeId(null);
                setConnectMode(false);
                setReparentTarget(null);
                setFeedback(null);
                workspaceRef.current?.focus();
              }}
              onCanvasPointerDown={handleCanvasPointerDown}
              onEmptyPrimaryAction={
                selectedCanvasIdForActions && !isGraphLoading
                  ? () => openNodeEditor("create-root")
                  : undefined
              }
              onNodeClick={(node) => void handleNodeClick(node)}
              onNodeFocus={handleNodeFocus}
              onNodePointerDown={handleNodePointerDown}
              renderNodeMeta={(node) => {
                const nodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

                return nodeRecord?.parentNodeId
                  ? `Child of ${nodesById.get(nodeRecord.parentNodeId)?.label ?? "Unknown"}`
                  : "Top-level";
              }}
            />
          </div>

          <p className="brainstorm-footer-hint">
            {connectMode ? (
              <>
                Click or cycle to a valid parent, then use <code>Enter</code> or <code>→</code> to apply.
                <code>Esc</code> cancels move-under mode.
              </>
            ) : (
              <>
                Arrow keys move the selected branch. <code>C</code> creates a child, <code>A</code> creates a sibling,
                <code>N</code> creates a root, <code>Enter</code> edits, and <code>M</code> toggles move-under mode.
              </>
            )}
          </p>
        </section>
      </div>

      {editorState ? (
        <BrainstormNodeModal
          state={editorState}
          draft={editorDraft}
          dirty={!isSameNodeDraft(editorDraft, editorInitialDraft)}
          pending={pendingAction === "node"}
          parentLabel={
            editorState.mode === "create-child"
              ? selectedNode?.label
              : editorState.mode === "create-sibling"
                ? parentLabel
                : undefined
          }
          onDraftChange={setEditorDraft}
          onCancel={closeNodeEditor}
          onSubmit={() => {
            void submitNodeEditor();
          }}
        />
      ) : null}
    </article>
  );
}
