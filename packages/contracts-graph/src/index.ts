import { z } from "zod";
import type {
  AuditFields,
  CanvasId,
  DomainCommandEnvelope,
  DomainError,
  DomainEventEnvelope,
  DomainQueryEnvelope,
  GraphEdgeId,
  GraphNodeId,
  IsoDateTime,
  JsonObject,
  SkillId
} from "@pdp-helper/contracts-core";
import {
  AuditFieldsSchema,
  CanvasIdSchema,
  GraphEdgeIdSchema,
  GraphNodeIdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  SkillIdSchema,
  createDomainEventEnvelopeSchema,
  makeEventSubject
} from "@pdp-helper/contracts-core";

export const CANVAS_MODE_VALUES = ["brainstorm", "skill-graph"] as const;
export type CanvasMode = (typeof CANVAS_MODE_VALUES)[number];

export const GRAPH_NODE_ROLE_VALUES = [
  "brainstorm",
  "skill",
  "reference",
  "recommendation"
] as const;
export type GraphNodeRole = (typeof GRAPH_NODE_ROLE_VALUES)[number];

export const USER_NODE_CATEGORY_VALUES = [
  "skill",
  "certificate",
  "course",
  "project",
  "goal",
  "note",
  "custom"
] as const;
export type UserNodeCategory = (typeof USER_NODE_CATEGORY_VALUES)[number];

export const SYSTEM_NODE_CATEGORY_VALUES = ["recommendation"] as const;
export type SystemNodeCategory = (typeof SYSTEM_NODE_CATEGORY_VALUES)[number];

export type GraphNodeCategory = UserNodeCategory | SystemNodeCategory;

export const GRAPH_EDGE_KIND_VALUES = [
  "contains",
  "relates-to",
  "depends-on",
  "references"
] as const;
export type GraphEdgeKind = (typeof GRAPH_EDGE_KIND_VALUES)[number];

export const GRAPH_NODE_SOURCE_VALUES = [
  "user",
  "built-in-recommender",
  "external-tool",
  "system"
] as const;
export type GraphNodeSource = (typeof GRAPH_NODE_SOURCE_VALUES)[number];

export const DUPLICATE_RESOLUTION_STRATEGY_VALUES = [
  "use-existing-canonical",
  "create-reference-to-existing",
  "create-new-canonical"
] as const;
export type DuplicateResolutionStrategy =
  (typeof DUPLICATE_RESOLUTION_STRATEGY_VALUES)[number];

export interface GraphNodePosition {
  x: number;
  y: number;
}

export interface GraphViewport {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_GRAPH_VIEWPORT: GraphViewport = {
  x: 0,
  y: 0,
  zoom: 1
};

export interface Canvas extends AuditFields {
  id: CanvasId;
  name: string;
  mode: CanvasMode;
  sortOrder: number;
  archivedAt?: IsoDateTime;
}

export interface GraphNode extends AuditFields {
  id: GraphNodeId;
  canvasId: CanvasId;
  role: GraphNodeRole;
  category: GraphNodeCategory;
  label: string;
  normalizedLabel: string;
  description?: string;
  parentNodeId?: GraphNodeId;
  position: GraphNodePosition;
  source: GraphNodeSource;
  metadata?: JsonObject;
}

export interface GraphEdge extends AuditFields {
  id: GraphEdgeId;
  canvasId: CanvasId;
  sourceNodeId: GraphNodeId;
  targetNodeId: GraphNodeId;
  kind: GraphEdgeKind;
  label?: string;
  metadata?: JsonObject;
}

export interface Skill extends AuditFields {
  id: SkillId;
  canonicalLabel: string;
  normalizedLabel: string;
  description?: string;
  sourceNodeId?: GraphNodeId;
  metadata?: JsonObject;
}

export interface SkillReference extends AuditFields {
  id: GraphNodeId;
  canvasId: CanvasId;
  skillId: SkillId;
  label: string;
  referenceNodeId?: GraphNodeId;
}

export interface DuplicateSkillCandidate {
  skillId: SkillId;
  canonicalLabel: string;
  normalizedLabel: string;
  sourceNodeId?: GraphNodeId;
  similarityScore: number;
}

export const CanvasModeSchema = z.enum(CANVAS_MODE_VALUES);
export const GraphNodeRoleSchema = z.enum(GRAPH_NODE_ROLE_VALUES);
export const UserNodeCategorySchema = z.enum(USER_NODE_CATEGORY_VALUES);
export const SystemNodeCategorySchema = z.enum(SYSTEM_NODE_CATEGORY_VALUES);
export const GraphNodeCategorySchema = z.union([
  UserNodeCategorySchema,
  SystemNodeCategorySchema
]);
export const GraphEdgeKindSchema = z.enum(GRAPH_EDGE_KIND_VALUES);
export const GraphNodeSourceSchema = z.enum(GRAPH_NODE_SOURCE_VALUES);
export const DuplicateResolutionStrategySchema = z.enum(
  DUPLICATE_RESOLUTION_STRATEGY_VALUES
);

export const GraphNodePositionSchema = z.object({
  x: z.number(),
  y: z.number()
});

export const GraphViewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number()
});

