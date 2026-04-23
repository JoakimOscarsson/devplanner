import type {
  GraphEdge,
  GraphNode,
  GraphNodeCategory,
  GraphNodeRole
} from "@pdp-helper/contracts-graph";

export type CanvasMode = "brainstorm" | "skill-graph";

export type NodeVisualKind = "standard" | "reference" | "recommendation";

export interface GraphNodeViewModel {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  readonly role: GraphNodeRole;
  readonly visualKind: NodeVisualKind;
  readonly colorToken: string;
  readonly description?: string;
  readonly parentNodeId?: string;
  readonly position: {
    readonly x: number;
    readonly y: number;
  };
}

export interface GraphEdgeViewModel {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly relationship: string;
}

export interface GraphSelection {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
}

export interface GraphCommandPort {
  createChildNode(input: { parentNodeId: string; label: string; category: string }): Promise<void>;
  createSiblingNode(input: { anchorNodeId: string; label: string; category: string }): Promise<void>;
  updateNode(input: { nodeId: string; label?: string; category?: string }): Promise<void>;
  moveNode(input: { nodeId: string; x: number; y: number }): Promise<void>;
  removeNode(input: { nodeId: string }): Promise<void>;
  createReferenceNode(input: { sourceNodeId: string; targetSkillId: string }): Promise<void>;
  acceptRecommendation(input: { nodeId: string }): Promise<void>;
  denyRecommendation(input: { nodeId: string }): Promise<void>;
}

export interface AutoLayoutPort {
  arrange(input: {
    mode: CanvasMode;
    nodes: readonly GraphNodeViewModel[];
    edges: readonly GraphEdgeViewModel[];
  }): Promise<{
    readonly nodes: readonly GraphNodeViewModel[];
    readonly edges: readonly GraphEdgeViewModel[];
  }>;
}

export interface GraphCanvasModule {
  readonly packageName: "@pdp-helper/ui-graph";
  readonly supportedModes: readonly CanvasMode[];
}

export interface GraphCanvasView {
  readonly nodes: readonly GraphNodeViewModel[];
  readonly edges: readonly GraphEdgeViewModel[];
}

export interface NodePlacement {
  readonly x: number;
  readonly y: number;
  readonly parentNodeId?: string;
}

export type GraphCanvasViewModel = GraphCanvasView;

export const CATEGORY_COLOR_TOKENS: Readonly<Record<GraphNodeCategory, string>> = {
  certificate: "amber",
  course: "teal",
  custom: "slate",
  goal: "rose",
  note: "stone",
  project: "blue",
  recommendation: "lime",
  skill: "emerald"
};

const HORIZONTAL_GAP = 240;
const VERTICAL_GAP = 160;
const COMPONENT_GAP_X = 280;
const COMPONENT_GAP_Y = 240;
const OVERLAP_THRESHOLD_X = 160;
const OVERLAP_THRESHOLD_Y = 120;
const MAX_COMPONENT_COLUMNS = 2;
const START_X = 48;
const START_Y = 48;
const ROLE_PRIORITY: Readonly<Record<GraphNodeRole, number>> = {
  brainstorm: 0,
  skill: 1,
  reference: 2,
  recommendation: 3
};

export function getVisualKind(role: GraphNodeRole): NodeVisualKind {
  if (role === "recommendation") {
    return "recommendation";
  }

  if (role === "reference") {
    return "reference";
  }

  return "standard";
}

export function toGraphNodeViewModel(node: GraphNode): GraphNodeViewModel {
  return {
    id: node.id,
    label: node.label,
    category: node.category,
    role: node.role,
    visualKind: getVisualKind(node.role),
    colorToken: CATEGORY_COLOR_TOKENS[node.category],
    description: node.description,
    parentNodeId: node.parentNodeId,
    position: node.position
  };
}

export function toGraphEdgeViewModel(edge: GraphEdge): GraphEdgeViewModel {
  return {
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    relationship: edge.kind
  };
}

