import type { PointerEvent, ReactNode } from "react";
import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";
import {
  getConnectionPath,
  getGraphCanvasBounds,
  GRAPH_NODE_HEIGHT,
  GRAPH_NODE_WIDTH,
  toCanvasCoordinates
} from "./graph-canvas-helpers";

export interface GraphCanvasSurfaceProps {
  readonly title: string;
  readonly nodes: readonly GraphNodeViewModel[];
  readonly edges: readonly GraphEdgeViewModel[];
  readonly selectedNodeId?: string;
  readonly pendingParentNodeId?: string;
  readonly emptyMessage: string;
  readonly readOnly?: boolean;
  readonly draggingNodeId?: string;
  readonly onCanvasClick?: () => void;
  readonly onNodeClick?: (node: GraphNodeViewModel) => void;
  readonly onNodePointerDown?: (
    event: PointerEvent<HTMLButtonElement>,
    node: GraphNodeViewModel
  ) => void;
  readonly renderNodeMeta?: (node: GraphNodeViewModel) => ReactNode;
}

export function GraphCanvasSurface({
  title,
  nodes,
  edges,
  selectedNodeId,
  pendingParentNodeId,
  emptyMessage,
  readOnly = false,
  draggingNodeId,
  onCanvasClick,
  onNodeClick,
  onNodePointerDown,
  renderNodeMeta
}: GraphCanvasSurfaceProps) {
  if (nodes.length === 0) {
    return (
      <div className="graph-canvas graph-canvas--empty">
        <div className="graph-canvas__empty">
          <strong>{title}</strong>
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  const bounds = getGraphCanvasBounds(nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node] as const));

  return (
    <div className="graph-canvas" onClick={onCanvasClick}>
      <svg
        className="graph-canvas__wires"
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

          return <path key={edge.id} d={path} className="graph-canvas__wire" />;
        })}
      </svg>

      <div className="graph-canvas__content" style={{ width: bounds.width, height: bounds.height }}>
        {nodes.map((node) => {
          const coordinates = toCanvasCoordinates(node.position, bounds);
          const isSelected = node.id === selectedNodeId;
          const isParentTarget = node.id === pendingParentNodeId;
          const className = [
            "graph-node",
            `graph-node--${node.colorToken}`,
            `graph-node--${node.visualKind}`,
            isSelected ? "graph-node--selected" : "",
            isParentTarget ? "graph-node--target" : "",
            draggingNodeId === node.id ? "graph-node--dragging" : ""
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={node.id}
              type="button"
              className={className}
              style={{
                left: coordinates.x,
                top: coordinates.y,
                width: GRAPH_NODE_WIDTH,
                minHeight: GRAPH_NODE_HEIGHT
              }}
              onClick={(event) => {
                event.stopPropagation();
                onNodeClick?.(node);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();

                if (readOnly) {
                  return;
                }

                onNodePointerDown?.(event, node);
              }}
            >
              <span className="graph-node__label">{node.label}</span>
              <span className="graph-node__meta">
                {node.category}
                {node.visualKind === "reference" ? " reference" : ""}
                {node.visualKind === "recommendation" ? " recommendation" : ""}
              </span>
              {renderNodeMeta ? (
                <span className="graph-node__submeta">{renderNodeMeta(node)}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