export const CanvasSchema = AuditFieldsSchema.extend({
  id: CanvasIdSchema,
  name: z.string().min(1),
  mode: CanvasModeSchema,
  sortOrder: z.number().int(),
  archivedAt: IsoDateTimeSchema.optional()
});

export const GraphNodeSchema = AuditFieldsSchema.extend({
  id: GraphNodeIdSchema,
  canvasId: CanvasIdSchema,
  role: GraphNodeRoleSchema,
  category: GraphNodeCategorySchema,
  label: z.string().min(1),
  normalizedLabel: z.string().min(1),
  description: z.string().min(1).optional(),
  parentNodeId: GraphNodeIdSchema.optional(),
  position: GraphNodePositionSchema,
  source: GraphNodeSourceSchema,
  metadata: JsonObjectSchema.optional()
});

export const GraphEdgeSchema = AuditFieldsSchema.extend({
  id: GraphEdgeIdSchema,
  canvasId: CanvasIdSchema,
  sourceNodeId: GraphNodeIdSchema,
  targetNodeId: GraphNodeIdSchema,
  kind: GraphEdgeKindSchema,
  label: z.string().min(1).optional(),
  metadata: JsonObjectSchema.optional()
});

export const SkillSchema = AuditFieldsSchema.extend({
  id: SkillIdSchema,
  canonicalLabel: z.string().min(1),
  normalizedLabel: z.string().min(1),
  description: z.string().min(1).optional(),
  sourceNodeId: GraphNodeIdSchema.optional(),
  metadata: JsonObjectSchema.optional()
});

export const SkillReferenceSchema = AuditFieldsSchema.extend({
  id: GraphNodeIdSchema,
  canvasId: CanvasIdSchema,
  skillId: SkillIdSchema,
  label: z.string().min(1),
  referenceNodeId: GraphNodeIdSchema.optional()
});

export const DuplicateSkillCandidateSchema = z.object({
  skillId: SkillIdSchema,
  canonicalLabel: z.string().min(1),
  normalizedLabel: z.string().min(1),
  sourceNodeId: GraphNodeIdSchema.optional(),
  similarityScore: z.number()
});

export const GRAPH_COMMAND_NAMES = [
  "graph.create-canvas",
  "graph.rename-canvas",
  "graph.archive-canvas",
  "graph.create-node",
  "graph.update-node",
  "graph.move-node",
  "graph.delete-node",
  "graph.create-edge",
  "graph.delete-edge",
  "graph.promote-node-to-skill",
  "graph.resolve-duplicate-skill",
  "graph.create-skill-reference"
] as const;
export type GraphCommandName = (typeof GRAPH_COMMAND_NAMES)[number];

export const GRAPH_QUERY_NAMES = [
  "graph.get-canvas",
  "graph.list-canvases",
  "graph.get-canvas-subgraph",
  "graph.search-duplicate-skill-candidates",
  "graph.get-skill-graph"
] as const;
export type GraphQueryName = (typeof GRAPH_QUERY_NAMES)[number];

export interface CreateCanvasCommandPayload {
  canvasId: CanvasId;
  name: string;
  mode: CanvasMode;
  sortOrder?: number;
}

export type CreateCanvasCommand = DomainCommandEnvelope<
  "graph.create-canvas",
  CreateCanvasCommandPayload
>;

export interface RenameCanvasCommandPayload {
  canvasId: CanvasId;
  name: string;
}

export type RenameCanvasCommand = DomainCommandEnvelope<
  "graph.rename-canvas",
  RenameCanvasCommandPayload
>;

export interface ArchiveCanvasCommandPayload {
  canvasId: CanvasId;
  archivedAt: IsoDateTime;
}

export type ArchiveCanvasCommand = DomainCommandEnvelope<
  "graph.archive-canvas",
  ArchiveCanvasCommandPayload
>;