export function sortGraphNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return [...nodes].sort((left, right) => {
    if (left.parentNodeId !== right.parentNodeId) {
      return (left.parentNodeId ?? "").localeCompare(right.parentNodeId ?? "");
    }

    const leftY = getSortableCoordinate(left.position.y);
    const rightY = getSortableCoordinate(right.position.y);

    if (leftY !== rightY) {
      return leftY - rightY;
    }

    const leftX = getSortableCoordinate(left.position.x);
    const rightX = getSortableCoordinate(right.position.x);

    if (leftX !== rightX) {
      return leftX - rightX;
    }

    const labelDifference = left.label.localeCompare(right.label, undefined, {
      sensitivity: "base"
    });

    if (labelDifference !== 0) {
      return labelDifference;
    }

    return left.id.localeCompare(right.id);
  });
}

export function needsBrainstormAutoLayout(
  nodes: readonly GraphNodeViewModel[]
): boolean {
  for (const node of nodes) {
    if (!Number.isFinite(node.position.x) || !Number.isFinite(node.position.y)) {
      return true;
    }
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const currentNode = nodes[index];

    if (!currentNode) {
      continue;
    }

    for (
      let comparisonIndex = index + 1;
      comparisonIndex < nodes.length;
      comparisonIndex += 1
    ) {
      const comparisonNode = nodes[comparisonIndex];

      if (!comparisonNode) {
        continue;
      }

      const dx = Math.abs(currentNode.position.x - comparisonNode.position.x);
      const dy = Math.abs(currentNode.position.y - comparisonNode.position.y);

      if (dx < OVERLAP_THRESHOLD_X && dy < OVERLAP_THRESHOLD_Y) {
        return true;
      }
    }
  }

  return false;
}

export function applyDeterministicLayout(
  nodes: readonly GraphNodeViewModel[],
  mode: CanvasMode
): GraphNodeViewModel[] {
  if (mode !== "brainstorm" || !needsBrainstormAutoLayout(nodes)) {
    return [...nodes];
  }

  return layoutBrainstormNodes(nodes, []);
}

export function createGraphCanvasView(input: {
  mode: CanvasMode;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}): GraphCanvasView {
  return toGraphCanvasViewModel(input);
}

export function toGraphCanvasViewModel(input: {
  mode: CanvasMode;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
}): GraphCanvasViewModel {
  const rawNodes = sortGraphNodes(input.nodes).map(toGraphNodeViewModel);
  const edges = input.edges.map(toGraphEdgeViewModel);

  if (input.mode !== "brainstorm" || !needsBrainstormAutoLayout(rawNodes)) {
    return {
      nodes: rawNodes,
      edges
    };
  }

  return {
    nodes: layoutBrainstormNodes(rawNodes, edges),
    edges
  };
}

export function createDeterministicAutoLayout(): AutoLayoutPort {
  return {
    async arrange(input) {
      if (input.mode !== "brainstorm" || !needsBrainstormAutoLayout(input.nodes)) {
        return {
          nodes: input.nodes,
          edges: input.edges
        };
      }

      return {
        nodes: layoutBrainstormNodes(input.nodes, input.edges),
        edges: input.edges
      };
    }
  };
}

export function createDemoGraph(): GraphCanvasView {
  return {
    nodes: [
      {
        id: "nod_demo_skill",
        label: "TypeScript",
        category: "skill",
        role: "skill",
        visualKind: "standard",
        colorToken: "emerald",
        position: { x: 32, y: 56 }
      },
      {
        id: "nod_demo_cert",
        label: "AWS Certification",
        category: "certificate",
        role: "brainstorm",
        visualKind: "standard",
        colorToken: "amber",
        position: { x: 240, y: 24 }
      },
      {
        id: "nod_demo_recommendation",
        label: "Practice event-driven design",
        category: "recommendation",
        role: "recommendation",
        visualKind: "recommendation",
        colorToken: "lime",
        position: { x: 212, y: 168 }
      }
    ],
    edges: [
      {
        id: "edg_demo_1",
        sourceNodeId: "nod_demo_cert",
        targetNodeId: "nod_demo_skill",
        relationship: "depends-on"
      },
      {
        id: "edg_demo_2",
        sourceNodeId: "nod_demo_skill",
        targetNodeId: "nod_demo_recommendation",
        relationship: "relates-to"
      }
    ]
  };
}

