import type { GraphEdge, GraphNode, Skill } from "@pdp-helper/contracts-graph";
import type { SkillInventoryEntry, SkillsSnapshot } from "./skills-gateway";

export type { SkillsSnapshot } from "./skills-gateway";

export interface SkillsInventorySummaryModel {
  readonly totalCanonicalSkills: number;
  readonly totalReferenceNodes: number;
  readonly totalSkillGraphNodes: number;
}

export interface SkillTreeNodeModel {
  readonly id: string;
  readonly label: string;
  readonly kind: "skill" | "reference";
  readonly skillId?: Skill["id"];
  readonly parentId?: GraphNode["id"];
  readonly description?: string;
  readonly tag?: string;
  readonly tags: readonly string[];
  readonly color?: string;
  readonly sortOrder: number;
  readonly meta: string;
  readonly children: readonly SkillTreeNodeModel[];
}

export interface SkillsPanelModel {
  readonly inventorySummary: SkillsInventorySummaryModel;
  readonly treeRoots: readonly SkillTreeNodeModel[];
  readonly availableTagFilters: readonly string[];
  readonly availableColorFilters: readonly string[];
  readonly hiddenFeatureNotes: readonly string[];
}

export interface VisibleSkillTreeRowModel {
  readonly id: string;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly parentId?: string;
  readonly node: SkillTreeNodeModel;
}

export interface SkillTreeDropIndicatorModel {
  readonly targetNodeId: string;
  readonly position: "before" | "after";
}

export interface SkillTreeFilterState {
  readonly query?: string;
  readonly tag?: string;
  readonly color?: string;
}

export type SkillTreeHotkeyAction =
  | "select-previous"
  | "select-next"
  | "expand"
  | "collapse"
  | "edit"
  | "delete"
  | "create-child"
  | "create-sibling"
  | "cancel";

export const EMPTY_SKILLS_SNAPSHOT: SkillsSnapshot = {
  inventory: [],
  summary: {
    totalCanonicalSkills: 0,
    totalReferenceNodes: 0,
    totalSkillGraphNodes: 0
  },
  promotionCandidates: []
};

export const TEMPORARILY_HIDDEN_SKILLTREE_FEATURES = [
  "Create a reference to an existing canonical skill from this page",
  "Show reference nodes inline in the tree",
  "Resolve duplicate canonical skills from the tree",
  "Review brainstorm promotion candidates from the skill tree page",
  "Bulk actions such as multi-select, batch tagging, or batch reorder",
  "Skill rating and gap filters"
] as const;

export const SKILL_TREE_DEPTH_LIMIT = 50;

function compareInventory(left: SkillInventoryEntry, right: SkillInventoryEntry) {
  return left.canonicalLabel.localeCompare(right.canonicalLabel);
}

function readSkillIdFromNode(node: GraphNode) {
  const value = node.metadata?.skillId;
  return typeof value === "string" ? (value as Skill["id"]) : undefined;
}

