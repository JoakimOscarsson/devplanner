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
  sortGraphNodes,
  toGraphEdgeViewModel,
  toGraphNodeViewModel,
  type GraphNodeViewModel
} from "@pdp-helper/ui-graph";
import { gatewayUrl } from "../../lib/gateway";
import {
  GRAPH_MOVE_STEP,
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

function BrainstormNodeModal({
  state,
  draft,
  pending,
  parentLabel,
  onDraftChange,
  onCancel,
  onSubmit
}: {
  readonly state: NodeEditorState;
  readonly draft: NodeEditorDraft;
  readonly pending: boolean;
  readonly parentLabel?: string;
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
        pointerStartedOnBackdrop.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
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
  const [draggingNodeId, setDraggingNodeId] = useState<BrainstormNode["id"] | null>(null);
  const [editorState, setEditorState] = useState<NodeEditorState | null>(null);
  const [editorDraft, setEditorDraft] = useState<NodeEditorDraft>(createEmptyNodeDraft);
  const [viewportOffset, setViewportOffset] = useState({ x: 48, y: 36 });
  const workspaceRef = useRef<HTMLElement | null>(null);
  const snapshotRef = useRef<BrainstormSnapshot | null>(snapshot ?? null);
  const panStateRef = useRef<PanState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const didAutoFocusWorkspace = useRef(false);
  const refreshSequenceRef = useRef(0);

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
  const canvasView = selectedGraph
    ? {
        nodes: sortGraphNodes(selectedGraph.nodes).map(toGraphNodeViewModel),
        edges: selectedGraph.edges.map(toGraphEdgeViewModel)
      }
    : { nodes: [], edges: [] };
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
  const isGraphLoading =
    !!selectedCanvasIdForActions &&
    graphLoadingId === selectedCanvasIdForActions &&
    !selectedGraph;

  useEffect(() => {
    if (didAutoFocusWorkspace.current || loading || !selectedCanvas) {
      return;
    }

    didAutoFocusWorkspace.current = true;
    workspaceRef.current?.focus();
  }, [loading, selectedCanvas]);

  useEffect(() => {
    setViewportOffset({ x: 48, y: 36 });
    setConnectMode(false);
  }, [selectedCanvasIdForActions]);

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
    if (!panStateRef.current && !dragStateRef.current) {
      return;
    }

    const dragThreshold = 4;

    function handlePointerMove(event: PointerEvent) {
      const panState = panStateRef.current;
      const dragState = dragStateRef.current;

      if (panState) {
        setViewportOffset({
          x: Math.round(panState.originX + (event.clientX - panState.pointerStartX)),
          y: Math.round(panState.originY + (event.clientY - panState.pointerStartY))
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

      if (panState) {
        return;
      }

      setDraggingNodeId(null);

      if (!dragState || !dragState.hasMoved) {
        return;
      }

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

      try {
        const nodesToPersist = (resolvedGraph ?? graph).nodes.filter((node) =>
          dragState.subtreeIds.includes(node.id)
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

        setFeedback(`Moved "${nodesById.get(dragState.nodeId)?.label ?? "node"}".`);
      } catch (requestError) {
        setError(getErrorMessage(requestError));
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
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  function openNodeEditor(mode: NodeEditorMode) {
    if (!selectedCanvasIdForActions) {
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

    if (mode === "edit" && selectedNode) {
      setEditorState({
        mode,
        nodeId: selectedNode.id
      });
      setEditorDraft(createNodeDraftFromNode(selectedNode));
      return;
    }

    setEditorState({
      mode,
      ...(selectedNode ? { nodeId: selectedNode.id } : {})
    });
    setEditorDraft(createEmptyNodeDraft());
  }

  async function submitNodeEditor() {
    if (!editorState || !selectedCanvasIdForActions) {
      return;
    }

    const label = editorDraft.label.trim();

    if (!label && editorState.mode !== "edit") {
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
        setFeedback(`Updated "${label}".`);
      } else if (selectedGraph) {
        const response = onCreateNode
          ? await onCreateNode(
              deriveBrainstormCreateNodeInput(selectedGraph, {
                intent:
                  editorState.mode === "create-child"
                    ? "child"
                    : editorState.mode === "create-sibling"
                      ? "sibling"
                      : "root",
                anchorNodeId: editorState.nodeId,
                label,
                category: editorDraft.category
              })
            )
          : await gateway.createNode({
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
            });

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
      } else {
        setError("Select a loaded canvas before adding nodes.");
        return;
      }

      setEditorState(null);
      setEditorDraft(createEmptyNodeDraft());
      workspaceRef.current?.focus();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function moveSelectedSubtree(direction: "left" | "right" | "up" | "down") {
    const canvasId = selectedCanvasIdForActions;

    if (!canvasId || !selectedGraph || !selectedNode) {
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
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: selectedNode.id
      });
      setConnectMode(false);
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
      await refreshCanvasGraph(canvasId, {
        preferredSelectedNodeId: null
      });
      setFeedback(`Removed "${selectedNode.label}".`);
      setSelectedNodeId(null);
      setConnectMode(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleNodeClick(node: GraphNodeViewModel) {
    if (
      connectMode &&
      selectedNode &&
      selectedCanvasIdForActions &&
      node.id !== selectedNode.id &&
      selectedGraph
    ) {
      if (connectBlockedNodeIds.has(node.id as BrainstormNode["id"])) {
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
            nextParentNodeId: node.id as BrainstormNode["id"]
          })
        });
        await refreshCanvasGraph(selectedCanvasIdForActions, {
          preferredSelectedNodeId: selectedNode.id
        });
        setFeedback(`Moved "${selectedNode.label}" under "${node.label}".`);
        setConnectMode(false);
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

    if (!selectedNodeRecord || !selectedCanvasIdForActions || connectMode) {
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
    workspaceRef.current?.focus();
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
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
      originY: viewportOffset.y
    };

    workspaceRef.current?.focus();
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (editorState || isTypingTarget(event.target)) {
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
        event.preventDefault();
        openNodeEditor("create-root");
        break;
      case "Enter":
        if (selectedNode) {
          event.preventDefault();
          openNodeEditor("edit");
        }
        break;
      case "ArrowLeft":
        event.preventDefault();
        await moveSelectedSubtree("left");
        break;
      case "ArrowRight":
        event.preventDefault();
        await moveSelectedSubtree("right");
        break;
      case "ArrowUp":
        event.preventDefault();
        await moveSelectedSubtree("up");
        break;
      case "ArrowDown":
        event.preventDefault();
        await moveSelectedSubtree("down");
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
          setConnectMode((current) => !current);
        }
        break;
      case "Escape":
        event.preventDefault();
        setConnectMode(false);
        setEditorState(null);
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
      {loading ? <p className="callout">Loading canvases…</p> : null}
      {error ? <p className="callout callout--error">{error}</p> : null}
      {feedback ? <p className="callout">{feedback}</p> : null}

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
                  className={
                    canvas.isSelected
                      ? "brainstorm-canvas-list__item brainstorm-canvas-list__item--active"
                      : "brainstorm-canvas-list__item"
                  }
                  onClick={() => void selectCanvas(canvas.id)}
                >
                  <strong>{canvas.name}</strong>
                  <span>
                    {canvas.graphLoaded ? `${canvas.nodeCount} nodes` : "Load"}
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
                onClick={() => openNodeEditor("create-root")}
                disabled={!selectedCanvasIdForActions || isGraphLoading}
              >
                Add root
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => openNodeEditor("create-child")}
                disabled={!selectedNode}
              >
                Child
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => openNodeEditor("create-sibling")}
                disabled={!selectedNode}
              >
                Sibling
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => openNodeEditor("edit")}
                disabled={!selectedNode}
              >
                Edit
              </button>
              <button
                type="button"
                className={
                  connectMode
                    ? "skill-tree-toolbar__button skill-tree-toolbar__button--active"
                    : "skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                }
                onClick={() => setConnectMode((current) => !current)}
                disabled={!selectedNode}
              >
                {connectMode ? "Moving" : "Move under"}
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => setViewportOffset({ x: 48, y: 36 })}
              >
                Reset view
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => void detachSelectedNode()}
                disabled={!selectedNode?.parentNodeId}
              >
                Detach
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => void deleteSelectedNode()}
                disabled={!selectedNode}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="brainstorm-toolbar__hint">
            Drag empty space to pan. Drag a node to move its whole branch. Child and sibling creation
            keep connections automatic and spaced.
          </div>

          {graphLoadingId === selectedCanvasIdForActions ? (
            <p className="callout">Refreshing canvas…</p>
          ) : null}

          <BrainstormCanvasSurface
            nodes={canvasView.nodes}
            edges={canvasView.edges}
            selectedNodeId={selectedNodeId ?? undefined}
            connectMode={connectMode}
            draggingNodeId={draggingNodeId ?? undefined}
            blockedNodeIds={connectBlockedNodeIds}
            viewportOffset={viewportOffset}
            emptyTitle={isGraphLoading ? "Loading canvas" : "Mind-map canvas"}
            emptyMessage={
              isGraphLoading
                ? "Loading nodes and connections for this canvas…"
                : "Add a root node to begin the mind-map. Children and sibling nodes stay connected automatically."
            }
            loading={isGraphLoading}
            onCanvasClick={() => {
              setSelectedNodeId(null);
              setConnectMode(false);
              workspaceRef.current?.focus();
            }}
            onCanvasPointerDown={handleCanvasPointerDown}
            onNodeClick={(node) => void handleNodeClick(node)}
            onNodePointerDown={handleNodePointerDown}
            renderNodeMeta={(node) => {
              const nodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

              return nodeRecord?.parentNodeId
                ? `Child of ${nodesById.get(nodeRecord.parentNodeId)?.label ?? "Unknown"}`
                : "Top-level";
            }}
          />

          <p className="brainstorm-footer-hint">
            Arrow keys move the selected branch. <code>C</code> creates a child, <code>A</code> creates a sibling,
            <code>N</code> creates a root, <code>Enter</code> edits, and <code>M</code> toggles move-under mode.
          </p>
        </section>
      </div>

      {editorState ? (
        <BrainstormNodeModal
          state={editorState}
          draft={editorDraft}
          pending={pendingAction === "node"}
          parentLabel={
            editorState.mode === "create-child"
              ? selectedNode?.label
              : editorState.mode === "create-sibling"
                ? parentLabel
                : undefined
          }
          onDraftChange={setEditorDraft}
          onCancel={() => {
            setEditorState(null);
            workspaceRef.current?.focus();
          }}
          onSubmit={() => {
            void submitNodeEditor();
          }}
        />
      ) : null}
    </article>
  );
}
