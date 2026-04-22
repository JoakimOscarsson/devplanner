import { toGraphCanvasViewModel } from "@pdp-helper/ui-graph";
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

export interface BrainstormSelectedCanvasModel {
  readonly id: BrainstormCanvas["id"];
  readonly name: string;
  readonly href?: string;
  readonly graphLoaded: boolean;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodes: readonly BrainstormNodeSummary[];
  readonly relationships: readonly BrainstormRelationshipSummary[];
}

export interface BrainstormPanelModel {
  readonly canvasSummaries: readonly BrainstormCanvasSummary[];
  readonly selectedCanvas: BrainstormSelectedCanvasModel | null;
}

export interface BrainstormPanelModelOptions {
  readonly selectedCanvasId?: BrainstormCanvas["id"];
  readonly canvasHrefBuilder?: (canvas: BrainstormCanvas) => string | undefined;
}

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
        relationships: []
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

  const nodes = graphView.nodes
    .reduce<BrainstormNodeSummary[]>((summaries, viewNode) => {
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
        id: nodeId,
        label: viewNode.label,
        category: viewNode.category,
        visualKind: viewNode.visualKind,
        colorToken: viewNode.colorToken,
        parentLabel: node.parentNodeId
          ? nodesById.get(node.parentNodeId)?.label
          : undefined,
        incomingCount,
        outgoingCount,
        positionLabel: `${viewNode.position.x}, ${viewNode.position.y}`
      });

      return summaries;
    }, [])
    .sort((left: BrainstormNodeSummary, right: BrainstormNodeSummary) =>
      left.label.localeCompare(right.label)
    );

  return {
    canvasSummaries,
    selectedCanvas: {
      ...selectedCanvasSummary,
      nodes,
      relationships
    }
  };
}