export interface CreateGraphNodeCommandPayload {
  nodeId: GraphNodeId;
  canvasId: CanvasId;
  role: GraphNodeRole;
  category: GraphNodeCategory;
  label: string;
  parentNodeId?: GraphNodeId;
  position: GraphNodePosition;
  source: GraphNodeSource;
  metadata?: JsonObject;
}

export type CreateGraphNodeCommand = DomainCommandEnvelope<
  "graph.create-node",
  CreateGraphNodeCommandPayload
>;

export interface UpdateGraphNodeCommandPayload {
  nodeId: GraphNodeId;
  label?: string;
  description?: string;
  category?: GraphNodeCategory;
  metadata?: JsonObject;
}

export type UpdateGraphNodeCommand = DomainCommandEnvelope<
  "graph.update-node",
  UpdateGraphNodeCommandPayload
>;

export interface MoveGraphNodeCommandPayload {
  nodeId: GraphNodeId;
  parentNodeId?: GraphNodeId;
  position: GraphNodePosition;
}

export type MoveGraphNodeCommand = DomainCommandEnvelope<
  "graph.move-node",
  MoveGraphNodeCommandPayload
>;

export interface DeleteGraphNodeCommandPayload {
  nodeId: GraphNodeId;
}

export type DeleteGraphNodeCommand = DomainCommandEnvelope<
  "graph.delete-node",
  DeleteGraphNodeCommandPayload
>;

export interface CreateGraphEdgeCommandPayload {
  edgeId: GraphEdgeId;
  canvasId: CanvasId;
  sourceNodeId: GraphNodeId;
  targetNodeId: GraphNodeId;
  kind: GraphEdgeKind;
  label?: string;
  metadata?: JsonObject;
}

export type CreateGraphEdgeCommand = DomainCommandEnvelope<
  "graph.create-edge",
  CreateGraphEdgeCommandPayload
>;

export interface DeleteGraphEdgeCommandPayload {
  edgeId: GraphEdgeId;
}

export type DeleteGraphEdgeCommand = DomainCommandEnvelope<
  "graph.delete-edge",
  DeleteGraphEdgeCommandPayload
>;

export interface PromoteNodeToSkillCommandPayload {
  nodeId: GraphNodeId;
  preferredSkillId: SkillId;
}

export type PromoteNodeToSkillCommand = DomainCommandEnvelope<
  "graph.promote-node-to-skill",
  PromoteNodeToSkillCommandPayload
>;

export interface ResolveDuplicateSkillCommandPayload {
  nodeId: GraphNodeId;
  canonicalSkillId: SkillId;
  strategy: DuplicateResolutionStrategy;
}

export type ResolveDuplicateSkillCommand = DomainCommandEnvelope<
  "graph.resolve-duplicate-skill",
  ResolveDuplicateSkillCommandPayload
>;

export interface CreateSkillReferenceCommandPayload {
  nodeId: GraphNodeId;
  canvasId: CanvasId;
  skillId: SkillId;
  label: string;
  referenceNodeId?: GraphNodeId;
}

export type CreateSkillReferenceCommand = DomainCommandEnvelope<
  "graph.create-skill-reference",
  CreateSkillReferenceCommandPayload
>;

export type GraphCommand =
  | ArchiveCanvasCommand
  | CreateCanvasCommand
  | CreateGraphEdgeCommand
  | CreateGraphNodeCommand
  | CreateSkillReferenceCommand
  | DeleteGraphEdgeCommand
  | DeleteGraphNodeCommand
  | MoveGraphNodeCommand
  | PromoteNodeToSkillCommand
  | RenameCanvasCommand
  | ResolveDuplicateSkillCommand
  | UpdateGraphNodeCommand;

export interface GetCanvasQueryParams {
  canvasId: CanvasId;
  includeArchived?: boolean;
}

export type GetCanvasQuery = DomainQueryEnvelope<
  "graph.get-canvas",
  GetCanvasQueryParams
>;

export interface ListCanvasesQueryParams {
  mode?: CanvasMode;
  includeArchived?: boolean;
}

export type ListCanvasesQuery = DomainQueryEnvelope<
  "graph.list-canvases",
  ListCanvasesQueryParams
>;

export interface GetCanvasSubgraphQueryParams {
  canvasId: CanvasId;
  rootNodeId?: GraphNodeId;
  depth?: number;
}

export type GetCanvasSubgraphQuery = DomainQueryEnvelope<
  "graph.get-canvas-subgraph",
  GetCanvasSubgraphQueryParams
>;

export interface SearchDuplicateSkillCandidatesQueryParams {
  normalizedLabel: string;
  limit?: number;
}