export function deriveRootNodePlacement(
  nodes: readonly GraphNodeViewModel[]
): NodePlacement {
  if (nodes.length === 0) {
    return {
      x: START_X,
      y: START_Y
    };
  }

  const rootNodes = nodes.filter((node) => !node.parentNodeId);
  const leftmostX = Math.min(
    ...(rootNodes.length > 0 ? rootNodes : nodes).map((node) => node.position.x)
  );
  const maxY = Math.max(...nodes.map((node) => node.position.y));

  return {
    x: leftmostX,
    y: maxY + VERTICAL_GAP
  };
}

export function deriveChildNodePlacement(
  nodes: readonly GraphNodeViewModel[],
  parentNodeId: string
): NodePlacement {
  const parentNode = nodes.find((node) => node.id === parentNodeId);

  if (!parentNode) {
    return deriveRootNodePlacement(nodes);
  }

  const siblingNodes = nodes.filter((node) => node.parentNodeId === parentNodeId);
  const nextY =
    siblingNodes.length === 0
      ? parentNode.position.y + VERTICAL_GAP
      : Math.max(...siblingNodes.map((node) => node.position.y)) + VERTICAL_GAP;

  return {
    parentNodeId,
    x: parentNode.position.x + HORIZONTAL_GAP,
    y: nextY
  };
}

export function deriveSiblingNodePlacement(
  nodes: readonly GraphNodeViewModel[],
  anchorNodeId: string
): NodePlacement {
  const anchorNode = nodes.find((node) => node.id === anchorNodeId);

  if (!anchorNode) {
    return deriveRootNodePlacement(nodes);
  }

  if (!anchorNode.parentNodeId) {
    return deriveRootNodePlacement(nodes);
  }

  return deriveChildNodePlacement(nodes, anchorNode.parentNodeId);
}

export function deriveReparentedNodePlacement(
  nodes: readonly GraphNodeViewModel[],
  input: {
    readonly nodeId: string;
    readonly nextParentNodeId: string;
  }
): NodePlacement {
  const nextParent = nodes.find((node) => node.id === input.nextParentNodeId);

  if (!nextParent) {
    return deriveRootNodePlacement(nodes);
  }

  const nextSiblingNodes = nodes.filter(
    (node) =>
      node.parentNodeId === input.nextParentNodeId && node.id !== input.nodeId
  );
  const maxSiblingY = nextSiblingNodes.length
    ? Math.max(...nextSiblingNodes.map((node) => node.position.y))
    : nextParent.position.y - VERTICAL_GAP;

  return {
    parentNodeId: input.nextParentNodeId,
    x: nextParent.position.x + HORIZONTAL_GAP,
    y: maxSiblingY + VERTICAL_GAP
  };
}

function getSortableCoordinate(value: number): number {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function compareNodeViewModels(
  left: GraphNodeViewModel,
  right: GraphNodeViewModel
): number {
  const roleDifference = ROLE_PRIORITY[left.role] - ROLE_PRIORITY[right.role];

  if (roleDifference !== 0) {
    return roleDifference;
  }

  const labelDifference = left.label.localeCompare(right.label, undefined, {
    sensitivity: "base"
  });

  if (labelDifference !== 0) {
    return labelDifference;
  }

  return left.id.localeCompare(right.id);
}

function compareNodeIds(
  leftNodeId: string,
  rightNodeId: string,
  nodeById: ReadonlyMap<string, GraphNodeViewModel>
): number {
  const leftNode = nodeById.get(leftNodeId);
  const rightNode = nodeById.get(rightNodeId);

  if (!leftNode || !rightNode) {
    return leftNodeId.localeCompare(rightNodeId);
  }

  return compareNodeViewModels(leftNode, rightNode);
}

function buildAdjacencyMap(
  nodes: readonly GraphNodeViewModel[],
  edges: readonly GraphEdgeViewModel[]
): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    adjacency.set(node.id, []);
  });

  edges.forEach((edge) => {
    if (!adjacency.has(edge.sourceNodeId) || !adjacency.has(edge.targetNodeId)) {
      return;
    }

    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    adjacency.get(edge.targetNodeId)?.push(edge.sourceNodeId);
  });

  return adjacency;
}

