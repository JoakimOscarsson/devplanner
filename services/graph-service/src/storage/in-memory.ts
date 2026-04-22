import {
  ID_PREFIXES,
  type ActorId,
  type CommonErrorCode,
  type DomainError,
  type IsoDateTime,
  type JsonObject,
  type WorkspaceId
} from "@pdp-helper/contracts-core";
import type {
  Canvas,
  CanvasMode,
  DuplicateSkillCandidate,
  GraphEdge,
  GraphNode,
  GraphNodeCategory,
  GraphNodePosition,
  Skill
} from "@pdp-helper/contracts-graph";

const workspaceId = "wrk_demo_owner" as WorkspaceId;
const actorId = "act_demo_owner" as ActorId;

type CanvasRecord = Canvas;
type NodeRecord = GraphNode;
type EdgeRecord = GraphEdge;
type SkillRecord = Skill;

interface SkillInventoryEntry {
  skillId: Skill["id"];
  canonicalLabel: string;
  normalizedLabel: string;
  sourceNodeId?: GraphNode["id"];
  sourceNodeLabel?: string;
  sourceCanvasId?: Canvas["id"];
  sourceCanvasName?: string;
  referenceCount: number;
}

interface SkillInventorySnapshot {
  inventory: SkillInventoryEntry[];
  summary: {
    totalCanonicalSkills: number;
    totalReferenceNodes: number;
    totalSkillGraphNodes: number;
  };
}

interface DuplicateSkillMatch extends DuplicateSkillCandidate {
  sourceNodeLabel?: string;
  sourceCanvasName?: string;
  referenceCount: number;
  matchKind: "exact" | "related";
}

interface DuplicateSkillCheckResult {
  queryLabel: string;
  normalizedLabel: string;
  exactMatch: boolean;
  suggestedStrategy:
    | "use-existing-canonical"
    | "create-reference-to-existing"
    | "create-new-canonical";
  guidance: string;
  candidates: DuplicateSkillMatch[];
  summary: {
    totalCanonicalSkills: number;
    totalReferenceNodes: number;
    totalCandidates: number;
    exactMatchCount: number;
  };
}

interface GraphSeed {
  canvases: CanvasRecord[];
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  skills: SkillRecord[];
}

function now(): IsoDateTime {
  return new Date().toISOString() as IsoDateTime;
}

