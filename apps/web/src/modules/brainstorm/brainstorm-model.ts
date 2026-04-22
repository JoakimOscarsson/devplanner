import {
  deriveChildNodePlacement,
  deriveReparentedNodePlacement,
  deriveRootNodePlacement,
  deriveSiblingNodePlacement,
  toGraphCanvasViewModel,
  type GraphCanvasViewModel,
  type GraphEdgeViewModel,
  type GraphNodeViewModel
} from "@pdp-helper/ui-graph";
import type {
  CreateBrainstormNodeInput
} from "./brainstorm-gateway";
import type {
  BrainstormCanvas,
  BrainstormEdge,
  BrainstormNode
} from "./brainstorm-types";

export interface BrainstormCanvasGraph {
  readonly canvas: BrainstormCanvas;
  readonly nodes: readonly BrainstormNode[];
  readonly edges: readonly BrainstormEdge[];
}

export interface BrainstormSnapshot {
  readonly canvases: readonly BrainstormCanvas[];
  readonly graphsByCanvasId: Readonly<Record<string, BrainstormCanvasGraph>>;
  readonly selectedCanvasId?: BrainstormCanvas["id"];
}

export interface BrainstormCanvasSummary {
  readonly id: BrainstormCanvas["id"];
  readonly name: string;
  readonly isSelected: boolean;
  readonly href?: string;
  readonly graphLoaded: boolean;
  readonly nodeCount: number;
  readonly edgeCount: number;
}

export interface BrainstormNodeSummary {
  readonly id: BrainstormNode["id"];
  readonly label: string;
  readonly category: string;
  readonly visualKind: string;
  readonly colorToken: string;
  readonly parentLabel?: string;
  readonly incomingCount: number;
  readonly outgoingCount: number;
  readonly positionLabel: string;
}

export interface BrainstormRelationshipSummary {
  readonly id: BrainstormEdge["id"];
  readonly sourceNodeId: BrainstormEdge["sourceNodeId"];
  readonly targetNodeId: BrainstormEdge["targetNodeId"];
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly relationship: string;
}

export interface BrainstormCanvasNodeCard extends GraphNodeViewModel {
  readonly parentLabel?: string;
  readonly incomingCount: number;
  readonly outgoingCount: number;
}

export interface BrainstormCanvasEdgeCard extends GraphEdgeViewModel {
  readonly sourceLabel: string;
  readonly targetLabel: string;
}

export interface BrainstormSelectedCanvasModel {
  readonly id: BrainstormCanvas["id"];
  readonly name: string;
  readonly href?: string;
  readonly graphLoaded: boolean;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly BrainstormNodeSummary[];
  readonly relationships: readonly BrainstormRelationshipSummary[];
  readonly graphView: GraphCanvasViewModel;
  readonly graphNodes: readonly BrainstormCanvasNodeCard[];
  readonly graphEdges: readonly BrainstormCanvasEdgeCard[];
}

export interface BrainstormPanelModel {
  readonly canvasSummaries: readonly BrainstormCanvasSummary[];
  readonly selectedCanvas: BrainstormSelectedCanvasModel | null;
}

export interface BrainstormPanelModelOptions {
  readonly selectedCanvasId?: BrainstormCanvas["id"];
  readonly canvasHrefBuilder?: (canvas: BrainstormCanvas) => string | undefined;
}

export type BrainstormComposerIntent = "root" | "child" | "sibling";

export type BrainstormHotkeyAction =
  | "compose-root"
  | "compose-child"
  | "compose-sibling"
  | "move-left"
  | "move-right"
  | "move-up"
  | "move-down"
  | "delete-node"
  | "toggle-reparent"
  | "cancel";

export const EMPTY_BRAINSTORM_SNAPSHOT: BrainstormSnapshot = {
  canvases: [],
  graphsByCanvasId: {}
};

export function compareCanvases(
  left: BrainstormCanvas,
  right: BrainstormCanvas
) {
  if (left.sortOrder !== right.sortOrder) {
    return left.sortOrder - right.sortOrder;
  }

  return left.name.localeCompare(right.name);
}

