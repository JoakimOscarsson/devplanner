import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ReactNode
} from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
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
  type ReactFlowInstance
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";
import {
  BRAINSTORM_NODE_HEIGHT,
  BRAINSTORM_NODE_WIDTH
} from "./brainstorm-layout";

export interface BrainstormCanvasSurfaceHandle {
  fitView(): void;
}

export interface BrainstormCanvasSurfaceProps {
  readonly nodes: readonly GraphNodeViewModel[];
  readonly edges: readonly GraphEdgeViewModel[];
  readonly selectedNodeId?: string;
  readonly reparentTargetNodeId?: string;
  readonly connectMode?: boolean;
  readonly blockedNodeIds?: ReadonlySet<string>;
  readonly emptyMessage: string;
  readonly emptyTitle?: string;
  readonly loading?: boolean;
  readonly onCanvasClick?: () => void;
  readonly onEmptyPrimaryAction?: () => void;
  readonly onNodeClick?: (node: GraphNodeViewModel) => void;
  readonly onNodeDragStop?: (
    node: GraphNodeViewModel,
    position: { readonly x: number; readonly y: number }
  ) => void;
  readonly renderNodeMeta?: (node: GraphNodeViewModel) => ReactNode;
}

interface BrainstormRFNodeData extends Record<string, unknown> {
  readonly view: GraphNodeViewModel;
  readonly isSelected: boolean;
  readonly isReparentTarget: boolean;
  readonly isConnectOrigin: boolean;
  readonly isBlocked: boolean;
  readonly metaNode: ReactNode;
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
    isBlocked ? "brainstorm-node--connect-blocked" : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      data-brainstorm-hotkeys="allow"
      aria-label={isSelected ? `${view.label}, selected` : view.label}
      style={{
        width: BRAINSTORM_NODE_WIDTH,
        minHeight: BRAINSTORM_NODE_HEIGHT
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ opacity: 0, pointerEvents: "none" }}
        isConnectable={false}
      />
      <span className="brainstorm-node__label">{view.label}</span>
      <span className="brainstorm-node__meta">{view.category}</span>
      {metaNode ? <span className="brainstorm-node__submeta">{metaNode}</span> : null}
      <Handle
        type="source"
        position={Position.Bottom}
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
  nodes,
  edges,
  selectedNodeId,
  reparentTargetNodeId,
  connectMode = false,
  blockedNodeIds,
  emptyMessage,
  emptyTitle = "Mind-map canvas",
  loading = false,
  onCanvasClick,
  onEmptyPrimaryAction,
  onNodeClick,
  onNodeDragStop,
  renderNodeMeta,
  forwardedRef
}: BrainstormCanvasFlowProps) {
  const reactFlow = useReactFlow();
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useImperativeHandle(
    forwardedRef,
    () => ({
      fitView() {
        reactFlow.fitView({ padding: 0.24, duration: 240 });
      }
    }),
    [reactFlow]
  );

  const rfNodes = useMemo<BrainstormRFNode[]>(() => {
    return nodes.map((node) => ({
      id: node.id,
      type: "brainstorm",
      position: { x: node.position.x, y: node.position.y },
      draggable: !connectMode,
      selectable: true,
      selected: node.id === selectedNodeId,
      data: {
        view: node,
        isSelected: node.id === selectedNodeId,
        isReparentTarget: node.id === reparentTargetNodeId,
        isConnectOrigin: connectMode && node.id === selectedNodeId,
        isBlocked: connectMode ? blockedNodeIds?.has(node.id) ?? false : false,
        metaNode: renderNodeMeta ? renderNodeMeta(node) : null
      }
    }));
  }, [
    nodes,
    selectedNodeId,
    reparentTargetNodeId,
    connectMode,
    blockedNodeIds,
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

  const handleNodeDragStop = useCallback<OnNodeDrag>(
    (_event, node) => {
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

  // Fit view once when node set appears from empty.
  const hadNodesRef = useRef(false);
  useEffect(() => {
    if (nodes.length === 0) {
      hadNodesRef.current = false;
      return;
    }
    if (hadNodesRef.current) {
      return;
    }
    hadNodesRef.current = true;
    const raf = requestAnimationFrame(() => {
      reactFlow.fitView({ padding: 0.24, duration: 0 });
    });
    return () => cancelAnimationFrame(raf);
  }, [nodes.length, reactFlow]);

  if (nodes.length === 0) {
    return (
      <div
        className="brainstorm-canvas brainstorm-canvas--empty"
        onClick={onCanvasClick}
      >
        <div className="brainstorm-canvas__empty">
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
      </div>
    );
  }

  return (
    <div
      className={[
        "brainstorm-canvas",
        connectMode ? "brainstorm-canvas--connect" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        onEdgeClick={handleEdgeClick}
        nodesConnectable={false}
        elementsSelectable
        selectNodesOnDrag={false}
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.24 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel="Brainstorm minimap" />
      </ReactFlow>
    </div>
  );
}

export type { ReactFlowInstance };