function auditFields(timestamp = now()) {
  return {
    workspaceId,
    createdBy: actorId,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function buildId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

function normalizeLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCanvasName(canvasId?: Canvas["id"]) {
  if (!canvasId) {
    return undefined;
  }

  return graphStore.canvases.find((canvas) => canvas.id === canvasId)?.name;
}

function findNode(nodeId?: GraphNode["id"]) {
  if (!nodeId) {
    return undefined;
  }

  return graphStore.nodes.find((node) => node.id === nodeId);
}

function getReferenceNodesForSkill(skillId: Skill["id"]) {
  return graphStore.nodes.filter(
    (node) =>
      node.role === "reference" &&
      node.metadata &&
      typeof node.metadata.skillId === "string" &&
      node.metadata.skillId === skillId
  );
}

function storeError<TCode extends CommonErrorCode>(
  code: TCode,
  message: string,
  status: number,
  details?: JsonObject
): DomainError<TCode> {
  return {
    code,
    message,
    status,
    retryable: false,
    ...(details ? { details } : {})
  };
}

function graphSeed(): GraphSeed {
  return {
    canvases: [
      {
        id: "can_brainstorm_inbox" as Canvas["id"],
        name: "Inbox",
        mode: "brainstorm",
        sortOrder: 0,
        ...auditFields()
      },
      {
        id: "can_brainstorm_certifications" as Canvas["id"],
        name: "Certifications",
        mode: "brainstorm",
        sortOrder: 1,
        ...auditFields()
      },
      {
        id: "can_skill_graph" as Canvas["id"],
        name: "Skill Graph",
        mode: "skill-graph",
        sortOrder: 0,
        ...auditFields()
      }
    ] satisfies CanvasRecord[],
    nodes: [
      {
        id: "nod_brainstorm_typescript" as GraphNode["id"],
        canvasId: "can_brainstorm_inbox" as GraphNode["canvasId"],
        role: "brainstorm",
        category: "skill",
        label: "TypeScript",
        normalizedLabel: "typescript",
        position: { x: 64, y: 84 },
        source: "user",
        ...auditFields()
      },
      {
        id: "nod_brainstorm_aws" as GraphNode["id"],
        canvasId: "can_brainstorm_certifications" as GraphNode["canvasId"],
        role: "brainstorm",
        category: "certificate",
        label: "AWS Developer Associate",
        normalizedLabel: "aws-developer-associate",
        position: { x: 220, y: 40 },
        source: "user",
        ...auditFields()
      },
      {
        id: "nod_skill_typescript" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "TypeScript",
        normalizedLabel: "typescript",
        position: { x: 96, y: 120 },
        source: "user",
        ...auditFields()
      },
      {
        id: "nod_reference_typescript_planner" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "reference",
        category: "skill",
        label: "TypeScript for planning flows",
        normalizedLabel: "typescript-for-planning-flows",
        position: { x: 96, y: 244 },
        source: "user",
        metadata: {
          skillId: "skl_typescript"
        },
        ...auditFields()
      },
      {
        id: "nod_skill_event_architecture" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Event-Driven Architecture",
        normalizedLabel: "event-driven-architecture",
        position: { x: 320, y: 88 },
        source: "user",
        ...auditFields()
      },
      {
        id: "nod_reference_event_architecture_cert" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "reference",
        category: "skill",
        label: "Event architecture for certification path",
        normalizedLabel: "event-architecture-for-certification-path",
        position: { x: 320, y: 228 },
        source: "user",
        metadata: {
          skillId: "skl_event_architecture"
        },
        ...auditFields()
      },
      {
        id: "nod_recommendation_events" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "recommendation",
        category: "recommendation",
        label: "Explore event-driven design",
        normalizedLabel: "explore-event-driven-design",
        position: { x: 288, y: 180 },
        source: "built-in-recommender",
        ...auditFields()
      }
    ] satisfies NodeRecord[],
    edges: [
      {
        id: "edg_aws_typescript" as GraphEdge["id"],
        canvasId: "can_brainstorm_certifications" as GraphEdge["canvasId"],
        sourceNodeId: "nod_brainstorm_aws" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_brainstorm_typescript" as GraphEdge["targetNodeId"],
        kind: "depends-on",
        ...auditFields()
      }
    ] satisfies EdgeRecord[],
    skills: [
      {
        id: "skl_typescript" as Skill["id"],
        canonicalLabel: "TypeScript",
        normalizedLabel: "typescript",
        sourceNodeId: "nod_brainstorm_typescript" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_event_architecture" as Skill["id"],
        canonicalLabel: "Event-Driven Architecture",
        normalizedLabel: "event-driven-architecture",
        sourceNodeId: "nod_skill_event_architecture" as Skill["sourceNodeId"],
        ...auditFields()
      }
    ] satisfies SkillRecord[]
  };
}

function clampSortOrder(sortOrder: number, maxIndex: number) {
  return Math.max(0, Math.min(sortOrder, maxIndex));
}

function nextNodePosition(canvasId: Canvas["id"]): GraphNodePosition {
  const canvasNodes = graphStore.nodes.filter((node) => node.canvasId === canvasId);
  const index = canvasNodes.length;

  return {
    x: 48 + (index % 3) * 192,
    y: 48 + Math.floor(index / 3) * 148
  };
}

function getBrainstormCanvases() {
  return graphStore.canvases
    .filter((canvas) => canvas.mode === "brainstorm")
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

function setBrainstormCanvases(canvases: CanvasRecord[]) {
  const otherCanvases = graphStore.canvases.filter(
    (canvas) => canvas.mode !== "brainstorm"
  );

  graphStore.canvases = [...canvases, ...otherCanvases];
}

function assertCanvas(canvasId: Canvas["id"]) {
  const canvas = graphStore.canvases.find((entry) => entry.id === canvasId);

  if (!canvas) {
    throw storeError("NOT_FOUND", `Canvas ${canvasId} was not found.`, 404);
  }

  return canvas;
}

function assertMutableBrainstormCanvas(canvasId: Canvas["id"]) {
  const canvas = assertCanvas(canvasId);

  if (canvas.mode !== "brainstorm") {
    throw storeError(
      "FORBIDDEN",
      "Only brainstorm canvases can be mutated through the demo canvas routes.",
      403
    );
  }

  return canvas;
}

function assertNodeInCanvas(canvasId: Canvas["id"], nodeId: GraphNode["id"]) {
  const node = graphStore.nodes.find(
    (entry) => entry.canvasId === canvasId && entry.id === nodeId
  );

  if (!node) {
    throw storeError("NOT_FOUND", `Node ${nodeId} was not found.`, 404);
  }

  return node;
}

function assertParentNode(
  canvasId: Canvas["id"],
  nodeId: GraphNode["id"],
  parentNodeId: GraphNode["id"]
) {
  if (parentNodeId === nodeId) {
    throw storeError(
      "VALIDATION_FAILED",
      "A node cannot be its own parent.",
      422,
      {
        issues: [
          {
            path: "parentNodeId",
            rule: "self-reference",
            message: "A node cannot be its own parent."
          }
        ]
      }
    );
  }

  return assertNodeInCanvas(canvasId, parentNodeId);
}

function replaceParentEdge(
  canvasId: Canvas["id"],
  nodeId: GraphNode["id"],
  parentNodeId?: GraphNode["id"]
) {
  graphStore.edges = graphStore.edges.filter(
    (edge) =>
      !(
        edge.canvasId === canvasId &&
        edge.kind === "contains" &&
        edge.targetNodeId === nodeId
      )
  );

  if (!parentNodeId) {
    return;
  }

  const timestamp = now();
  graphStore.edges = [
    ...graphStore.edges,
    {
      id: buildId(ID_PREFIXES.edge) as GraphEdge["id"],
      canvasId,
      sourceNodeId: parentNodeId,
      targetNodeId: nodeId,
      kind: "contains",
      ...auditFields(timestamp)
    }
  ];
}

function reorderBrainstormCanvases(
  targetCanvas: CanvasRecord,
  requestedSortOrder: number
) {
  const timestamp = now();
  const otherCanvases = getBrainstormCanvases().filter(
    (canvas) => canvas.id !== targetCanvas.id
  );
  const insertionIndex = clampSortOrder(requestedSortOrder, otherCanvases.length);
  const orderedCanvases = [
    ...otherCanvases.slice(0, insertionIndex),
    targetCanvas,
    ...otherCanvases.slice(insertionIndex)
  ].map((canvas, sortOrder) =>
    canvas.sortOrder === sortOrder && canvas.id !== targetCanvas.id
      ? canvas
      : {
          ...canvas,
          sortOrder,
          updatedAt: timestamp
        }
  );

  setBrainstormCanvases(orderedCanvases);

  return graphStore.canvases.find((canvas) => canvas.id === targetCanvas.id)!;
}

export const graphStore = {
  workspaceId,
  canvases: [] as CanvasRecord[],
  nodes: [] as NodeRecord[],
  edges: [] as EdgeRecord[],
  skills: [] as SkillRecord[]
};

export function resetGraphStore() {
  const seed = graphSeed();
  graphStore.canvases = seed.canvases;
  graphStore.nodes = seed.nodes;
  graphStore.edges = seed.edges;
  graphStore.skills = seed.skills;
}

resetGraphStore();

export function listCanvases() {
  return [...graphStore.canvases].sort((left, right) => {
    if (left.mode !== right.mode) {
      return left.mode.localeCompare(right.mode);
    }

    return left.sortOrder - right.sortOrder;
  });
}

export function getCanvasGraph(canvasId: Canvas["id"]) {
  const canvas = graphStore.canvases.find((entry) => entry.id === canvasId);

  if (!canvas) {
    return null;
  }

  return {
    canvas,
    nodes: graphStore.nodes.filter((node) => node.canvasId === canvasId),
    edges: graphStore.edges.filter((edge) => edge.canvasId === canvasId)
  };
}

export function createCanvas(input: {
  name: string;
  mode?: CanvasMode;
  sortOrder?: number;
}) {
  if (input.mode && input.mode !== "brainstorm") {
    throw storeError(
      "VALIDATION_FAILED",
      "Only brainstorm canvases can be created through this route.",
      422,
      {
        issues: [
          {
            path: "mode",
            rule: "literal",
            message: "Only brainstorm canvases can be created through this route."
          }
        ]
      }
    );
  }

  const timestamp = now();
  const canvas: CanvasRecord = {
    id: buildId(ID_PREFIXES.canvas) as Canvas["id"],
    name: input.name.trim(),
    mode: "brainstorm",
    sortOrder: clampSortOrder(
      input.sortOrder ?? getBrainstormCanvases().length,
      getBrainstormCanvases().length
    ),
    ...auditFields(timestamp)
  };

  setBrainstormCanvases([...getBrainstormCanvases(), canvas]);

  return reorderBrainstormCanvases(canvas, canvas.sortOrder);
}

export function updateCanvas(
  canvasId: Canvas["id"],
  changes: {
    name?: string;
    sortOrder?: number;
  }
) {
  const canvas = assertMutableBrainstormCanvas(canvasId);
  const updatedCanvas: CanvasRecord = {
    ...canvas,
    ...(typeof changes.name === "string" ? { name: changes.name.trim() } : {}),
    updatedAt: now()
  };

  return reorderBrainstormCanvases(
    updatedCanvas,
    typeof changes.sortOrder === "number" ? changes.sortOrder : canvas.sortOrder
  );
}

export function createNode(
  canvasId: Canvas["id"],
  input: {
    label: string;
    category: GraphNodeCategory;
    description?: string;
    parentNodeId?: GraphNode["id"];
    position?: GraphNodePosition;
  }
) {
  assertMutableBrainstormCanvas(canvasId);

  if (input.parentNodeId) {
    assertParentNode(
      canvasId,
      `nod_pending_${crypto.randomUUID().replaceAll("-", "")}` as GraphNode["id"],
      input.parentNodeId
    );
  }

  const timestamp = now();
  const node: NodeRecord = {
    id: buildId(ID_PREFIXES.node) as GraphNode["id"],
    canvasId,
    role: "brainstorm",
    category: input.category,
    label: input.label.trim(),
    normalizedLabel: normalizeLabel(input.label),
    position: input.position ?? nextNodePosition(canvasId),
    source: "user",
    ...(typeof input.description === "string" && input.description.trim().length > 0
      ? { description: input.description.trim() }
      : {}),
    ...(input.parentNodeId ? { parentNodeId: input.parentNodeId } : {}),
    ...auditFields(timestamp)
  };

  graphStore.nodes = [...graphStore.nodes, node];
  replaceParentEdge(canvasId, node.id, node.parentNodeId);

  return node;
}

export function updateNode(
  canvasId: Canvas["id"],
  nodeId: GraphNode["id"],
  changes: {
    label?: string;
    category?: GraphNodeCategory;
    description?: string | null;
    position?: GraphNodePosition;
    parentNodeId?: GraphNode["id"] | null;
  }
) {
  assertMutableBrainstormCanvas(canvasId);
  const node = assertNodeInCanvas(canvasId, nodeId);

  if (changes.parentNodeId) {
    assertParentNode(canvasId, nodeId, changes.parentNodeId);
  }

  const nextLabel =
    typeof changes.label === "string" ? changes.label.trim() : node.label;
  const updatedNode: NodeRecord = {
    ...node,
    ...(typeof changes.label === "string"
      ? {
          label: nextLabel,
          normalizedLabel: normalizeLabel(nextLabel)
        }
      : {}),
    ...(changes.category ? { category: changes.category } : {}),
    ...(Object.prototype.hasOwnProperty.call(changes, "description")
      ? changes.description
        ? { description: changes.description.trim() }
        : { description: undefined }
      : {}),
    ...(changes.position ? { position: changes.position } : {}),
    ...(Object.prototype.hasOwnProperty.call(changes, "parentNodeId")
      ? changes.parentNodeId
        ? { parentNodeId: changes.parentNodeId }
        : { parentNodeId: undefined }
      : {}),
    updatedAt: now()
  };

  graphStore.nodes = graphStore.nodes.map((entry) =>
    entry.id === nodeId ? updatedNode : entry
  );
  replaceParentEdge(canvasId, nodeId, updatedNode.parentNodeId);

  return updatedNode;
}

export function deleteNode(canvasId: Canvas["id"], nodeId: GraphNode["id"]) {
  assertMutableBrainstormCanvas(canvasId);
  assertNodeInCanvas(canvasId, nodeId);

  const timestamp = now();
  graphStore.nodes = graphStore.nodes.flatMap((node) => {
    if (node.id === nodeId && node.canvasId === canvasId) {
      return [];
    }

    if (node.parentNodeId === nodeId) {
      return [
        {
          ...node,
          parentNodeId: undefined,
          updatedAt: timestamp
        }
      ];
    }

    return [node];
  });
  graphStore.edges = graphStore.edges.filter(
    (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId
  );

  return {
    deletedNodeId: nodeId
  };
}

export function findDuplicateSkillCandidates(label: string) {
  const requestedLabel = label.trim().toLowerCase();

  return graphStore.skills
    .filter((skill) => skill.normalizedLabel.includes(requestedLabel))
    .map(
      (skill) =>
        ({
          skillId: skill.id,
          canonicalLabel: skill.canonicalLabel,
          normalizedLabel: skill.normalizedLabel,
          sourceNodeId: skill.sourceNodeId,
          similarityScore: skill.normalizedLabel === requestedLabel ? 1 : 0.82
        }) satisfies DuplicateSkillCandidate
    );
}

export function getSkillInventory(): SkillInventorySnapshot {
  const inventory = graphStore.skills
    .map((skill) => {
      const sourceNode = findNode(skill.sourceNodeId);
      const referenceNodes = getReferenceNodesForSkill(skill.id);

      return {
        skillId: skill.id,
        canonicalLabel: skill.canonicalLabel,
        normalizedLabel: skill.normalizedLabel,
        sourceNodeId: skill.sourceNodeId,
        sourceNodeLabel: sourceNode?.label,
        sourceCanvasId: sourceNode?.canvasId,
        sourceCanvasName: getCanvasName(sourceNode?.canvasId),
        referenceCount: referenceNodes.length
      } satisfies SkillInventoryEntry;
    })
    .sort((left, right) => left.canonicalLabel.localeCompare(right.canonicalLabel));

  return {
    inventory,
    summary: {
      totalCanonicalSkills: graphStore.skills.length,
      totalReferenceNodes: graphStore.nodes.filter((node) => node.role === "reference")
        .length,
      totalSkillGraphNodes: graphStore.nodes.filter(
        (node) =>
          node.canvasId === ("can_skill_graph" as Canvas["id"]) &&
          (node.role === "skill" || node.role === "reference")
      ).length
    }
  };
}

export function checkDuplicateSkill(label: string): DuplicateSkillCheckResult {
  const queryLabel = label.trim();
  const normalized = normalizeLabel(queryLabel);
  const inventory = getSkillInventory();
  const candidates = findDuplicateSkillCandidates(queryLabel)
    .map((candidate) => {
      const inventoryEntry = inventory.inventory.find(
        (entry) => entry.skillId === candidate.skillId
      );

      return {
        ...candidate,
        sourceNodeLabel: inventoryEntry?.sourceNodeLabel,
        sourceCanvasName: inventoryEntry?.sourceCanvasName,
        referenceCount: inventoryEntry?.referenceCount ?? 0,
        matchKind:
          candidate.normalizedLabel === normalized ? "exact" : "related"
      } satisfies DuplicateSkillMatch;
    })
    .sort((left, right) => right.similarityScore - left.similarityScore);

  const exactMatchCount = candidates.filter(
    (candidate) => candidate.matchKind === "exact"
  ).length;
  const exactMatch = exactMatchCount > 0;
  const suggestedStrategy = exactMatch
    ? "create-reference-to-existing"
    : candidates.length > 0
      ? "use-existing-canonical"
      : "create-new-canonical";

  const guidance =
    suggestedStrategy === "create-reference-to-existing"
      ? "A canonical skill already exists. Keep the existing canonical skill and create a reference node when you need another appearance in the graph."
      : suggestedStrategy === "use-existing-canonical"
        ? "A closely related canonical skill already exists. Review the candidate before creating anything new."
        : "No close canonical skill was found. It is safe to create a new canonical skill in the demo graph.";

  return {
    queryLabel,
    normalizedLabel: normalized,
    exactMatch,
    suggestedStrategy,
    guidance,
    candidates,
    summary: {
      totalCanonicalSkills: inventory.summary.totalCanonicalSkills,
      totalReferenceNodes: inventory.summary.totalReferenceNodes,
      totalCandidates: candidates.length,
      exactMatchCount
    }
  };
}
