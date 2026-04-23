import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { BrainstormEdge, BrainstormNode } from "./brainstorm-types";

export const BRAINSTORM_NODE_WIDTH = 184;
export const BRAINSTORM_NODE_HEIGHT = 88;

export interface LayoutedPosition {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

let elkInstance: InstanceType<typeof ELK> | null = null;

function getElk() {
  if (!elkInstance) {
    elkInstance = new ELK();
  }
  return elkInstance;
}

export async function layoutBrainstormGraph(
  nodes: readonly BrainstormNode[],
  edges: readonly BrainstormEdge[]
): Promise<LayoutedPosition[]> {
  if (nodes.length === 0) {
    return [];
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const parentEdges = nodes
    .filter((node) => node.parentNodeId && nodeIds.has(node.parentNodeId))
    .map((node) => ({
      id: `parent-${node.id}`,
      sources: [node.parentNodeId as string],
      targets: [node.id]
    }));

  const explicitEdges = edges
    .filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
    )
    .map((edge) => ({
      id: edge.id,
      sources: [edge.sourceNodeId],
      targets: [edge.targetNodeId]
    }));

  const seenEdgeKeys = new Set<string>();
  const combinedEdges = [...parentEdges, ...explicitEdges].filter((edge) => {
    const key = `${edge.sources[0]}->${edge.targets[0]}`;
    if (seenEdgeKeys.has(key)) {
      return false;
    }
    seenEdgeKeys.add(key);
    return true;
  });

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "96",
      "elk.spacing.nodeNode": "64",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
      "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
      "elk.edgeRouting": "POLYLINE",
      "elk.padding": "[top=24,left=24,bottom=24,right=24]"
    },
    children: nodes.map((node) => ({
      id: node.id,
      width: BRAINSTORM_NODE_WIDTH,
      height: BRAINSTORM_NODE_HEIGHT
    })),
    edges: combinedEdges
  };

  const result = await getElk().layout(graph);
  return (result.children ?? []).map((child) => ({
    id: child.id,
    x: Math.round(child.x ?? 0),
    y: Math.round(child.y ?? 0)
  }));
}
