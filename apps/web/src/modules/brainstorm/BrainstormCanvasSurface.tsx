import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type OnNodeDrag,
  type ReactFlowInstance,
  type Viewport
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";
import {
  BRAINSTORM_NODE_HEIGHT,
  BRAINSTORM_NODE_WIDTH
} from "./brainstorm-layout";

export interface BrainstormCanvasSurfaceHandle {
  fitView(): void;
  focusNode(nodeId: string): void;
}

export type BrainstormCanvasViewport = Viewport;

export interface BrainstormCanvasSurfaceProps {
  readonly viewKey: string;
  readonly nodes: readonly GraphNodeViewModel[];
  readonly edges: readonly GraphEdgeViewModel[];
  readonly selectedNodeId?: string;
  readonly reparentTargetNodeId?: string;
  readonly connectMode?: boolean;
  readonly blockedNodeIds?: ReadonlySet<string>;
  readonly emptyMessage: string;
  readonly emptyTitle?: string;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onCanvasClick?: () => void;
  readonly onEmptyPrimaryAction?: () => void;
  readonly onNodeClick?: (node: GraphNodeViewModel) => void;
  readonly onNodeDoubleClick?: (node: GraphNodeViewModel) => void;
  readonly onNodeFocus?: (node: GraphNodeViewModel) => void;
  readonly onNodeDrag?: (
    node: GraphNodeViewModel,
    position: { readonly x: number; readonly y: number }
  ) => void;
  readonly onNodeDragStop?: (
    node: GraphNodeViewModel,
    position: { readonly x: number; readonly y: number }
  ) => void;
  readonly onViewportChange?: (
    viewKey: string,
    viewport: BrainstormCanvasViewport
  ) => void;
  readonly getStoredViewport?: (
    viewKey: string
  ) => BrainstormCanvasViewport | undefined;
  readonly renderNodeMeta?: (node: GraphNodeViewModel) => ReactNode;
}

interface BrainstormRFNodeData extends Record<string, unknown> {
  readonly view: GraphNodeViewModel;
  readonly isSelected: boolean;
  readonly isReparentTarget: boolean;
  readonly isConnectOrigin: boolean;
  readonly isBlocked: boolean;
  readonly isDragging: boolean;
  readonly metaNode: ReactNode;
  readonly onFocusNode?: (node: GraphNodeViewModel) => void;
  readonly onClickNode?: (node: GraphNodeViewModel) => void;
  readonly onDoubleClickNode?: (node: GraphNodeViewModel) => void;
  readonly registerNodeElement?: (nodeId: string, element: HTMLDivElement | null) => void;
}

type BrainstormRFNode = Node<BrainstormRFNodeData, "brainstorm">;

const BrainstormNodeView = memo(function BrainstormNodeView({
  data
}: NodeProps<BrainstormRFNode>) {
  const { view, isSelected, isReparentTarget, isConnectOrigin, isBlocked, metaNode } =
    data;

  const className = [
    "brainstorm-node",
    `brainstorm-node--${view.colorToken}`,
    isSelected ? "brainstorm-node--selected" : "",
    isReparentTarget ? "brainstorm-node--reparent-target" : "",
    isConnectOrigin ? "brainstorm-node--connect-origin" : "",
    isBlocked ? "brainstorm-node--connect-blocked" : "",
    data.isDragging ? "brainstorm-node--dragging" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={(element) => {
        data.registerNodeElement?.(view.id, element);
      }}
      className={className}
      data-brainstorm-hotkeys="allow"
      aria-label={isSelected ? `${view.label}, selected` : view.label}
      role="button"
      tabIndex={0}
      onFocus={() => {
        data.onFocusNode?.(view);
      }}
      onClick={() => {
        data.onClickNode?.(view);
      }}
      onDoubleClick={() => {
        data.onDoubleClickNode?.(view);
      }}
      title={view.label}
      style={{
        width: BRAINSTORM_NODE_WIDTH,
        minHeight: BRAINSTORM_NODE_HEIGHT
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0, pointerEvents: "none" }}
        isConnectable={false}
      />
      <span className="brainstorm-node__label">{view.label}</span>
      <span className="brainstorm-node__meta">{view.category}</span>
      {metaNode ? <span className="brainstorm-node__submeta">{metaNode}</span> : null}
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0, pointerEvents: "none" }}
        isConnectable={false}
      />
    </div>
  );
});

const NODE_TYPES = { brainstorm: BrainstormNodeView } as const;

export const BrainstormCanvasSurface = forwardRef<
  BrainstormCanvasSurfaceHandle,
  BrainstormCanvasSurfaceProps
>(function BrainstormCanvasSurface(props, ref) {
  return (
    <ReactFlowProvider>
      <BrainstormCanvasFlow {...props} forwardedRef={ref} />
    </ReactFlowProvider>
  );
});

interface BrainstormCanvasFlowProps extends BrainstormCanvasSurfaceProps {
  readonly forwardedRef: React.ForwardedRef<BrainstormCanvasSurfaceHandle>;
}

