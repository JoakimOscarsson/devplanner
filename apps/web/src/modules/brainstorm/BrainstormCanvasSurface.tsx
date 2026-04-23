import type { PointerEvent, ReactNode } from "react";
import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";
import {
  getConnectionPath,
  getGraphCanvasBounds,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  toCanvasCoordinates
} from "../../lib/graph-canvas-helpers";

export interface BrainstormCanvasSurfaceProps {
  readonly nodes: readonly GraphNodeViewModel[];
  readonly edges: readonly GraphEdgeViewModel[];
  readonly selectedNodeId?: string;
  readonly reparentTargetNodeId?: string;
  readonly connectMode?: boolean;
  readonly draggingNodeId?: string;
  readonly panning?: boolean;
  readonly blockedNodeIds?: ReadonlySet<string>;
  readonly viewportOffset: {
    readonly x: number;
    readonly y: number;
  };
  readonly emptyMessage: string;
  readonly emptyTitle?: string;
  readonly loading?: boolean;
  readonly onCanvasClick?: () => void;
  readonly onCanvasPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  readonly onEmptyPrimaryAction?: () => void;
  readonly onNodeClick?: (node: GraphNodeViewModel) => void;
  readonly onNodePointerDown?: (
    event: PointerEvent<HTMLButtonElement>,
    node: GraphNodeViewModel
  ) => void;
  readonly renderNodeMeta?: (node: GraphNodeViewModel) => ReactNode;
}

export function BrainstormCanvasSurface({
  nodes,
  edges,
  selectedNodeId,
  reparentTargetNodeId,
  connectMode = false,
  draggingNodeId,
  panning = false,
  blockedNodeIds,
  viewportOffset,
  emptyMessage,
  emptyTitle = "Mind-map canvas",
  loading = false,
  onCanvasClick,
  onCanvasPointerDown,
  onEmptyPrimaryAction,
  onNodeClick,
  onNodePointerDown,
  renderNodeMeta
}: BrainstormCanvasSurfaceProps) {
  if (nodes.length === 0) {
    return (
      <div
        className="brainstorm-canvas brainstorm-canvas--empty"
        onClick={onCanvasClick}
        onPointerDown={onCanvasPointerDown}
      >
        <div className="brainstorm-canvas__empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyMessage}</p>
          {onEmptyPrimaryAction ? (
            <button
              type="button"
              className="brainstorm-canvas__empty-action"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onEmptyPrimaryAction();
              }}
            >
              Add root
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const bounds = getGraphCanvasBounds(nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));

  return (
    <div
      className={[
        "brainstorm-canvas",
        connectMode ? "brainstorm-canvas--connect" : "",
        panning ? "brainstorm-canvas--panning" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={onCanvasClick}
      onPointerDown={onCanvasPointerDown}
    >
      <svg
        className="brainstorm-canvas__wires"
        width={bounds.width}
        height={bounds.height}
        viewBox={`0 0 ${bounds.width} ${bounds.height}`}
        aria-hidden="true"
      >
        {edges.map((edge) => {
          const path = getConnectionPath({ edge, nodesById, bounds });

          if (!path) {
            return null;
          }

          return (
            <path
              key={edge.id}
              d={path}
              className="brainstorm-canvas__wire"
              style={{
                transform: `translate(${viewportOffset.x}px, ${viewportOffset.y}px)`
              }}
            />
          );
        })}
      </svg>

      <div className="brainstorm-canvas__content" style={{ width: bounds.width, height: bounds.height }}>
        {nodes.map((node) => {
          const coordinates = toCanvasCoordinates(node.position, bounds);
          const isSelected = node.id === selectedNodeId;
          const isReparentTarget = node.id === reparentTargetNodeId;
          const className = [
            "brainstorm-node",
            `brainstorm-node--${node.colorToken}`,
            isSelected ? "brainstorm-node--selected" : "",
            isReparentTarget ? "brainstorm-node--reparent-target" : "",
            draggingNodeId === node.id ? "brainstorm-node--dragging" : "",
            connectMode && isSelected ? "brainstorm-node--connect-origin" : "",
            connectMode && blockedNodeIds?.has(node.id)
              ? "brainstorm-node--connect-blocked"
              : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={node.id}
              type="button"
              data-brainstorm-hotkeys="allow"
              className={className}
              style={{
                left: coordinates.x + viewportOffset.x,
                top: coordinates.y + viewportOffset.y,
                width: GRAPH_NODE_WIDTH,
                minHeight: GRAPH_NODE_HEIGHT
              }}
              onClick={(event) => {
                event.stopPropagation();
                onNodeClick?.(node);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onNodePointerDown?.(event, node);
              }}
              disabled={loading}
            >
              <span className="brainstorm-node__label">{node.label}</span>
              <span className="brainstorm-node__meta">{node.category}</span>
              {renderNodeMeta ? (
                <span className="brainstorm-node__submeta">{renderNodeMeta(node)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