export function getBrainstormCanvases(
  canvases: readonly BrainstormCanvas[]
) {
  return [...canvases]
    .filter((canvas: BrainstormCanvas) => canvas.mode === "brainstorm")
    .sort(compareCanvases);
}

export function interpretBrainstormHotkey(input: {
  readonly key: string;
  readonly targetTagName?: string | null;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
}): BrainstormHotkeyAction | null {
  const tagName = input.targetTagName?.toLowerCase();

  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    input.metaKey ||
    input.ctrlKey ||
    input.altKey
  ) {
    return null;
  }

  switch (input.key) {
    case "n":
    case "N":
    case "r":
    case "R":
      return "compose-root";
    case "c":
    case "C":
      return "compose-child";
    case "s":
    case "S":
      return "compose-sibling";
    case "m":
    case "M":
      return "toggle-reparent";
    case "Escape":
      return "cancel";
    case "Backspace":
    case "Delete":
      return "delete-node";
    case "ArrowLeft":
      return "move-left";
    case "ArrowRight":
      return "move-right";
    case "ArrowUp":
      return "move-up";
    case "ArrowDown":
      return "move-down";
    default:
      return null;
  }
}

export function deriveBrainstormCreateNodeInput(
  graph: BrainstormCanvasGraph,
  input: {
    readonly intent: BrainstormComposerIntent;
    readonly anchorNodeId?: BrainstormNode["id"];
    readonly label: string;
    readonly category: BrainstormNode["category"];
  }
): CreateBrainstormNodeInput {
  const graphView = toGraphCanvasViewModel({
    mode: graph.canvas.mode,
    nodes: graph.nodes,
    edges: graph.edges
  });

  const placement =
    input.intent === "child" && input.anchorNodeId
      ? deriveChildNodePlacement(graphView.nodes, input.anchorNodeId)
      : input.intent === "sibling" && input.anchorNodeId
        ? deriveSiblingNodePlacement(graphView.nodes, input.anchorNodeId)
        : deriveRootNodePlacement(graphView.nodes);

  return {
    canvasId: graph.canvas.id,
    label: input.label,
    category: input.category,
    position: {
      x: placement.x,
      y: placement.y
    },
    ...(placement.parentNodeId ? { parentNodeId: placement.parentNodeId as BrainstormNode["id"] } : {})
  };
}

export function deriveBrainstormReparentUpdate(
  graph: BrainstormCanvasGraph,
  input: {
    readonly nodeId: BrainstormNode["id"];
    readonly nextParentNodeId: BrainstormNode["id"];
  }
) {
  const graphView = toGraphCanvasViewModel({
    mode: graph.canvas.mode,
    nodes: graph.nodes,
    edges: graph.edges
  });
  const placement = deriveReparentedNodePlacement(graphView.nodes, input);

  return {
    parentNodeId: placement.parentNodeId as BrainstormNode["id"],
    position: {
      x: placement.x,
      y: placement.y
    }
  };
}