function BrainstormCanvasFlow({
  viewKey,
  nodes,
  edges,
  selectedNodeId,
  reparentTargetNodeId,
  connectMode = false,
  blockedNodeIds,
  emptyMessage,
  emptyTitle = "Mind-map canvas",
  loading = false,
  disabled = false,
  onCanvasClick,
  onEmptyPrimaryAction,
  onNodeClick,
  onNodeDoubleClick,
  onNodeFocus,
  onNodeDrag,
  onNodeDragStop,
  onViewportChange,
  getStoredViewport,
  renderNodeMeta,
  forwardedRef
}: BrainstormCanvasFlowProps) {
  const reactFlow = useReactFlow();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const nodeElementRefs = useRef(new Map<string, HTMLDivElement>());
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;

  useEffect(() => {
    const query = window.matchMedia?.("(pointer: coarse)");
    if (!query) {
      return;
    }

    const updateCoarsePointer = () => {
      setCoarsePointer(query.matches);
    };

    updateCoarsePointer();
    query.addEventListener("change", updateCoarsePointer);
    return () => query.removeEventListener("change", updateCoarsePointer);
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      fitView() {
        reactFlow.fitView({ padding: 0.24, duration: 240 });
      },
      focusNode(nodeId: string) {
        nodeElementRefs.current.get(nodeId)?.focus();
      }
    }),
    [reactFlow]
  );

  const rfNodes = useMemo<BrainstormRFNode[]>(() => {
    return nodes.map((node) => ({
      id: node.id,
      type: "brainstorm",
      position: { x: node.position.x, y: node.position.y },
      draggable: !connectMode && !disabled && !coarsePointer,
      selectable: true,
      selected: node.id === selectedNodeId,
      data: {
        view: node,
        isSelected: node.id === selectedNodeId,
        isReparentTarget: node.id === reparentTargetNodeId,
        isConnectOrigin: connectMode && node.id === selectedNodeId,
        isBlocked: connectMode ? blockedNodeIds?.has(node.id) ?? false : false,
        isDragging: draggingNodeId === node.id,
        metaNode: renderNodeMeta ? renderNodeMeta(node) : null,
        onFocusNode: onNodeFocus,
        onClickNode: onNodeClick,
        onDoubleClickNode: onNodeDoubleClick,
        registerNodeElement(nodeId, element) {
          if (element) {
            nodeElementRefs.current.set(nodeId, element);
            return;
          }
          nodeElementRefs.current.delete(nodeId);
        }
      }
    }));
  }, [
    draggingNodeId,
    nodes,
    coarsePointer,
    selectedNodeId,
    reparentTargetNodeId,
    connectMode,
    disabled,
    blockedNodeIds,
    onNodeClick,
    onNodeDoubleClick,
    onNodeFocus,
    renderNodeMeta
  ]);

  const rfEdges = useMemo<Edge[]>(() => {
    const structural: Edge[] = [];
    const seen = new Set<string>();

    for (const node of nodes) {
      if (!node.parentNodeId) {
        continue;
      }
      const key = `parent-${node.id}`;
      seen.add(`${node.parentNodeId}->${node.id}`);
      structural.push({
        id: key,
        source: node.parentNodeId,
        target: node.id,
        type: "smoothstep",
        className: "brainstorm-edge brainstorm-edge--parent",
        focusable: false,
        deletable: false
      });
    }

    for (const edge of edges) {
      const key = `${edge.sourceNodeId}->${edge.targetNodeId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      structural.push({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        type: "smoothstep",
        className: "brainstorm-edge",
        focusable: false,
        deletable: false
      });
    }

    return structural;
  }, [nodes, edges]);

  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      const view = nodesRef.current.find((candidate) => candidate.id === node.id);
      if (view) {
        onNodeClick?.(view);
      }
    },
    [onNodeClick]
  );

  const handleNodeDrag = useCallback<OnNodeDrag>(
    (_event, node) => {
      const view = nodesRef.current.find((candidate) => candidate.id === node.id);
      if (view) {
        onNodeDrag?.(view, {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y)
        });
      }
    },
    [onNodeDrag]
  );

  const handleNodeDragStart = useCallback<OnNodeDrag>(
    (_event, node) => {
      setDraggingNodeId(node.id);
    },
    []
  );

  const handleNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
      setDraggingNodeId(null);
      const view = nodesRef.current.find((candidate) => candidate.id === node.id);
      if (view) {
        onNodeDragStop?.(view, {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y)
        });
      }
    },
    [onNodeDragStop]
  );

  const handlePaneClick = useCallback(() => {
    onCanvasClick?.();
  }, [onCanvasClick]);

  const handleEdgeClick = useCallback<EdgeMouseHandler>((event) => {
    event.stopPropagation();
  }, []);

  useEffect(() => {
    const viewport = getStoredViewport?.(viewKey);

    if (!viewport) {
      return;
    }

    const raf = requestAnimationFrame(() => {
      reactFlow.setViewport(viewport, { duration: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [getStoredViewport, reactFlow, viewKey]);

  const handleViewportChangeEnd = useCallback(
    (_event: MouseEvent | TouchEvent | null, viewport: Viewport) => {
      onViewportChange?.(viewKeyRef.current, viewport);
    },
    [onViewportChange]
  );

  return (
    <div
      className={[
        "brainstorm-canvas",
        connectMode ? "brainstorm-canvas--connect" : "",
        draggingNodeId ? "brainstorm-canvas--panning" : "",
        nodes.length === 0 ? "brainstorm-canvas--empty" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onNodeDrag={handleNodeDrag}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onEdgeClick={handleEdgeClick}
        onMoveEnd={handleViewportChangeEnd}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        panOnDrag={!disabled}
        panOnScroll={false}
        zoomOnScroll
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
      </ReactFlow>
      {nodes.length === 0 ? (
        <div
          className="brainstorm-canvas__empty"
        >
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {onEmptyPrimaryAction ? (
            <button
              type="button"
              className="brainstorm-canvas__empty-action"
              onClick={(event) => {
                event.stopPropagation();
                onEmptyPrimaryAction();
              }}
              disabled={loading}
            >
              Add root
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type { ReactFlowInstance };