function buildConnectedComponents(
  nodes: readonly GraphNodeViewModel[],
  adjacency: ReadonlyMap<string, readonly string[]>,
  nodeById: ReadonlyMap<string, GraphNodeViewModel>
): readonly (readonly GraphNodeViewModel[])[] {
  const visited = new Set<string>();
  const components: GraphNodeViewModel[][] = [];

  for (const node of [...nodes].sort(compareNodeViewModels)) {
    if (visited.has(node.id)) {
      continue;
    }

    const queue = [node.id];
    const componentNodes: GraphNodeViewModel[] = [];

    while (queue.length > 0) {
      const currentNodeId = queue.shift();

      if (!currentNodeId || visited.has(currentNodeId)) {
        continue;
      }

      visited.add(currentNodeId);

      const currentNode = nodeById.get(currentNodeId);

      if (currentNode) {
        componentNodes.push(currentNode);
      }

      const adjacentNodeIds = adjacency.get(currentNodeId) ?? [];

      [...adjacentNodeIds]
        .sort((leftNodeId, rightNodeId) =>
          compareNodeIds(leftNodeId, rightNodeId, nodeById)
        )
        .forEach((adjacentNodeId) => {
          if (!visited.has(adjacentNodeId)) {
            queue.push(adjacentNodeId);
          }
        });
    }

    components.push(componentNodes.sort(compareNodeViewModels));
  }

  return components;
}

function selectComponentRoot(
  nodes: readonly GraphNodeViewModel[],
  adjacency: ReadonlyMap<string, readonly string[]>
): GraphNodeViewModel {
  return [...nodes].sort((left, right) => {
    const degreeDifference =
      (adjacency.get(right.id)?.length ?? 0) - (adjacency.get(left.id)?.length ?? 0);

    if (degreeDifference !== 0) {
      return degreeDifference;
    }

    return compareNodeViewModels(left, right);
  })[0] as GraphNodeViewModel;
}

function buildComponentLayout(
  nodes: readonly GraphNodeViewModel[],
  adjacency: ReadonlyMap<string, readonly string[]>,
  nodeById: ReadonlyMap<string, GraphNodeViewModel>
): {
  readonly width: number;
  readonly height: number;
  readonly nodes: readonly GraphNodeViewModel[];
} {
  const rootNode = selectComponentRoot(nodes, adjacency);
  const queue = [rootNode.id];
  const depths = new Map<string, number>([[rootNode.id, 0]]);

  while (queue.length > 0) {
    const currentNodeId = queue.shift();

    if (!currentNodeId) {
      continue;
    }

    const adjacentNodeIds = adjacency.get(currentNodeId) ?? [];

    [...adjacentNodeIds]
      .sort((leftNodeId, rightNodeId) =>
        compareNodeIds(leftNodeId, rightNodeId, nodeById)
      )
      .forEach((adjacentNodeId) => {
        if (depths.has(adjacentNodeId)) {
          return;
        }

        depths.set(adjacentNodeId, (depths.get(currentNodeId) ?? 0) + 1);
        queue.push(adjacentNodeId);
      });
  }

  const layers = new Map<number, GraphNodeViewModel[]>();

  nodes.forEach((node) => {
    const depth = depths.get(node.id) ?? 0;
    const layer = layers.get(depth) ?? [];

    layer.push(node);
    layers.set(depth, layer);
  });

  const positionedNodes: GraphNodeViewModel[] = [];
  let maxDepth = 0;
  let maxRows = 1;

  [...layers.entries()]
    .sort(([leftDepth], [rightDepth]) => leftDepth - rightDepth)
    .forEach(([depth, layerNodes]) => {
      const sortedLayerNodes = [...layerNodes].sort(compareNodeViewModels);

      maxDepth = Math.max(maxDepth, depth);
      maxRows = Math.max(maxRows, sortedLayerNodes.length);

      sortedLayerNodes.forEach((node, rowIndex) => {
        positionedNodes.push({
          ...node,
          position: {
            x: depth * HORIZONTAL_GAP,
            y: rowIndex * VERTICAL_GAP
          }
        });
      });
    });

  return {
    width: maxDepth * HORIZONTAL_GAP,
    height: (maxRows - 1) * VERTICAL_GAP,
    nodes: positionedNodes
  };
}