function readStringMetadata(node: GraphNode, key: string) {
  const value = node.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function readStringArrayMetadata(node: GraphNode, key: string) {
  const value = node.metadata?.[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function parseTagList(input: string | undefined | null) {
  if (!input) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const rawTag of input.split(/[;,]/g)) {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      continue;
    }

    const normalizedTag = tag.toLowerCase();

    if (seen.has(normalizedTag)) {
      continue;
    }

    seen.add(normalizedTag);
    tags.push(tag);
  }

  return tags;
}

export function formatTagList(tags: readonly string[]) {
  return tags.join(", ");
}

function readTagListMetadata(node: GraphNode) {
  const explicitTags = readStringArrayMetadata(node, "tags");

  if (explicitTags.length > 0) {
    return explicitTags;
  }

  return parseTagList(readStringMetadata(node, "tag"));
}

function readNumberMetadata(node: GraphNode, key: string) {
  const value = node.metadata?.[key];
  return typeof value === "number" ? value : undefined;
}

function compareGraphNodes(left: GraphNode, right: GraphNode) {
  const orderDifference =
    (readNumberMetadata(left, "sortOrder") ?? Number.MAX_SAFE_INTEGER) -
    (readNumberMetadata(right, "sortOrder") ?? Number.MAX_SAFE_INTEGER);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  if (left.role !== right.role) {
    const roleOrder = {
      skill: 0,
      reference: 1
    } as const;

    return roleOrder[left.role as "skill" | "reference"] -
      roleOrder[right.role as "skill" | "reference"];
  }

  return left.label.localeCompare(right.label);
}

function isSkillTreeNode(node: GraphNode) {
  if (node.category !== "skill") {
    return false;
  }

  return node.role === "skill" || node.role === "reference";
}

function isSkillNode(node: GraphNode) {
  return node.role === "skill" && node.category === "skill";
}

function buildEdgeChildrenMap(edges: readonly GraphEdge[]) {
  const map = new Map<GraphNode["id"], GraphNode["id"][]>();

  for (const edge of edges) {
    const current = map.get(edge.sourceNodeId) ?? [];
    current.push(edge.targetNodeId);
    map.set(edge.sourceNodeId, current);
  }

  return map;
}

function createTreeNodeBase(node: GraphNode, kind: "skill" | "reference") {
  const tags = readTagListMetadata(node);
  const tag = tags[0];
  const meta = kind === "reference" ? "Reference" : tag ?? "Skill";

  return {
    id: node.id,
    label: node.label,
    kind,
    skillId: readSkillIdFromNode(node),
    parentId: node.parentNodeId,
    description: node.description,
    tag,
    tags,
    color: readStringMetadata(node, "color"),
    sortOrder: readNumberMetadata(node, "sortOrder") ?? Number.MAX_SAFE_INTEGER,
    meta
  } satisfies Omit<SkillTreeNodeModel, "children">;
}

function buildSkillTreeNode(input: {
  readonly node: GraphNode;
  readonly allNodes: readonly GraphNode[];
  readonly nodeById: ReadonlyMap<GraphNode["id"], GraphNode>;
  readonly childIdsByParentId: ReadonlyMap<GraphNode["id"], readonly GraphNode["id"][]>;
  readonly depth: number;
  readonly lineage: ReadonlySet<GraphNode["id"]>;
}): SkillTreeNodeModel {
  const nextLineage = new Set(input.lineage);
  nextLineage.add(input.node.id);

  const edgeChildren = (input.childIdsByParentId.get(input.node.id) ?? [])
    .map((childId) => input.nodeById.get(childId))
    .filter((child): child is GraphNode => Boolean(child))
    .filter(isSkillNode)
    .filter((child) => !nextLineage.has(child.id))
    .sort(compareGraphNodes);

  const children =
    input.depth >= SKILL_TREE_DEPTH_LIMIT
      ? []
      : edgeChildren.map((child) =>
          buildSkillTreeNode({
            node: child,
            allNodes: input.allNodes,
            nodeById: input.nodeById,
            childIdsByParentId: input.childIdsByParentId,
            depth: input.depth + 1,
            lineage: nextLineage
          })
        );

  return {
    ...createTreeNodeBase(input.node, "skill"),
    children
  };
}

function buildFallbackInventoryTreeRoots(
  snapshot: SkillsSnapshot,
  skillGraphNodes: readonly GraphNode[]
) {
  const canonicalSkillNodesBySkillId = new Map<Skill["id"], GraphNode>();

  for (const node of skillGraphNodes) {
    if (!isSkillNode(node)) {
      continue;
    }

    const skillId = readSkillIdFromNode(node);

    if (skillId && !canonicalSkillNodesBySkillId.has(skillId)) {
      canonicalSkillNodesBySkillId.set(skillId, node);
    }
  }

  return [...snapshot.inventory]
    .sort(compareInventory)
    .map((entry, index) => {
      const backingNode =
        canonicalSkillNodesBySkillId.get(entry.skillId as Skill["id"]) ??
        (typeof entry.sourceNodeId === "string"
          ? skillGraphNodes.find((node) => node.id === entry.sourceNodeId)
          : undefined);

      return {
        id: backingNode?.id ?? (`fallback_${entry.skillId}` as GraphNode["id"]),
        label: entry.canonicalLabel,
        kind: "skill" as const,
        skillId: entry.skillId as Skill["id"],
        description:
          typeof backingNode?.description === "string" ? backingNode.description : undefined,
        tag: backingNode ? readTagListMetadata(backingNode)[0] : undefined,
        tags: backingNode ? readTagListMetadata(backingNode) : [],
        color: backingNode ? readStringMetadata(backingNode, "color") : undefined,
        sortOrder:
          (backingNode ? readNumberMetadata(backingNode, "sortOrder") : undefined) ?? index,
        meta: "Skill",
        children: []
      } satisfies SkillTreeNodeModel;
    });
}

function filterTreeByCriteria(
  nodes: readonly SkillTreeNodeModel[],
  filters: SkillTreeFilterState
): SkillTreeNodeModel[] {
  const normalizedQuery = filters.query?.trim().toLowerCase() ?? "";
  const normalizedTag = filters.tag?.trim().toLowerCase() ?? "";
  const normalizedColor = filters.color?.trim().toLowerCase() ?? "";
  const hasQuery = normalizedQuery.length > 0;
  const hasTag = normalizedTag.length > 0;
  const hasColor = normalizedColor.length > 0;

  if (!hasQuery && !hasTag && !hasColor) {
    return [...nodes];
  }

  return nodes.flatMap((node) => {
    const filteredChildren = filterTreeByCriteria(node.children, filters);
    const matchesQuery = [node.label, node.description, formatTagList(node.tags)]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
    const matchesTag =
      !hasTag || node.tags.some((tag) => tag.toLowerCase() === normalizedTag);
    const matchesColor = !hasColor || node.color?.toLowerCase() === normalizedColor;
    const matchesNode =
      (!hasQuery || matchesQuery) && matchesTag && matchesColor;

    if (!matchesNode && filteredChildren.length === 0) {
      return [];
    }

    return [
      {
        ...node,
        children: filteredChildren
      }
    ];
  });
}

function flattenSkillTreeNodes(
  nodes: readonly SkillTreeNodeModel[],
  expandedIds: ReadonlySet<string>,
  depth: number,
  rows: VisibleSkillTreeRowModel[],
  alwaysExpand: boolean
) {
  for (const node of nodes) {
    const hasChildren = node.children.length > 0;
    rows.push({
      id: node.id,
      depth,
      hasChildren,
      parentId: node.parentId,
      node
    });

    if (hasChildren && (alwaysExpand || expandedIds.has(node.id))) {
      flattenSkillTreeNodes(node.children, expandedIds, depth + 1, rows, alwaysExpand);
    }
  }
}

export function flattenVisibleSkillTree(
  treeRoots: readonly SkillTreeNodeModel[],
  expandedIds: ReadonlySet<string>,
  filters: string | SkillTreeFilterState = ""
) {
  const normalizedFilters =
    typeof filters === "string" ? { query: filters } satisfies SkillTreeFilterState : filters;
  const filteredRoots = filterTreeByCriteria(treeRoots, normalizedFilters);
  const rows: VisibleSkillTreeRowModel[] = [];
  const alwaysExpand =
    Boolean(normalizedFilters.query?.trim()) ||
    Boolean(normalizedFilters.tag?.trim()) ||
    Boolean(normalizedFilters.color?.trim());

  flattenSkillTreeNodes(filteredRoots, expandedIds, 0, rows, alwaysExpand);

  return rows;
}

function collectSkillTreeFilterValues(
  nodes: readonly SkillTreeNodeModel[],
  result: {
    readonly tags: Set<string>;
    readonly colors: Set<string>;
  }
) {
  for (const node of nodes) {
    for (const tag of node.tags) {
      result.tags.add(tag);
    }

    if (node.color) {
      result.colors.add(node.color);
    }

    collectSkillTreeFilterValues(node.children, result);
  }
}

export function resolveVisibleDropIndicator(
  rows: readonly VisibleSkillTreeRowModel[],
  indicator: SkillTreeDropIndicatorModel | null
) {
  if (!indicator) {
    return null;
  }

  if (indicator.position === "before") {
    return indicator;
  }

  const targetIndex = rows.findIndex((row) => row.id === indicator.targetNodeId);

  if (targetIndex === -1) {
    return indicator;
  }

  let displayTargetId = indicator.targetNodeId;
  const targetDepth = rows[targetIndex]!.depth;

  for (let index = targetIndex + 1; index < rows.length; index += 1) {
    const nextRow = rows[index]!;

    if (nextRow.depth <= targetDepth) {
      break;
    }

    displayTargetId = nextRow.id;
  }

  return {
    targetNodeId: displayTargetId,
    position: "after"
  } satisfies SkillTreeDropIndicatorModel;
}

export function interpretSkillTreeHotkey(input: {
  readonly key: string;
  readonly targetTagName?: string | null;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
}) {
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
    case "ArrowUp":
      return "select-previous";
    case "ArrowDown":
      return "select-next";
    case "ArrowRight":
      return "expand";
    case "ArrowLeft":
      return "collapse";
    case "Enter":
      return "edit";
    case "Delete":
    case "Backspace":
      return "delete";
    case "c":
    case "C":
      return "create-child";
    case "a":
    case "A":
      return "create-sibling";
    case "Escape":
      return "cancel";
    default:
      return null;
  }
}

