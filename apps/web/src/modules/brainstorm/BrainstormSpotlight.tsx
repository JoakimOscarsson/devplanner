import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import { type GraphNodeViewModel } from "@pdp-helper/ui-graph";
import { gatewayUrl } from "../../lib/gateway";
import {
  BrainstormCanvasSurface,
  type BrainstormCanvasSurfaceHandle
} from "./BrainstormCanvasSurface";
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
  formatTagList,
  parseTagList,
  readBrainstormNodeTags,
  type BrainstormCanvasGraph,
  type BrainstormSnapshot
} from "./brainstorm-model";
import { layoutBrainstormGraph } from "./brainstorm-layout";
import {
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
  readonly tag: string;
  readonly description: string;
}

interface ReparentTargetState {
  readonly nodeId: BrainstormNode["id"];
}

interface DragPreviewState {
  readonly canvasId: BrainstormCanvas["id"];
  readonly rootNodeId: BrainstormNode["id"];
  readonly movedNodeIds: readonly BrainstormNode["id"][];
  readonly originPositions: ReadonlyMap<BrainstormNode["id"], BrainstormPosition>;
}

interface ConfirmState {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly tone?: "danger" | "neutral";
  readonly onConfirm: () => void;
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
    tagName === "a" ||
    target.isContentEditable
  );
}

function createEmptyNodeDraft(): NodeEditorDraft {
  return {
    label: "",
    tag: "skill",
    description: ""
  };
}

function createNodeDraftFromNode(node: BrainstormNode): NodeEditorDraft {
  return {
    label: node.label,
    tag: formatTagList(readBrainstormNodeTags(node)),
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

function applyPositions(
  graph: BrainstormCanvasGraph,
  positions: ReadonlyMap<string, BrainstormPosition>
): BrainstormCanvasGraph {
  let changed = false;
  const nextNodes = graph.nodes.map((node) => {
    const next = positions.get(node.id);
    if (!next) {
      return node;
    }
    if (next.x === node.position.x && next.y === node.position.y) {
      return node;
    }
    changed = true;
    return { ...node, position: next };
  });
  return changed ? { ...graph, nodes: nextNodes } : graph;
}

function collectDescendantNodeIds(
  nodes: readonly BrainstormNode[],
  rootNodeId: BrainstormNode["id"]
): ReadonlySet<BrainstormNode["id"]> {
  const childrenByParent = new Map<string, BrainstormNode["id"][]>();
  for (const node of nodes) {
    if (!node.parentNodeId) continue;
    const bucket = childrenByParent.get(node.parentNodeId) ?? [];
    bucket.push(node.id);
    childrenByParent.set(node.parentNodeId, bucket);
  }
  const descendants = new Set<BrainstormNode["id"]>();
  const queue: BrainstormNode["id"][] = [rootNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const child of childrenByParent.get(current) ?? []) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    }
  }
  return descendants;
}

function shiftNodePositions(
  graph: BrainstormCanvasGraph,
  nodeIds: ReadonlySet<BrainstormNode["id"]>,
  delta: BrainstormPosition,
  originPositions?: ReadonlyMap<BrainstormNode["id"], BrainstormPosition>
): BrainstormCanvasGraph {
  const positions = new Map<BrainstormNode["id"], BrainstormPosition>();

  for (const node of graph.nodes) {
    if (!nodeIds.has(node.id)) {
      continue;
    }

    const origin = originPositions?.get(node.id) ?? node.position;
    positions.set(node.id, {
      x: Math.round(origin.x + delta.x),
      y: Math.round(origin.y + delta.y)
    });
  }

  return applyPositions(graph, positions);
}

function compareCanvasNodes(left: GraphNodeViewModel, right: GraphNodeViewModel) {
  if (left.position.x !== right.position.x) {
    return left.position.x - right.position.x;
  }
  if (left.position.y !== right.position.y) {
    return left.position.y - right.position.y;
  }
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base" });
}

function isSameNodeDraft(left: NodeEditorDraft, right: NodeEditorDraft) {
  return (
    left.label === right.label &&
    left.tag === right.tag &&
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
            <span>Tags</span>
            <input
              value={draft.tag}
              placeholder="e.g. skill, research"
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  tag: event.target.value
                })
              }
            />
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