function getLayoutOrigin(
  nodes: readonly GraphNodeViewModel[]
): GraphNodeViewModel["position"] {
  const positionedNodes = nodes.filter(
    (node) =>
      Number.isFinite(node.position.x) && Number.isFinite(node.position.y)
  );

  if (positionedNodes.length === 0) {
    return {
      x: START_X,
      y: START_Y
    };
  }

  return {
    x: Math.max(
      START_X,
      Math.min(...positionedNodes.map((node) => node.position.x))
    ),
    y: Math.max(
      START_Y,
      Math.min(...positionedNodes.map((node) => node.position.y))
    )
  };
}

function layoutBrainstormNodes(
  nodes: readonly GraphNodeViewModel[],
  edges: readonly GraphEdgeViewModel[]
): GraphNodeViewModel[] {
  if (nodes.length === 0) {
    return [];
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const adjacency = buildAdjacencyMap(nodes, edges);

  adjacency.forEach((adjacentNodeIds, nodeId) => {
    adjacentNodeIds.sort((leftNodeId, rightNodeId) =>
      compareNodeIds(leftNodeId, rightNodeId, nodeById)
    );
    adjacency.set(nodeId, [...new Set(adjacentNodeIds)]);
  });

  const components = buildConnectedComponents(nodes, adjacency, nodeById);
  const componentLayouts = components.map((componentNodes) =>
    buildComponentLayout(componentNodes, adjacency, nodeById)
  );
  const componentColumns = Math.max(
    1,
    Math.min(
      MAX_COMPONENT_COLUMNS,
      Math.ceil(Math.sqrt(componentLayouts.length))
    )
  );
  const maxComponentWidth = componentLayouts.reduce(
    (largestWidth, componentLayout) => Math.max(largestWidth, componentLayout.width),
    0
  );
  const maxComponentHeight = componentLayouts.reduce(
    (largestHeight, componentLayout) =>
      Math.max(largestHeight, componentLayout.height),
    0
  );
  const cellWidth = Math.max(COMPONENT_GAP_X, maxComponentWidth + HORIZONTAL_GAP);
  const cellHeight = Math.max(COMPONENT_GAP_Y, maxComponentHeight + VERTICAL_GAP);
  const origin = getLayoutOrigin(nodes);
  const positionsById = new Map<string, GraphNodeViewModel["position"]>();

  componentLayouts.forEach((componentLayout, index) => {
    const column = index % componentColumns;
    const row = Math.floor(index / componentColumns);
    const offsetX = origin.x + column * cellWidth;
    const offsetY = origin.y + row * cellHeight;

    componentLayout.nodes.forEach((node) => {
      positionsById.set(node.id, {
        x: offsetX + node.position.x,
        y: offsetY + node.position.y
      });
    });
  });

  return nodes.map((node) => ({
    ...node,
    position: positionsById.get(node.id) ?? node.position
  }));
}