export type SearchDuplicateSkillCandidatesQuery = DomainQueryEnvelope<
  "graph.search-duplicate-skill-candidates",
  SearchDuplicateSkillCandidatesQueryParams
>;

export interface GetSkillGraphQueryParams {
  canvasId: CanvasId;
  includeReferences?: boolean;
}

export type GetSkillGraphQuery = DomainQueryEnvelope<
  "graph.get-skill-graph",
  GetSkillGraphQueryParams
>;

export type GraphQuery =
  | GetCanvasQuery
  | GetCanvasSubgraphQuery
  | GetSkillGraphQuery
  | ListCanvasesQuery
  | SearchDuplicateSkillCandidatesQuery;

export const GRAPH_EVENT_SUBJECTS = {
  categoryCreated: makeEventSubject("graph", "category", "created"),
  canvasCreated: makeEventSubject("graph", "canvas", "created"),
  canvasUpdated: makeEventSubject("graph", "canvas", "updated"),
  canvasDeleted: makeEventSubject("graph", "canvas", "deleted"),
  nodeCreated: makeEventSubject("graph", "node", "created"),
  nodeUpdated: makeEventSubject("graph", "node", "updated"),
  nodeDeleted: makeEventSubject("graph", "node", "deleted"),
  edgeCreated: makeEventSubject("graph", "edge", "created"),
  edgeDeleted: makeEventSubject("graph", "edge", "deleted"),
  skillCanonicalCreated: makeEventSubject("skill", "canonical", "created"),
  skillReferenceCreated: makeEventSubject("skill", "reference", "created"),
  skillDuplicateDetected: makeEventSubject("skill", "duplicate", "detected")
} as const;

export const GRAPH_EVENT_NAMES = [
  GRAPH_EVENT_SUBJECTS.categoryCreated,
  GRAPH_EVENT_SUBJECTS.canvasCreated,
  GRAPH_EVENT_SUBJECTS.canvasUpdated,
  GRAPH_EVENT_SUBJECTS.canvasDeleted,
  GRAPH_EVENT_SUBJECTS.nodeCreated,
  GRAPH_EVENT_SUBJECTS.nodeUpdated,
  GRAPH_EVENT_SUBJECTS.nodeDeleted,
  GRAPH_EVENT_SUBJECTS.edgeCreated,
  GRAPH_EVENT_SUBJECTS.edgeDeleted,
  GRAPH_EVENT_SUBJECTS.skillCanonicalCreated,
  GRAPH_EVENT_SUBJECTS.skillReferenceCreated,
  GRAPH_EVENT_SUBJECTS.skillDuplicateDetected
] as const;
export type GraphEventName = (typeof GRAPH_EVENT_NAMES)[number];

export type CanvasCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["canvasCreated"],
  {
    canvas: Canvas;
  }
>;

export type CanvasUpdatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["canvasUpdated"],
  {
    canvasId: CanvasId;
    changes: JsonObject;
  }
>;

export type CanvasDeletedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["canvasDeleted"],
  {
    canvasId: CanvasId;
    deletedAt: IsoDateTime;
  }
>;

export type GraphCategoryCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["categoryCreated"],
  {
    category: {
      id: string;
      label: string;
      colorToken: string;
    };
  }
>;

export type GraphNodeCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["nodeCreated"],
  {
    node: GraphNode;
  }
>;

export type GraphNodeUpdatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["nodeUpdated"],
  {
    nodeId: GraphNodeId;
    changes: JsonObject;
  }
>;

export type GraphNodeDeletedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["nodeDeleted"],
  {
    nodeId: GraphNodeId;
    canvasId: CanvasId;
  }
>;

export type GraphEdgeCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["edgeCreated"],
  {
    edge: GraphEdge;
  }
>;

export type GraphEdgeDeletedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["edgeDeleted"],
  {
    edgeId: GraphEdgeId;
    canvasId: CanvasId;
  }
>;

export type SkillCanonicalCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["skillCanonicalCreated"],
  {
    skill: Skill;
    sourceNodeId: GraphNodeId;
  }
>;

export type SkillReferenceCreatedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["skillReferenceCreated"],
  {
    skillReference: SkillReference;
    canonicalSkillId: SkillId;
  }
>;

export type SkillDuplicateDetectedEvent = DomainEventEnvelope<
  (typeof GRAPH_EVENT_SUBJECTS)["skillDuplicateDetected"],
  {
    normalizedLabel: string;
    candidates: DuplicateSkillCandidate[];
    sourceNodeId?: GraphNodeId;
  }
>;

const GraphCategorySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  colorToken: z.string().min(1)
});

