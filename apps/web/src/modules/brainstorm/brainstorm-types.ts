import {
  USER_NODE_CATEGORY_VALUES,
  type Canvas,
  type CanvasMode,
  type GraphEdge,
  type GraphEdgeKind,
  type GraphNode,
  type GraphNodeCategory,
  type GraphNodePosition,
  type GraphNodeRole,
  type GraphNodeSource,
  type UserNodeCategory
} from "@pdp-helper/contracts-graph";

export type BrainstormCanvasMode = CanvasMode;
export type BrainstormNodeRole = GraphNodeRole;
export type BrainstormNodeCategory = GraphNodeCategory;
export type BrainstormUserNodeCategory = UserNodeCategory;
export type BrainstormEdgeKind = GraphEdgeKind;
export type BrainstormNodeSource = GraphNodeSource;
export type BrainstormPosition = GraphNodePosition;
export type BrainstormCanvas = Canvas;
export type BrainstormNode = GraphNode;
export type BrainstormEdge = GraphEdge;

export const USER_NODE_CATEGORIES: readonly BrainstormUserNodeCategory[] =
  USER_NODE_CATEGORY_VALUES;