export function buildBrainstormPanelModel(
  snapshot: BrainstormSnapshot,
  options: BrainstormPanelModelOptions = {}
): BrainstormPanelModel {
  const brainstormCanvases = getBrainstormCanvases(snapshot.canvases);
  const preferredSelectedCanvasId =
    options.selectedCanvasId ?? snapshot.selectedCanvasId;
  const selectedCanvasId = brainstormCanvases.some(
    (canvas: BrainstormCanvas) => canvas.id === preferredSelectedCanvasId
  )
    ? preferredSelectedCanvasId
    : brainstormCanvases[0]?.id;

  const canvasSummaries = brainstormCanvases.map((canvas: BrainstormCanvas) => {
    const graph = snapshot.graphsByCanvasId[canvas.id];

    return {
      id: canvas.id,
      name: canvas.name,
      isSelected: canvas.id === selectedCanvasId,
      href: options.canvasHrefBuilder?.(canvas),
      graphLoaded: Boolean(graph),
      nodeCount: graph?.nodes.length ?? 0,
      edgeCount: graph?.edges.length ?? 0
    } satisfies BrainstormCanvasSummary;
  });

  const selectedCanvasSummary = canvasSummaries.find(
    (canvas: BrainstormCanvasSummary) => canvas.id === selectedCanvasId
  );
  const selectedCanvasRecord = brainstormCanvases.find(
    (canvas: BrainstormCanvas) => canvas.id === selectedCanvasId
  );

  if (!selectedCanvasSummary || !selectedCanvasRecord) {
    return {
      canvasSummaries,
      selectedCanvas: null
    };
  }

  const selectedGraph = snapshot.graphsByCanvasId[selectedCanvasSummary.id];

  if (!selectedGraph) {
    return {
      canvasSummaries,
      selectedCanvas: {
        ...selectedCanvasSummary,
        nodes: [],
        relationships: [],
        graphView: {
          nodes: [],
          edges: []
        },
        graphNodes: [],
        graphEdges: []
      }
    };
  }

  const nodesById = new Map(
    selectedGraph.nodes.map((node: BrainstormNode) => [node.id, node] as const)
  );
  const graphView = toGraphCanvasViewModel({
    mode: selectedGraph.canvas.mode,
    nodes: selectedGraph.nodes,
    edges: selectedGraph.edges
  });
  const relationships = selectedGraph.edges
    .map((edge: BrainstormEdge) => {
      return {
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        sourceLabel: nodesById.get(edge.sourceNodeId)?.label ?? edge.sourceNodeId,
        targetLabel: nodesById.get(edge.targetNodeId)?.label ?? edge.targetNodeId,
        relationship: edge.kind
      } satisfies BrainstormRelationshipSummary;
    })
    .sort((left: BrainstormRelationshipSummary, right: BrainstormRelationshipSummary) => {
      const sourceComparison = left.sourceLabel.localeCompare(right.sourceLabel);

      if (sourceComparison !== 0) {
        return sourceComparison;
      }

      const targetComparison = left.targetLabel.localeCompare(right.targetLabel);

      if (targetComparison !== 0) {
        return targetComparison;
      }

      return left.relationship.localeCompare(right.relationship);
    });

  const graphEdges = relationships.map((relationship) => ({
    id: relationship.id,
    sourceNodeId: relationship.sourceNodeId,
    targetNodeId: relationship.targetNodeId,
    relationship: relationship.relationship,
    sourceLabel: relationship.sourceLabel,
    targetLabel: relationship.targetLabel
  })) satisfies BrainstormCanvasEdgeCard[];

  const graphNodes = graphView.nodes
    .reduce<BrainstormCanvasNodeCard[]>((summaries, viewNode) => {
      const nodeId = viewNode.id as BrainstormNode["id"];
      const node = nodesById.get(nodeId);

      if (!node) {
        return summaries;
      }

      const incomingCount = relationships.filter(
        (relationship: BrainstormRelationshipSummary) =>
          relationship.targetNodeId === nodeId
      ).length;
      const outgoingCount = relationships.filter(
        (relationship: BrainstormRelationshipSummary) =>
          relationship.sourceNodeId === nodeId
      ).length;

      summaries.push({
        ...viewNode,
        parentLabel: node.parentNodeId
          ? nodesById.get(node.parentNodeId)?.label
          : undefined,
        incomingCount,
        outgoingCount
      });

      return summaries;
    }, [])
    .sort((left: BrainstormCanvasNodeCard, right: BrainstormCanvasNodeCard) =>
      left.label.localeCompare(right.label)
    );

  const nodes = graphNodes.map((node) => ({
    id: node.id as BrainstormNode["id"],
    label: node.label,
    category: node.category,
    visualKind: node.visualKind,
    colorToken: node.colorToken,
    parentLabel: node.parentLabel,
    incomingCount: node.incomingCount,
    outgoingCount: node.outgoingCount,
    positionLabel: `${node.position.x}, ${node.position.y}`
  })) satisfies BrainstormNodeSummary[];

  return {
    canvasSummaries,
    selectedCanvas: {
      ...selectedCanvasSummary,
      nodes,
      relationships,
      graphView,
      graphNodes,
      graphEdges
    }
  };
}