export const CanvasCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.canvasCreated),
  z.object({
    canvas: CanvasSchema
  })
);

export const CanvasUpdatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.canvasUpdated),
  z.object({
    canvasId: CanvasIdSchema,
    changes: JsonObjectSchema
  })
);

export const CanvasDeletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.canvasDeleted),
  z.object({
    canvasId: CanvasIdSchema,
    deletedAt: IsoDateTimeSchema
  })
);

export const GraphCategoryCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.categoryCreated),
  z.object({
    category: GraphCategorySchema
  })
);

export const GraphNodeCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.nodeCreated),
  z.object({
    node: GraphNodeSchema
  })
);

export const GraphNodeUpdatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.nodeUpdated),
  z.object({
    nodeId: GraphNodeIdSchema,
    changes: JsonObjectSchema
  })
);

export const GraphNodeDeletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.nodeDeleted),
  z.object({
    nodeId: GraphNodeIdSchema,
    canvasId: CanvasIdSchema
  })
);

export const GraphEdgeCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.edgeCreated),
  z.object({
    edge: GraphEdgeSchema
  })
);

export const GraphEdgeDeletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.edgeDeleted),
  z.object({
    edgeId: GraphEdgeIdSchema,
    canvasId: CanvasIdSchema
  })
);

export const SkillCanonicalCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.skillCanonicalCreated),
  z.object({
    skill: SkillSchema,
    sourceNodeId: GraphNodeIdSchema
  })
);

export const SkillReferenceCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.skillReferenceCreated),
  z.object({
    skillReference: SkillReferenceSchema,
    canonicalSkillId: SkillIdSchema
  })
);

export const SkillDuplicateDetectedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(GRAPH_EVENT_SUBJECTS.skillDuplicateDetected),
  z.object({
    normalizedLabel: z.string().min(1),
    candidates: z.array(DuplicateSkillCandidateSchema),
    sourceNodeId: GraphNodeIdSchema.optional()
  })
);

export const GraphEventSchema = z.discriminatedUnion("eventName", [
  CanvasCreatedEventSchema,
  CanvasUpdatedEventSchema,
  CanvasDeletedEventSchema,
  GraphCategoryCreatedEventSchema,
  GraphNodeCreatedEventSchema,
  GraphNodeUpdatedEventSchema,
  GraphNodeDeletedEventSchema,
  GraphEdgeCreatedEventSchema,
  GraphEdgeDeletedEventSchema,
  SkillCanonicalCreatedEventSchema,
  SkillReferenceCreatedEventSchema,
  SkillDuplicateDetectedEventSchema
]);

export type GraphEvent =
  | CanvasCreatedEvent
  | CanvasDeletedEvent
  | CanvasUpdatedEvent
  | GraphCategoryCreatedEvent
  | GraphEdgeCreatedEvent
  | GraphEdgeDeletedEvent
  | GraphNodeCreatedEvent
  | GraphNodeDeletedEvent
  | GraphNodeUpdatedEvent
  | SkillCanonicalCreatedEvent
  | SkillDuplicateDetectedEvent
  | SkillReferenceCreatedEvent;

export const GRAPH_ERROR_CODE_VALUES = [
  "CANVAS_NOT_FOUND",
  "GRAPH_NODE_NOT_FOUND",
  "GRAPH_EDGE_NOT_FOUND",
  "INVALID_GRAPH_MUTATION",
  "INVALID_NODE_CATEGORY",
  "DUPLICATE_SKILL_DETECTED",
  "SKILL_RESOLUTION_REQUIRED"
] as const;
export type GraphErrorCode = (typeof GRAPH_ERROR_CODE_VALUES)[number];

export interface DuplicateSkillDetectedDetails {
  normalizedLabel: string;
  candidates: DuplicateSkillCandidate[];
}

export interface InvalidGraphMutationDetails {
  reason: string;
  nodeId?: GraphNodeId;
  edgeId?: GraphEdgeId;
}

export type GraphError = DomainError<
  GraphErrorCode,
  DuplicateSkillDetectedDetails | InvalidGraphMutationDetails
>;

export const GRAPH_SCHEMA_CONSTANTS = {
  defaultViewport: DEFAULT_GRAPH_VIEWPORT,
  duplicateResolutionStrategies: DUPLICATE_RESOLUTION_STRATEGY_VALUES,
  edgeKinds: GRAPH_EDGE_KIND_VALUES,
  nodeCategories: USER_NODE_CATEGORY_VALUES,
  nodeRoles: GRAPH_NODE_ROLE_VALUES
} as const;
