import type { GraphEdgeViewModel, GraphNodeViewModel } from "@pdp-helper/ui-graph";

export const GRAPH_NODE_WIDTH = 176;
export const GRAPH_NODE_HEIGHT = 84;
export const GRAPH_CANVAS_PADDING = 120;
export const GRAPH_MOVE_STEP = 36;

export type MoveDirection = "left" | "right" | "up" | "down";
export type DraftRelationship = "root" | "child" | "sibling";

export interface GraphCanvasBounds {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export function moveGraphNodePosition(
  position: { x: number; y: number },
  direction: MoveDirection,
  step = GRAPH_MOVE_STEP
) {
  switch (direction) {
    case "left":
      return { x: Math.max(0, position.x - step), y: position.y };
    case "right":
      return { x: position.x + step, y: position.y };
    case "up":
      return { x: position.x, y: Math.max(0, position.y - step) };
    case "down":
    default:
      return { x: position.x, y: position.y + step };
  }
}

export function createDraftNodePosition(input: {
  readonly relationship: DraftRelationship;
  readonly nodeCount: number;
  readonly selectedNode?: Pick<GraphNodeViewModel, "position">;
}) {
  const selectedNode = input.selectedNode;
  const rowOffset = (input.nodeCount % 3) * 24;

  if (!selectedNode || input.relationship === "root") {
    return {
      x: 64 + (input.nodeCount % 4) * 208,
      y: 72 + Math.floor(input.nodeCount / 4) * 148
    };
  }

  if (input.relationship === "child") {
    return {
      x: selectedNode.position.x + 24,
      y: selectedNode.position.y + 148
    };
  }

  return {
    x: selectedNode.position.x + 212,
    y: Math.max(24, selectedNode.position.y + rowOffset - 24)
  };
}

export function getGraphCanvasBounds(nodes: readonly GraphNodeViewModel[]): GraphCanvasBounds {
  if (nodes.length === 0) {
    return {
      minX: 0,
      minY: 0,
      width: 920,
      height: 620
    };
  }

  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(...nodes.map((node) => node.position.x + GRAPH_NODE_WIDTH));
  const maxY = Math.max(...nodes.map((node) => node.position.y + GRAPH_NODE_HEIGHT));

  return {
    minX,
    minY,
    width: Math.max(920, maxX - minX + GRAPH_CANVAS_PADDING * 2),
    height: Math.max(620, maxY - minY + GRAPH_CANVAS_PADDING * 2)
  };
}

export function toCanvasCoordinates(
  position: { x: number; y: number },
  bounds: GraphCanvasBounds
) {
  return {
    x: position.x - bounds.minX + GRAPH_CANVAS_PADDING,
    y: position.y - bounds.minY + GRAPH_CANVAS_PADDING
  };
}

export function getConnectionPath(input: {
  readonly edge: GraphEdgeViewModel;
  readonly nodesById: ReadonlyMap<string, GraphNodeViewModel>;
  readonly bounds: GraphCanvasBounds;
}) {
  const source = input.nodesById.get(input.edge.sourceNodeId);
  const target = input.nodesById.get(input.edge.targetNodeId);

  if (!source || !target) {
    return null;
  }

  const sourcePosition = toCanvasCoordinates(source.position, input.bounds);
  const targetPosition = toCanvasCoordinates(target.position, input.bounds);
  const startX = sourcePosition.x + GRAPH_NODE_WIDTH / 2;
  const startY = sourcePosition.y + GRAPH_NODE_HEIGHT;
  const endX = targetPosition.x + GRAPH_NODE_WIDTH / 2;
  const endY = targetPosition.y;
  const controlY = startY + (endY - startY) / 2;

  return `M ${startX} ${startY} C ${startX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`;
}

export function getShortcutHintRows() {
  return [
    "C create child",
    "S create sibling",
    "Delete remove selected",
    "Arrow keys move selected",
    "M toggle re-parent mode",
    "Escape cancel re-parent mode"
  ] as const;
}
