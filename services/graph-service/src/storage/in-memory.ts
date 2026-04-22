import {
  ID_PREFIXES,
  type ActorId,
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

interface SkillPromotionResult {
  skill: SkillRecord;
  skillNode: NodeRecord;
}

interface DuplicateResolutionResult {
  canonicalSkill: SkillRecord;
  referenceNode: NodeRecord;
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
    .replace(/\+\+/g, " plus plus ")
    .replace(/\+/g, " plus ")
    .replace(/#/g, " sharp ")
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

function readNodeStringMetadata(node: NodeRecord, key: string) {
  const value = node.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function parseTagList(input: string | undefined | null) {
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

function formatTagList(tags: readonly string[]) {
  return tags.join(", ");
}

function readNodeTagString(node: NodeRecord) {
  const explicitTags = node.metadata?.tags;

  if (Array.isArray(explicitTags)) {
    const tags = explicitTags.filter((entry): entry is string => typeof entry === "string");

    if (tags.length > 0) {
      return formatTagList(tags);
    }
  }

  return readNodeStringMetadata(node, "tag");
}

function readNodeNumberMetadata(node: NodeRecord, key: string) {
  const value = node.metadata?.[key];
  return typeof value === "number" ? value : undefined;
}

function buildSkillTreeMetadata(input: {
  readonly skillId?: Skill["id"];
  readonly sourceNodeId?: GraphNode["id"];
  readonly referenceNodeId?: GraphNode["id"];
  readonly tag?: string | null;
  readonly color?: string | null;
  readonly sortOrder?: number;
  readonly existing?: JsonObject;
}) {
  const metadata: Record<string, unknown> = {
    ...(input.existing ?? {})
  };

  if (input.skillId) {
    metadata.skillId = input.skillId;
  }

  if (input.sourceNodeId) {
    metadata.sourceNodeId = input.sourceNodeId;
  }

  if (input.referenceNodeId) {
    metadata.referenceNodeId = input.referenceNodeId;
  }

  if (input.tag !== undefined) {
    const tags = parseTagList(input.tag);

    if (tags.length > 0) {
      metadata.tag = formatTagList(tags);
      metadata.tags = tags;
    } else {
      delete metadata.tag;
      delete metadata.tags;
    }
  }

  if (input.color !== undefined) {
    const color = input.color?.trim() ?? "";

    if (color.length > 0) {
      metadata.color = color;
    } else {
      delete metadata.color;
    }
  }

  if (typeof input.sortOrder === "number") {
    metadata.sortOrder = input.sortOrder;
  }

  return metadata as JsonObject;
}

function storeError<TCode extends string>(
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
        id: "nod_skill_frontend" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Frontend",
        normalizedLabel: "frontend",
        position: { x: 96, y: 64 },
        source: "user",
        metadata: {
          skillId: "skl_frontend",
          sortOrder: 0
        },
        ...auditFields()
      },
      {
        id: "nod_skill_html_css" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "HTML & CSS",
        normalizedLabel: "html-css",
        parentNodeId: "nod_skill_frontend" as GraphNode["id"],
        position: { x: 96, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_html_css",
          sortOrder: 0
        },
        ...auditFields()
      },
      {
        id: "nod_skill_typescript" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "TypeScript",
        normalizedLabel: "typescript",
        parentNodeId: "nod_skill_frontend" as GraphNode["id"],
        position: { x: 248, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_typescript",
          sortOrder: 1
        },
        ...auditFields()
      },
      {
        id: "nod_skill_react" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "React",
        normalizedLabel: "react",
        parentNodeId: "nod_skill_frontend" as GraphNode["id"],
        position: { x: 400, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_react",
          sortOrder: 2
        },
        ...auditFields()
      },
      {
        id: "nod_skill_state_management" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "State Management",
        normalizedLabel: "state-management",
        parentNodeId: "nod_skill_typescript" as GraphNode["id"],
        position: { x: 248, y: 232 },
        source: "user",
        metadata: {
          skillId: "skl_state_management",
          sortOrder: 0
        },
        ...auditFields()
      },
      {
        id: "nod_reference_typescript_planner" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "reference",
        category: "skill",
        label: "TypeScript for planning flows",
        normalizedLabel: "typescript-for-planning-flows",
        position: { x: 96, y: 312 },
        source: "user",
        parentNodeId: "nod_skill_typescript" as GraphNode["id"],
        metadata: {
          skillId: "skl_typescript",
          sortOrder: 0
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
        position: { x: 560, y: 64 },
        source: "user",
        metadata: {
          skillId: "skl_event_architecture",
          sortOrder: 1
        },
        ...auditFields()
      },
      {
        id: "nod_skill_message_brokers" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Message Brokers",
        normalizedLabel: "message-brokers",
        parentNodeId: "nod_skill_event_architecture" as GraphNode["id"],
        position: { x: 560, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_message_brokers",
          sortOrder: 0
        },
        ...auditFields()
      },
      {
        id: "nod_reference_event_architecture_cert" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "reference",
        category: "skill",
        label: "Event architecture for certification path",
        normalizedLabel: "event-architecture-for-certification-path",
        position: { x: 560, y: 312 },
        source: "user",
        parentNodeId: "nod_skill_event_architecture" as GraphNode["id"],
        metadata: {
          skillId: "skl_event_architecture",
          sortOrder: 1
        },
        ...auditFields()
      },
      {
        id: "nod_skill_databases" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Databases",
        normalizedLabel: "databases",
        position: { x: 768, y: 64 },
        source: "user",
        metadata: {
          skillId: "skl_databases",
          sortOrder: 2
        },
        ...auditFields()
      },
      {
        id: "nod_skill_devops" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "DevOps & Infrastructure",
        normalizedLabel: "devops-infrastructure",
        position: { x: 976, y: 64 },
        source: "user",
        metadata: {
          skillId: "skl_devops_infrastructure",
          sortOrder: 3
        },
        ...auditFields()
      },
      {
        id: "nod_skill_ci_cd" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "CI/CD",
        normalizedLabel: "ci-cd",
        parentNodeId: "nod_skill_devops" as GraphNode["id"],
        position: { x: 976, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_ci_cd",
          sortOrder: 0
        },
        ...auditFields()
      },
      {
        id: "nod_skill_leadership" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Leadership",
        normalizedLabel: "leadership",
        position: { x: 1184, y: 64 },
        source: "user",
        metadata: {
          skillId: "skl_leadership",
          sortOrder: 4
        },
        ...auditFields()
      },
      {
        id: "nod_skill_mentoring" as GraphNode["id"],
        canvasId: "can_skill_graph" as GraphNode["canvasId"],
        role: "skill",
        category: "skill",
        label: "Mentoring",
        normalizedLabel: "mentoring",
        parentNodeId: "nod_skill_leadership" as GraphNode["id"],
        position: { x: 1184, y: 148 },
        source: "user",
        metadata: {
          skillId: "skl_mentoring",
          sortOrder: 0
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
      },
      {
        id: "edg_skill_typescript_reference" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_typescript" as GraphEdge["sourceNodeId"],
        targetNodeId:
          "nod_reference_typescript_planner" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_frontend_html_css" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_frontend" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_html_css" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_frontend_typescript" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_frontend" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_typescript" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_frontend_react" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_frontend" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_react" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_typescript_state_management" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_typescript" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_state_management" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_event_architecture_reference" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_event_architecture" as GraphEdge["sourceNodeId"],
        targetNodeId:
          "nod_reference_event_architecture_cert" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_event_architecture_message_brokers" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_event_architecture" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_message_brokers" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_devops_ci_cd" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_devops" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_ci_cd" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      },
      {
        id: "edg_skill_leadership_mentoring" as GraphEdge["id"],
        canvasId: "can_skill_graph" as GraphEdge["canvasId"],
        sourceNodeId: "nod_skill_leadership" as GraphEdge["sourceNodeId"],
        targetNodeId: "nod_skill_mentoring" as GraphEdge["targetNodeId"],
        kind: "contains",
        ...auditFields()
      }
    ] satisfies EdgeRecord[],
    skills: [
      {
        id: "skl_frontend" as Skill["id"],
        canonicalLabel: "Frontend",
        normalizedLabel: "frontend",
        sourceNodeId: "nod_skill_frontend" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_html_css" as Skill["id"],
        canonicalLabel: "HTML & CSS",
        normalizedLabel: "html-css",
        sourceNodeId: "nod_skill_html_css" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_typescript" as Skill["id"],
        canonicalLabel: "TypeScript",
        normalizedLabel: "typescript",
        sourceNodeId: "nod_brainstorm_typescript" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_react" as Skill["id"],
        canonicalLabel: "React",
        normalizedLabel: "react",
        sourceNodeId: "nod_skill_react" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_state_management" as Skill["id"],
        canonicalLabel: "State Management",
        normalizedLabel: "state-management",
        sourceNodeId: "nod_skill_state_management" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_event_architecture" as Skill["id"],
        canonicalLabel: "Event-Driven Architecture",
        normalizedLabel: "event-driven-architecture",
        sourceNodeId: "nod_skill_event_architecture" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_message_brokers" as Skill["id"],
        canonicalLabel: "Message Brokers",
        normalizedLabel: "message-brokers",
        sourceNodeId: "nod_skill_message_brokers" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_databases" as Skill["id"],
        canonicalLabel: "Databases",
        normalizedLabel: "databases",
        sourceNodeId: "nod_skill_databases" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_devops_infrastructure" as Skill["id"],
        canonicalLabel: "DevOps & Infrastructure",
        normalizedLabel: "devops-infrastructure",
        sourceNodeId: "nod_skill_devops" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_ci_cd" as Skill["id"],
        canonicalLabel: "CI/CD",
        normalizedLabel: "ci-cd",
        sourceNodeId: "nod_skill_ci_cd" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_leadership" as Skill["id"],
        canonicalLabel: "Leadership",
        normalizedLabel: "leadership",
        sourceNodeId: "nod_skill_leadership" as Skill["sourceNodeId"],
        ...auditFields()
      },
      {
        id: "skl_mentoring" as Skill["id"],
        canonicalLabel: "Mentoring",
        normalizedLabel: "mentoring",
        sourceNodeId: "nod_skill_mentoring" as Skill["sourceNodeId"],
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

function assertNode(nodeId: GraphNode["id"]) {
  const node = graphStore.nodes.find((entry) => entry.id === nodeId);

  if (!node) {
    throw storeError("NOT_FOUND", `Node ${nodeId} was not found.`, 404);
  }

  return node;
}

function assertSkill(skillId: Skill["id"]) {
  const skill = graphStore.skills.find((entry) => entry.id === skillId);

  if (!skill) {
    throw storeError("NOT_FOUND", `Skill ${skillId} was not found.`, 404);
  }

  return skill;
}

function getSkillGraphCanvas() {
  const canvas = graphStore.canvases.find(
    (entry) => entry.mode === "skill-graph" && entry.id === ("can_skill_graph" as Canvas["id"])
  );

  if (!canvas) {
    throw storeError("NOT_FOUND", "Skill graph canvas was not found.", 404);
  }

  return canvas;
}

function isSkillTreeNode(node: NodeRecord) {
  return (
    node.canvasId === getSkillGraphCanvas().id &&
    node.category === "skill" &&
    (node.role === "skill" || node.role === "reference")
  );
}

function assertSkillTreeNode(nodeId: GraphNode["id"]) {
  const node = assertNode(nodeId);

  if (!isSkillTreeNode(node)) {
    throw storeError("NOT_FOUND", `Skill-tree node ${nodeId} was not found.`, 404);
  }

  return node;
}

function getSkillTreeChildren(parentNodeId?: GraphNode["id"]) {
  return graphStore.nodes
    .filter(isSkillTreeNode)
    .filter((node) =>
      parentNodeId ? node.parentNodeId === parentNodeId : node.parentNodeId === undefined
    )
    .sort((left, right) => {
      const sortDifference =
        (readNodeNumberMetadata(left, "sortOrder") ?? Number.MAX_SAFE_INTEGER) -
        (readNodeNumberMetadata(right, "sortOrder") ?? Number.MAX_SAFE_INTEGER);

      if (sortDifference !== 0) {
        return sortDifference;
      }

      if (left.role !== right.role) {
        return left.role.localeCompare(right.role);
      }

      return left.label.localeCompare(right.label);
    });
}

function nextSkillTreeSortOrder(parentNodeId?: GraphNode["id"]) {
  return getSkillTreeChildren(parentNodeId).length;
}

function renumberSkillTreeSiblings(parentNodeId?: GraphNode["id"]) {
  const siblings = getSkillTreeChildren(parentNodeId);
  const timestamp = now();

  graphStore.nodes = graphStore.nodes.map((node) => {
    const siblingIndex = siblings.findIndex((entry) => entry.id === node.id);

    if (siblingIndex === -1) {
      return node;
    }

    return {
      ...node,
      metadata: buildSkillTreeMetadata({
        existing: node.metadata,
        sortOrder: siblingIndex
      }),
      updatedAt: timestamp
    };
  });

  return getSkillTreeChildren(parentNodeId);
}

function getSkillTreeDescendantIds(nodeId: GraphNode["id"]) {
  const descendantIds = new Set<GraphNode["id"]>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentNodeId = queue.shift()!;
    const children = graphStore.nodes
      .filter(isSkillTreeNode)
      .filter((node) => node.parentNodeId === currentNodeId);

    for (const child of children) {
      if (descendantIds.has(child.id)) {
        continue;
      }

      descendantIds.add(child.id);
      queue.push(child.id);
    }
  }

  return descendantIds;
}

function assertSkillTreeParent(nodeId: GraphNode["id"], parentNodeId: GraphNode["id"]) {
  const parentNode = assertSkillTreeNode(parentNodeId);

  if (parentNode.role !== "skill") {
    throw storeError(
      "VALIDATION_FAILED",
      "Only skill nodes can be parents in the skill tree.",
      422,
      {
        issues: [
          {
            path: "parentNodeId",
            rule: "role",
            message: "Only skill nodes can be parents in the skill tree."
          }
        ]
      }
    );
  }

  if (parentNodeId === nodeId || getSkillTreeDescendantIds(nodeId).has(parentNodeId)) {
    throw storeError(
      "VALIDATION_FAILED",
      "A skill-tree node cannot be moved into its own subtree.",
      422,
      {
        issues: [
          {
            path: "parentNodeId",
            rule: "cycle",
            message: "A skill-tree node cannot be moved into its own subtree."
          }
        ]
      }
    );
  }

  return parentNode;
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

function nextSkillGraphPosition(role: "skill" | "reference") {
  const canvasId = getSkillGraphCanvas().id;
  const roleNodes = graphStore.nodes.filter(
    (node) => node.canvasId === canvasId && node.role === role
  );
  const index = roleNodes.length;

  return role === "skill"
    ? {
        x: 96 + (index % 3) * 220,
        y: 88 + Math.floor(index / 3) * 180
      }
    : {
        x: 96 + (index % 3) * 220,
        y: 228 + Math.floor(index / 3) * 180
      };
}

function findSkillGraphNode(skillId: Skill["id"]) {
  const skillGraphCanvasId = getSkillGraphCanvas().id;

  return graphStore.nodes.find(
    (node) =>
      node.canvasId === skillGraphCanvasId &&
      node.role === "skill" &&
      node.metadata &&
      typeof node.metadata.skillId === "string" &&
      node.metadata.skillId === skillId
  );
}

function createSkillGraphNode(skill: SkillRecord, sourceNode: NodeRecord) {
  const timestamp = now();
  const skillNode: NodeRecord = {
    id: buildId(ID_PREFIXES.node) as GraphNode["id"],
    canvasId: getSkillGraphCanvas().id,
    role: "skill",
    category: "skill",
    label: skill.canonicalLabel,
    normalizedLabel: skill.normalizedLabel,
    position: nextSkillGraphPosition("skill"),
    source: "user",
    metadata: buildSkillTreeMetadata({
      skillId: skill.id,
      sourceNodeId: sourceNode.id,
      sortOrder: nextSkillTreeSortOrder()
    }),
    ...auditFields(timestamp)
  };

  graphStore.nodes = [...graphStore.nodes, skillNode];
  renumberSkillTreeSiblings();

  return skillNode;
}

function createSkillGraphNodeFromTreeInput(input: {
  readonly skill: SkillRecord;
  readonly nodeId: GraphNode["id"];
  readonly label: string;
  readonly description?: string;
  readonly parentNodeId?: GraphNode["id"];
  readonly tag?: string;
  readonly color?: string;
}) {
  const timestamp = now();
  const skillNode: NodeRecord = {
    id: input.nodeId,
    canvasId: getSkillGraphCanvas().id,
    role: "skill",
    category: "skill",
    label: input.label.trim(),
    normalizedLabel: normalizeLabel(input.label),
    position: nextSkillGraphPosition("skill"),
    source: "user",
    ...(typeof input.description === "string" && input.description.trim().length > 0
      ? { description: input.description.trim() }
      : {}),
    ...(input.parentNodeId ? { parentNodeId: input.parentNodeId } : {}),
    metadata: buildSkillTreeMetadata({
      skillId: input.skill.id,
      tag: input.tag,
      color: input.color,
      sortOrder: nextSkillTreeSortOrder(input.parentNodeId)
    }),
    ...auditFields(timestamp)
  };

  graphStore.nodes = [...graphStore.nodes, skillNode];
  replaceParentEdge(skillNode.canvasId, skillNode.id, input.parentNodeId);
  renumberSkillTreeSiblings(input.parentNodeId);

  return skillNode;
}

function createSkillReferenceNode(input: {
  canonicalSkill: SkillRecord;
  label: string;
  canvasId?: Canvas["id"];
  sourceNodeId?: GraphNode["id"];
  referenceNodeId?: GraphNode["id"];
  position?: GraphNodePosition;
}) {
  const canvasId = input.canvasId ?? getSkillGraphCanvas().id;
  assertCanvas(canvasId);

  if (input.referenceNodeId) {
    assertNode(input.referenceNodeId);
  }

  const timestamp = now();
  const parentNodeId =
    canvasId === getSkillGraphCanvas().id
      ? findSkillGraphNode(input.canonicalSkill.id)?.id
      : undefined;
  const referenceNode: NodeRecord = {
    id: buildId(ID_PREFIXES.node) as GraphNode["id"],
    canvasId,
    role: "reference",
    category: "skill",
    label: input.label.trim(),
    normalizedLabel: normalizeLabel(input.label),
    position: input.position ?? nextSkillGraphPosition("reference"),
    source: "user",
    ...(parentNodeId ? { parentNodeId } : {}),
    metadata: buildSkillTreeMetadata({
      skillId: input.canonicalSkill.id,
      sourceNodeId: input.sourceNodeId,
      referenceNodeId: input.referenceNodeId,
      sortOrder: parentNodeId ? nextSkillTreeSortOrder(parentNodeId) : undefined
    }),
    ...auditFields(timestamp)
  };

  graphStore.nodes = [...graphStore.nodes, referenceNode];

  if (parentNodeId) {
    replaceParentEdge(canvasId, referenceNode.id, parentNodeId);
    renumberSkillTreeSiblings(parentNodeId);
  }

  return referenceNode;
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

export function getSkillInventorySnapshot() {
  return {
    ...getSkillInventory(),
    skillGraph: getCanvasGraph(getSkillGraphCanvas().id)!
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

export function promoteNodeToSkill(
  nodeId: GraphNode["id"],
  preferredSkillId: Skill["id"]
): SkillPromotionResult {
  const sourceNode = assertNode(nodeId);
  const normalizedLabel = normalizeLabel(sourceNode.label);
  const duplicateCandidates = findDuplicateSkillCandidates(sourceNode.label);

  if (duplicateCandidates.some((candidate) => candidate.normalizedLabel === normalizedLabel)) {
    throw storeError(
      "SKILL_RESOLUTION_REQUIRED",
      "Duplicate skill resolution is required before promoting this node.",
      409,
      {
        normalizedLabel,
        candidates: duplicateCandidates.map((candidate) => ({
          skillId: candidate.skillId,
          canonicalLabel: candidate.canonicalLabel,
          normalizedLabel: candidate.normalizedLabel,
          similarityScore: candidate.similarityScore,
          ...(candidate.sourceNodeId ? { sourceNodeId: candidate.sourceNodeId } : {})
        })),
        sourceNodeId: nodeId
      }
    );
  }

  if (graphStore.skills.some((skill) => skill.id === preferredSkillId)) {
    throw storeError(
      "VALIDATION_FAILED",
      `Skill ${preferredSkillId} already exists.`,
      422,
      {
        issues: [
          {
            path: "preferredSkillId",
            rule: "unique",
            message: "preferredSkillId must be unique."
          }
        ]
      }
    );
  }

  const timestamp = now();
  const skill: SkillRecord = {
    id: preferredSkillId,
    canonicalLabel: sourceNode.label,
    normalizedLabel,
    sourceNodeId: sourceNode.id,
    ...auditFields(timestamp)
  };

  graphStore.skills = [...graphStore.skills, skill];
  const skillNode = createSkillGraphNode(skill, sourceNode);

  return {
    skill,
    skillNode
  };
}

export function resolveDuplicateSkill(
  nodeId: GraphNode["id"],
  canonicalSkillId: Skill["id"],
  strategy: "use-existing-canonical" | "create-reference-to-existing"
): DuplicateResolutionResult {
  const sourceNode = assertNode(nodeId);
  const canonicalSkill = assertSkill(canonicalSkillId);

  if (strategy === "use-existing-canonical") {
    const existingSkillNode = findSkillGraphNode(canonicalSkill.id);

    if (!existingSkillNode) {
      throw storeError(
        "NOT_FOUND",
        `Skill graph node for ${canonicalSkillId} was not found.`,
        404
      );
    }

    return {
      canonicalSkill,
      referenceNode: existingSkillNode
    };
  }

  const referenceNode = createSkillReferenceNode({
    canonicalSkill,
    label: sourceNode.label,
    sourceNodeId: sourceNode.id
  });

  return {
    canonicalSkill,
    referenceNode
  };
}

export function createSkillReference(
  skillId: Skill["id"],
  input: {
    canvasId: Canvas["id"];
    label: string;
    referenceNodeId?: GraphNode["id"];
    position?: GraphNodePosition;
  }
) {
  const canonicalSkill = assertSkill(skillId);
  const referenceNode = createSkillReferenceNode({
    canonicalSkill,
    canvasId: input.canvasId,
    label: input.label,
    referenceNodeId: input.referenceNodeId,
    position: input.position
  });

  return {
    canonicalSkill,
    referenceNode
  };
}

export function createSkillTreeNode(input: {
  label: string;
  description?: string;
  parentNodeId?: GraphNode["id"];
  tag?: string;
  color?: string;
}) {
  const normalizedLabel = normalizeLabel(input.label);
  const duplicateCandidates = findDuplicateSkillCandidates(input.label);

  if (duplicateCandidates.some((candidate) => candidate.normalizedLabel === normalizedLabel)) {
    throw storeError(
      "SKILL_RESOLUTION_REQUIRED",
      "Duplicate skill resolution is required before creating this skill.",
      409,
      {
        normalizedLabel,
        candidates: duplicateCandidates.map((candidate) => ({
          skillId: candidate.skillId,
          canonicalLabel: candidate.canonicalLabel,
          normalizedLabel: candidate.normalizedLabel,
          similarityScore: candidate.similarityScore,
          ...(candidate.sourceNodeId ? { sourceNodeId: candidate.sourceNodeId } : {})
        }))
      }
    );
  }

  if (input.parentNodeId) {
    assertSkillTreeParent(
      `nod_pending_${crypto.randomUUID().replaceAll("-", "")}` as GraphNode["id"],
      input.parentNodeId
    );
  }

  const timestamp = now();
  const skillId = buildId(ID_PREFIXES.skill) as Skill["id"];
  const nodeId = buildId(ID_PREFIXES.node) as GraphNode["id"];
  const skill: SkillRecord = {
    id: skillId,
    canonicalLabel: input.label.trim(),
    normalizedLabel,
    ...(typeof input.description === "string" && input.description.trim().length > 0
      ? { description: input.description.trim() }
      : {}),
    sourceNodeId: nodeId,
    metadata: buildSkillTreeMetadata({
      tag: input.tag,
      color: input.color
    }),
    ...auditFields(timestamp)
  };

  graphStore.skills = [...graphStore.skills, skill];
  const skillNode = createSkillGraphNodeFromTreeInput({
    skill,
    nodeId,
    label: input.label,
    description: input.description,
    parentNodeId: input.parentNodeId,
    tag: input.tag,
    color: input.color
  });

  return {
    skill,
    skillNode
  };
}

export function updateSkillTreeNode(
  nodeId: GraphNode["id"],
  changes: {
    label?: string;
    description?: string | null;
    tag?: string | null;
    color?: string | null;
  }
) {
  const node = assertSkillTreeNode(nodeId);
  const nextLabel = typeof changes.label === "string" ? changes.label.trim() : node.label;
  const nextNormalizedLabel = normalizeLabel(nextLabel);
  const nextDescription =
    changes.description !== undefined
      ? changes.description?.trim() || undefined
      : node.description;
  const nextTag =
    changes.tag !== undefined ? changes.tag?.trim() || null : readNodeTagString(node);
  const nextColor =
    changes.color !== undefined
      ? changes.color?.trim() || null
      : readNodeStringMetadata(node, "color");

  let skill: SkillRecord | undefined;

  if (node.role === "skill") {
    const skillId = readNodeStringMetadata(node, "skillId") as Skill["id"];
    const linkedSkill = assertSkill(skillId);
    const duplicateCandidates = graphStore.skills.filter(
      (entry) => entry.id !== linkedSkill.id && entry.normalizedLabel === nextNormalizedLabel
    );

    if (duplicateCandidates.length > 0) {
      throw storeError(
        "SKILL_RESOLUTION_REQUIRED",
        "Duplicate skill resolution is required before renaming this skill.",
        409,
        {
          normalizedLabel: nextNormalizedLabel,
          candidates: duplicateCandidates.map((candidate) => ({
            skillId: candidate.id,
            canonicalLabel: candidate.canonicalLabel,
            normalizedLabel: candidate.normalizedLabel
          }))
        }
      );
    }

    graphStore.skills = graphStore.skills.map((entry) =>
      entry.id === linkedSkill.id
        ? {
            ...entry,
            canonicalLabel: nextLabel,
            normalizedLabel: nextNormalizedLabel,
            description: nextDescription,
            metadata: buildSkillTreeMetadata({
              existing: entry.metadata,
              tag: nextTag,
              color: nextColor
            }),
            updatedAt: now()
          }
        : entry
    );
    skill = assertSkill(linkedSkill.id);
  }

  const updatedNode: NodeRecord = {
    ...node,
    label: nextLabel,
    normalizedLabel: nextNormalizedLabel,
    description: nextDescription,
    metadata: buildSkillTreeMetadata({
      existing: node.metadata,
      tag: nextTag,
      color: nextColor,
      sortOrder: readNodeNumberMetadata(node, "sortOrder") ?? 0
    }),
    updatedAt: now()
  };

  graphStore.nodes = graphStore.nodes.map((entry) =>
    entry.id === nodeId ? updatedNode : entry
  );

  return {
    ...(skill ? { skill } : {}),
    skillNode: updatedNode
  };
}

export function reorderSkillTreeNode(
  nodeId: GraphNode["id"],
  input: {
    parentNodeId?: GraphNode["id"];
    targetIndex: number;
  }
) {
  const node = assertSkillTreeNode(nodeId);
  const previousParentNodeId = node.parentNodeId;
  const nextParentNodeId = input.parentNodeId;

  if (nextParentNodeId) {
    assertSkillTreeParent(nodeId, nextParentNodeId);
  }

  const siblingsWithoutNode = getSkillTreeChildren(nextParentNodeId).filter(
    (entry) => entry.id !== nodeId
  );
  const insertionIndex = clampSortOrder(input.targetIndex, siblingsWithoutNode.length);
  const orderedSiblingIds = [
    ...siblingsWithoutNode.slice(0, insertionIndex).map((entry) => entry.id),
    nodeId,
    ...siblingsWithoutNode.slice(insertionIndex).map((entry) => entry.id)
  ];
  const timestamp = now();

  graphStore.nodes = graphStore.nodes.map((entry) => {
    const siblingIndex = orderedSiblingIds.indexOf(entry.id);

    if (siblingIndex === -1) {
      return entry;
    }

    return {
      ...entry,
      ...(entry.id === nodeId
        ? {
            parentNodeId: nextParentNodeId,
            position: nextSkillGraphPosition(
              entry.role === "reference" ? "reference" : "skill"
            )
          }
        : {}),
      metadata: buildSkillTreeMetadata({
        existing: entry.metadata,
        sortOrder: siblingIndex
      }),
      updatedAt: timestamp
    };
  });

  replaceParentEdge(getSkillGraphCanvas().id, nodeId, nextParentNodeId);

  if (previousParentNodeId !== nextParentNodeId) {
    renumberSkillTreeSiblings(previousParentNodeId);
  }

  return {
    reorderedNode: assertSkillTreeNode(nodeId),
    siblings: renumberSkillTreeSiblings(nextParentNodeId)
  };
}

export function deleteSkillTreeNode(nodeId: GraphNode["id"]) {
  const rootNode = assertSkillTreeNode(nodeId);
  const deletedNodeIds = new Set<GraphNode["id"]>([
    rootNode.id,
    ...getSkillTreeDescendantIds(rootNode.id)
  ]);
  const deletedSkillIds = new Set<Skill["id"]>();

  for (const currentNodeId of deletedNodeIds) {
    const currentNode = graphStore.nodes.find((entry) => entry.id === currentNodeId);
    const skillId = currentNode ? readNodeStringMetadata(currentNode, "skillId") : undefined;

    if (currentNode?.role === "skill" && skillId) {
      deletedSkillIds.add(skillId as Skill["id"]);
    }
  }

  for (const node of graphStore.nodes.filter(isSkillTreeNode)) {
    const skillId = readNodeStringMetadata(node, "skillId");

    if (node.role === "reference" && skillId && deletedSkillIds.has(skillId as Skill["id"])) {
      deletedNodeIds.add(node.id);
    }
  }

  graphStore.nodes = graphStore.nodes.filter((node) => !deletedNodeIds.has(node.id));
  graphStore.edges = graphStore.edges.filter(
    (edge) => !deletedNodeIds.has(edge.sourceNodeId) && !deletedNodeIds.has(edge.targetNodeId)
  );
  graphStore.skills = graphStore.skills.filter((skill) => !deletedSkillIds.has(skill.id));

  renumberSkillTreeSiblings(rootNode.parentNodeId);

  return {
    deletedNodeIds: [...deletedNodeIds],
    deletedSkillIds: [...deletedSkillIds]
  };
}