export function moveSkillTreeSelection(
  rows: readonly VisibleSkillTreeRowModel[],
  selectedId: string | null,
  direction: -1 | 1
) {
  if (rows.length === 0) {
    return null;
  }

  if (!selectedId) {
    return direction > 0 ? rows[0]!.id : rows[rows.length - 1]!.id;
  }

  const currentIndex = rows.findIndex((row) => row.id === selectedId);

  if (currentIndex === -1) {
    return direction > 0 ? rows[0]!.id : rows[rows.length - 1]!.id;
  }

  const nextIndex = Math.max(0, Math.min(rows.length - 1, currentIndex + direction));
  return rows[nextIndex]!.id;
}

export function buildSkillsPanelModel(snapshot: SkillsSnapshot): SkillsPanelModel {
  const skillGraphNodes = (snapshot.skillGraph?.nodes ?? []).filter(isSkillTreeNode);
  const skillGraphEdges = (snapshot.skillGraph?.edges ?? []).filter((edge) =>
    skillGraphNodes.some((node) => node.id === edge.sourceNodeId) &&
    skillGraphNodes.some((node) => node.id === edge.targetNodeId)
  );
  const nodesById = new Map(skillGraphNodes.map((node) => [node.id, node] as const));
  const childIdsByParentId = buildEdgeChildrenMap(skillGraphEdges);
  const skillGraphRootNodes = skillGraphNodes
    .filter(isSkillNode)
    .filter((node) => node.parentNodeId === undefined)
    .sort(compareGraphNodes);

  const treeRoots = skillGraphRootNodes.map((node) =>
    buildSkillTreeNode({
      node,
      allNodes: skillGraphNodes,
      nodeById: nodesById,
      childIdsByParentId,
      depth: 1,
      lineage: new Set()
    })
  );
  const resolvedTreeRoots =
    treeRoots.length > 0
      ? treeRoots
      : buildFallbackInventoryTreeRoots(snapshot, skillGraphNodes);

  return {
    inventorySummary: {
      totalCanonicalSkills:
        snapshot.summary.totalCanonicalSkills || [...snapshot.inventory].sort(compareInventory).length,
      totalReferenceNodes: snapshot.summary.totalReferenceNodes,
      totalSkillGraphNodes: snapshot.summary.totalSkillGraphNodes
    },
    treeRoots: resolvedTreeRoots,
    availableTagFilters: (() => {
      const values = {
        tags: new Set<string>(),
        colors: new Set<string>()
      };
      collectSkillTreeFilterValues(resolvedTreeRoots, values);
      return [...values.tags].sort((left, right) => left.localeCompare(right));
    })(),
    availableColorFilters: (() => {
      const values = {
        tags: new Set<string>(),
        colors: new Set<string>()
      };
      collectSkillTreeFilterValues(resolvedTreeRoots, values);
      return [...values.colors].sort((left, right) => left.localeCompare(right));
    })(),
    hiddenFeatureNotes: TEMPORARILY_HIDDEN_SKILLTREE_FEATURES
  };
}