function BrainstormConfirmModal({
  state,
  onCancel,
  pending = false
}: {
  readonly state: ConfirmState;
  readonly onCancel: () => void;
  readonly pending?: boolean;
}) {
  return (
    <div className="brainstorm-modal-backdrop" role="presentation">
      <div
        className="brainstorm-modal brainstorm-modal--confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="brainstorm-confirm-title"
        aria-describedby="brainstorm-confirm-message"
      >
        <div className="brainstorm-modal__header">
          <h2 id="brainstorm-confirm-title">{state.title}</h2>
          <p id="brainstorm-confirm-message">{state.message}</p>
        </div>
        <div className="brainstorm-modal__actions">
          <button type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            className={
              state.tone === "danger"
                ? "brainstorm-modal__danger"
                : undefined
            }
            onClick={state.onConfirm}
            disabled={pending}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
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
  const [editorState, setEditorState] = useState<NodeEditorState | null>(null);
  const [editorDraft, setEditorDraft] = useState<NodeEditorDraft>(createEmptyNodeDraft);
  const [editorInitialDraft, setEditorInitialDraft] = useState<NodeEditorDraft>(
    createEmptyNodeDraft
  );
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const canvasHandleRef = useRef<BrainstormCanvasSurfaceHandle | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const didAutoFocusWorkspace = useRef(false);
  const refreshSequenceRef = useRef(0);
  const dragPreviewRef = useRef<DragPreviewState | null>(null);
  const dragRequestSequenceRef = useRef(0);

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
  const connectBlockedNodeIds = useMemo(() => {
    if (!selectedNode || !selectedGraph) {
      return new Set<BrainstormNode["id"]>();
    }
    const descendants = new Set(
      collectDescendantNodeIds(selectedGraph.nodes, selectedNode.id)
    );
    descendants.add(selectedNode.id);
    return descendants;
  }, [selectedGraph, selectedNode]);
  const orderedNodeIds = useMemo(
    () =>
      [...canvasView.nodes]
        .sort(compareCanvasNodes)
        .map((node) => node.id as BrainstormNode["id"]),
    [canvasView.nodes]
  );
  const reparentCandidateNodeIds = useMemo(
    () =>
      [...canvasView.nodes]
        .sort(compareCanvasNodes)
        .map((node) => node.id)
        .filter(
          (nodeId) => !connectBlockedNodeIds.has(nodeId as BrainstormNode["id"])
        ) as BrainstormNode["id"][],
    [canvasView.nodes, connectBlockedNodeIds]
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
    setConnectMode(false);
    setReparentTarget(null);
  }, [selectedCanvasIdForActions]);

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

  async function refreshCanvasGraph(
    canvasId: BrainstormCanvas["id"],
    options: {
      readonly preferredSelectedNodeId?: BrainstormNode["id"] | null;
      readonly autoLayout?: boolean;
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

      const laidOut = options.autoLayout
        ? await runAutoLayout(canvasGraph)
        : canvasGraph;

      setLocalSnapshot((current) =>
        mergeCanvasGraph(
          current ?? EMPTY_BRAINSTORM_SNAPSHOT,
          laidOut,
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

  async function runAutoLayout(
    graph: BrainstormCanvasGraph
  ): Promise<BrainstormCanvasGraph> {
    if (graph.nodes.length === 0) {
      return graph;
    }

    const positions = await layoutBrainstormGraph(graph.nodes, graph.edges);
    const positionsById = new Map(
      positions.map((entry) => [entry.id, { x: entry.x, y: entry.y }] as const)
    );

    const changed = applyPositions(graph, positionsById);
    if (changed === graph) {
      return graph;
    }

    await Promise.all(
      changed.nodes
        .filter((node) => {
          const original = graph.nodes.find((entry) => entry.id === node.id);
          return (
            original &&
            (original.position.x !== node.position.x ||
              original.position.y !== node.position.y)
          );
        })
        .map((node) =>
          gateway.updateNode({
            canvasId: graph.canvas.id,
            nodeId: node.id,
            position: node.position
          })
        )
    );

    return changed;
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
      const nextSelectedNodeId =
        [...activeSnapshot.graphsByCanvasId[canvasId].nodes]
          .sort((left, right) => {
            if (left.position.x !== right.position.x) {
              return left.position.x - right.position.x;
            }
            if (left.position.y !== right.position.y) {
              return left.position.y - right.position.y;
            }
            return left.label.localeCompare(right.label, undefined, {
              sensitivity: "base"
            });
          })[0]?.id ?? null;
      setSelectedNodeId(nextSelectedNodeId);
      focusCanvasNode(nextSelectedNodeId);
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
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  function focusCanvasNode(nodeId: BrainstormNode["id"] | null) {
    if (!nodeId) {
      return;
    }
    requestAnimationFrame(() => {
      canvasHandleRef.current?.focusNode(nodeId);
    });
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
  }

  function closeNodeEditor() {
    if (pendingAction === "node") {
      return;
    }

    if (!isSameNodeDraft(editorDraft, editorInitialDraft)) {
      setConfirmState({
        title: "Discard changes?",
        message: "Your unsaved node edits will be lost.",
        confirmLabel: "Discard",
        onConfirm() {
          setConfirmState(null);
          setEditorState(null);
          setEditorDraft(createEmptyNodeDraft());
          setEditorInitialDraft(createEmptyNodeDraft());
          restoreFocusAfterEditorClose();
        }
      });
      return;
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
          tag: formatTagList(parseTagList(editorDraft.tag)),
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
            tag: formatTagList(parseTagList(editorDraft.tag))
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

    const descendantCount = collectDescendantNodeIds(
      selectedGraph?.nodes ?? [],
      selectedNode.id
    ).size;
    const directChildCount =
      selectedGraph?.nodes.filter((node) => node.parentNodeId === selectedNode.id).length ?? 0;

    setConfirmState({
      title: `Delete "${selectedNode.label}"?`,
      message:
        directChildCount > 0
          ? `${directChildCount} direct child node${directChildCount === 1 ? "" : "s"} will move to the root level.${descendantCount > directChildCount ? " Deeper descendants stay nested under those moved children." : ""}`
          : "This removes the selected node from the canvas.",
      confirmLabel: "Delete",
      tone: "danger",
      onConfirm() {
        setConfirmState(null);
        void (async () => {
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
          } catch (requestError) {
            setError(getErrorMessage(requestError));
          } finally {
            setPendingAction(null);
          }
        })();
      }
    });
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
    focusCanvasNode(node.id as BrainstormNode["id"]);
    if (connectMode) {
      setReparentTarget({ nodeId: node.id as BrainstormNode["id"] });
    }
    setError(null);
    setFeedback(null);
  }

  const handleNodeFocus = useCallback((node: GraphNodeViewModel) => {
    setSelectedNodeId(node.id as BrainstormNode["id"]);
    setError(null);
    setFeedback(null);
  }, []);

  const handleNodeDrag = useCallback(
    (
      node: GraphNodeViewModel,
      position: { readonly x: number; readonly y: number }
    ) => {
      const canvasId = selectedCanvasIdForActions;
      if (!canvasId || pendingAction === "mutation") {
        return;
      }

      setSelectedNodeId(node.id as BrainstormNode["id"]);
      setLocalSnapshot((current) => {
        if (!current) {
          return current;
        }

        const graph = current.graphsByCanvasId[canvasId];
        if (!graph) {
          return current;
        }

        const preview =
          dragPreviewRef.current?.rootNodeId === (node.id as BrainstormNode["id"]) &&
          dragPreviewRef.current.canvasId === canvasId
            ? dragPreviewRef.current
            : (() => {
                const movedNodeIds = [
                  node.id as BrainstormNode["id"],
                  ...collectDescendantNodeIds(graph.nodes, node.id as BrainstormNode["id"])
                ];
                const originPositions = new Map<BrainstormNode["id"], BrainstormPosition>(
                  graph.nodes
                    .filter((entry) => movedNodeIds.includes(entry.id))
                    .map((entry) => [entry.id, entry.position] as const)
                );
                const nextPreview: DragPreviewState = {
                  canvasId,
                  rootNodeId: node.id as BrainstormNode["id"],
                  movedNodeIds,
                  originPositions
                };
                dragPreviewRef.current = nextPreview;
                return nextPreview;
              })();

        const rootOrigin = preview.originPositions.get(node.id as BrainstormNode["id"]);
        if (!rootOrigin) {
          return current;
        }

        const nextGraph = shiftNodePositions(
          graph,
          new Set(preview.movedNodeIds),
          {
            x: position.x - rootOrigin.x,
            y: position.y - rootOrigin.y
          },
          preview.originPositions
        );

        return nextGraph === graph ? current : mergeCanvasGraph(current, nextGraph);
      });
    },
    [pendingAction, selectedCanvasIdForActions]
  );

  const handleNodeDragStop = useCallback(
    async (
      node: GraphNodeViewModel,
      _position: { readonly x: number; readonly y: number }
    ) => {
      const canvasId = selectedCanvasIdForActions;
      if (!canvasId || pendingAction === "mutation") {
        return;
      }

      const preview = dragPreviewRef.current;
      dragPreviewRef.current = null;
      const activeGraph = localSnapshot?.graphsByCanvasId[canvasId];
      if (!activeGraph) {
        return;
      }

      const changedNodes =
        preview &&
        preview.canvasId === canvasId &&
        preview.rootNodeId === (node.id as BrainstormNode["id"])
          ? activeGraph.nodes.filter((entry) => preview.movedNodeIds.includes(entry.id))
          : activeGraph.nodes.filter((entry) => entry.id === node.id);

      const requestSequence = dragRequestSequenceRef.current + 1;
      dragRequestSequenceRef.current = requestSequence;

      try {
        await Promise.all(
          changedNodes.map((entry) =>
            gateway.updateNode({
              canvasId,
              nodeId: entry.id,
              position: entry.position
            })
          )
        );
      } catch (requestError) {
        if (dragRequestSequenceRef.current !== requestSequence) {
          return;
        }
        setError(getErrorMessage(requestError));
        await refreshCanvasGraph(canvasId, {
          preferredSelectedNodeId: node.id as BrainstormNode["id"]
        });
      }
    },
    [gateway, localSnapshot, pendingAction, selectedCanvasIdForActions]
  );

  async function applyReparentTarget(
    nextTargetNodeId?: BrainstormNode["id"]
  ) {
    if (
      !connectMode ||
      !selectedNode ||
      !selectedCanvasIdForActions ||
      !selectedGraph ||
      !(nextTargetNodeId ?? reparentTarget?.nodeId) ||
      pendingAction === "mutation"
    ) {
      return;
    }

    const targetNodeId = nextTargetNodeId ?? reparentTarget?.nodeId;

    if (
      !targetNodeId ||
      targetNodeId === selectedNode.id ||
      connectBlockedNodeIds.has(targetNodeId)
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
          nextParentNodeId: targetNodeId
        })
      });
      await refreshCanvasGraph(selectedCanvasIdForActions, {
        preferredSelectedNodeId: selectedNode.id
      });
      setFeedback(
        `Moved "${selectedNode.label}" under "${nodesById.get(targetNodeId)?.label ?? "the selected parent"}".`
      );
      setError(null);
      setConnectMode(false);
      setReparentTarget(null);
    } catch (requestError) {
      setFeedback(null);
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function tidyLayout() {
    const canvasId = selectedCanvasIdForActions;
    if (!canvasId || !selectedGraph || pendingAction === "mutation") {
      return;
    }
    setPendingAction("mutation");
    try {
      const laidOut = await runAutoLayout(selectedGraph);
      setLocalSnapshot((current) =>
        current ? mergeCanvasGraph(current, laidOut) : current
      );
      setFeedback("Tidied the canvas.");
      setError(null);
      canvasHandleRef.current?.fitView();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (editorState || isTypingTarget(event.target) || pendingAction === "mutation") {
      return;
    }

    const selectRelativeNode = (direction: "previous" | "next") => {
      if (orderedNodeIds.length === 0) {
        return;
      }

      if (!selectedNodeId) {
        const nextNodeId =
          direction === "next"
            ? orderedNodeIds[0] ?? null
            : orderedNodeIds[orderedNodeIds.length - 1] ?? null;
        setSelectedNodeId(nextNodeId);
        focusCanvasNode(nextNodeId);
        return;
      }

      const currentIndex = orderedNodeIds.indexOf(selectedNodeId);
      if (currentIndex === -1) {
        const firstNodeId = orderedNodeIds[0] ?? null;
        setSelectedNodeId(firstNodeId);
        focusCanvasNode(firstNodeId);
        return;
      }

      const nextIndex =
        direction === "next"
          ? (currentIndex + 1) % orderedNodeIds.length
          : (currentIndex - 1 + orderedNodeIds.length) % orderedNodeIds.length;
      const nextNodeId = orderedNodeIds[nextIndex] ?? null;
      setSelectedNodeId(nextNodeId);
      focusCanvasNode(nextNodeId);
    };

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
        } else {
          event.preventDefault();
          selectRelativeNode("previous");
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
        } else {
          event.preventDefault();
          selectRelativeNode("next");
        }
        break;
      case "ArrowLeft":
        if (connectMode) {
          event.preventDefault();
          setConnectMode(false);
          setReparentTarget(null);
        } else if (selectedNode?.parentNodeId) {
          event.preventDefault();
          setSelectedNodeId(selectedNode.parentNodeId);
          focusCanvasNode(selectedNode.parentNodeId);
        }
        break;
      case "ArrowRight":
        if (connectMode) {
          event.preventDefault();
          await applyReparentTarget();
        } else if (selectedNode && selectedGraph) {
          const firstChild = selectedGraph.nodes
            .filter((node) => node.parentNodeId === selectedNode.id)
            .sort((left, right) => {
              if (left.position.x !== right.position.x) {
                return left.position.x - right.position.x;
              }
              if (left.position.y !== right.position.y) {
                return left.position.y - right.position.y;
              }
              return left.label.localeCompare(right.label, undefined, {
                sensitivity: "base"
              });
            })[0];

          if (firstChild) {
            event.preventDefault();
            setSelectedNodeId(firstChild.id);
            focusCanvasNode(firstChild.id);
          }
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
        if (editorState) {
          closeNodeEditor();
          break;
        }
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
              <span>
                {selectedNode ? formatTagList(readBrainstormNodeTags(selectedNode)) || "untagged" : "none"}
              </span>
            </div>
            {selectedNode ? (
              <div className="brainstorm-selection-card">
                <strong>{selectedNode.label}</strong>
                <span>{selectedNodeParentLabel}</span>
                <span>{formatTagList(readBrainstormNodeTags(selectedNode)) || "Untagged"}</span>
                {selectedNode.description ? <span>{selectedNode.description}</span> : null}
              </div>
            ) : (
              <p className="brainstorm-muted-copy">
                Select a node to edit it, move it under another node, or drag the branch together.
              </p>
            )}

            <ul className="brainstorm-shortcuts">
              {connectMode ? (
                <>
                  <li><code>↑ ↓</code> choose parent</li>
                  <li><code>Enter</code> apply move</li>
                  <li><code>Esc</code> cancel</li>
                </>
              ) : selectedNode ? (
                <>
                  <li><code>N</code> add root</li>
                  <li><code>C</code> add child</li>
                  <li><code>A</code> add sibling</li>
                  <li><code>Enter</code> edit</li>
                  <li><code>M</code> move under</li>
                  <li><code>Delete</code> remove</li>
                </>
              ) : (
                <>
                  <li><code>N</code> add root</li>
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
                  if (connectMode && reparentTarget?.nodeId) {
                    void applyReparentTarget();
                    return;
                  }
                  setConnectMode((current) => {
                    const next = !current;
                    if (!next) {
                      setReparentTarget(null);
                    }
                    return next;
                  });
                }}
                disabled={!canMutateSelection || reparentCandidateNodeIds.length === 0}
              >
                {connectMode ? "Apply move" : "Move under"}
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  void tidyLayout();
                }}
                disabled={!selectedGraph || selectedGraph.nodes.length === 0 || pendingAction === "mutation"}
              >
                Tidy layout
              </button>
              <button
                type="button"
                className="skill-tree-toolbar__button skill-tree-toolbar__button--secondary"
                onClick={() => {
                  canvasHandleRef.current?.fitView();
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
              ? "Click or tap a node to preview the new parent, then use Apply move, Enter, or Right Arrow to confirm. Escape cancels."
              : "Drag empty space to pan. Pinch or scroll to zoom. Drag a node to move its branch; Tidy layout re-flows everything."}
          </div>

          {graphLoadingId === selectedCanvasIdForActions ? (
            <p className="callout" role="status" aria-live="polite">Refreshing canvas…</p>
          ) : null}

          <BrainstormCanvasSurface
            ref={canvasHandleRef}
            viewKey={selectedCanvasIdForActions ?? "none"}
            nodes={canvasView.nodes}
            edges={canvasView.edges}
            selectedNodeId={selectedNodeId ?? undefined}
            reparentTargetNodeId={reparentTarget?.nodeId}
            connectMode={connectMode}
            blockedNodeIds={connectBlockedNodeIds}
            disabled={pendingAction === "mutation"}
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
              setSelectedNodeId(null);
              setConnectMode(false);
              setReparentTarget(null);
              setFeedback(null);
            }}
            onEmptyPrimaryAction={
              selectedCanvasIdForActions && !isGraphLoading
                ? () => openNodeEditor("create-root")
                : undefined
            }
            onNodeClick={(node) => void handleNodeClick(node)}
            onNodeFocus={handleNodeFocus}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            renderNodeMeta={(node) => {
              const nodeRecord = nodesById.get(node.id as BrainstormNode["id"]);

              return nodeRecord?.parentNodeId
                ? `Child of ${nodesById.get(nodeRecord.parentNodeId)?.label ?? "Unknown"}`
                : "Top-level";
            }}
          />

          <p className="brainstorm-footer-hint">
            {connectMode ? (
              <>
                Click or cycle to a valid parent, then use <code>Enter</code> or <code>→</code> to apply.
                <code>Esc</code> cancels move-under mode.
              </>
            ) : (
              <>
                <code>C</code> creates a child, <code>A</code> creates a sibling,
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
      {confirmState ? (
        <BrainstormConfirmModal
          state={confirmState}
          onCancel={() => {
            if (pendingAction === "mutation") {
              return;
            }
            setConfirmState(null);
          }}
          pending={pendingAction === "mutation"}
        />
      ) : null}
    </article>
  );
}
