import { z } from "zod";

export type JsonPrimitive = boolean | number | string | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

type Brand<TValue, TName extends string> = TValue & {
  readonly __brand: TName;
};

export type IsoDate = Brand<string, "IsoDate">;
export type IsoDateTime = Brand<string, "IsoDateTime">;

export type WorkspaceId = Brand<string, "WorkspaceId">;
export type UserId = Brand<string, "UserId">;
export type ActorId = Brand<string, "ActorId">;
export type ApiKeyId = Brand<string, "ApiKeyId">;
export type CanvasId = Brand<string, "CanvasId">;
export type GraphNodeId = Brand<string, "GraphNodeId">;
export type GraphEdgeId = Brand<string, "GraphEdgeId">;
export type SkillId = Brand<string, "SkillId">;
export type GoalId = Brand<string, "GoalId">;
export type PlanItemId = Brand<string, "PlanItemId">;
export type EvidenceNoteId = Brand<string, "EvidenceNoteId">;
export type ProgressProjectionId = Brand<string, "ProgressProjectionId">;
export type RecommendationId = Brand<string, "RecommendationId">;
export type RecommendationRunId = Brand<string, "RecommendationRunId">;
export type ProviderId = Brand<string, "ProviderId">;
export type EventId = Brand<string, "EventId">;
export type CommandId = Brand<string, "CommandId">;
export type QueryId = Brand<string, "QueryId">;
export type CorrelationId = Brand<string, "CorrelationId">;
export type EventSubject = Brand<string, "EventSubject">;

export const SCHEMA_VERSION_VALUES = ["v1"] as const;
export type SchemaVersion = (typeof SCHEMA_VERSION_VALUES)[number];
export const DEFAULT_SCHEMA_VERSION: SchemaVersion = "v1";

export const HTTP_ROUTE_PREFIXES = {
  gateway: "/api/v1",
  service: "/v1"
} as const;

export const ID_PREFIXES = {
  actor: "act",
  apiKey: "key",
  canvas: "can",
  command: "cmd",
  edge: "edg",
  event: "evt",
  evidenceNote: "env",
  goal: "gol",
  node: "nod",
  planItem: "pli",
  projection: "prj",
  provider: "prv",
  query: "qry",
  recommendation: "rec",
  recommendationRun: "rrn",
  skill: "skl",
  user: "usr",
  workspace: "wrk"
} as const;

export const EVENT_SUBJECT_PATTERN = /^pdp\.v1\.[a-z-]+(?:\.[a-z-]+){1,3}$/;

export function makeEventSubject(
  ...parts: readonly [string, string, ...string[]]
): EventSubject {
  const subject = `pdp.v1.${parts.join(".")}`;

  if (!EVENT_SUBJECT_PATTERN.test(subject)) {
    throw new Error(`Invalid event subject ${subject}`);
  }

  return subject as EventSubject;
}

function makeOpaqueIdSchema(prefix: string) {
  return z
    .string()
    .regex(new RegExp(`^${prefix}_[A-Za-z0-9][A-Za-z0-9_-]*$`), {
      message: `Expected id with prefix ${prefix}_`
    });
}

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(z.string(), JsonValueSchema)])
);
export const JsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  JsonValueSchema
);

export const IsoDateSchema = z.string().regex(isoDatePattern);
export const IsoDateTimeSchema = z.string().regex(isoDateTimePattern);
export const EventSubjectSchema = z.string().regex(EVENT_SUBJECT_PATTERN);

export const WorkspaceIdSchema = makeOpaqueIdSchema(ID_PREFIXES.workspace);
export const UserIdSchema = makeOpaqueIdSchema(ID_PREFIXES.user);
export const ActorIdSchema = makeOpaqueIdSchema(ID_PREFIXES.actor);
export const ApiKeyIdSchema = makeOpaqueIdSchema(ID_PREFIXES.apiKey);
export const CanvasIdSchema = makeOpaqueIdSchema(ID_PREFIXES.canvas);
export const GraphNodeIdSchema = makeOpaqueIdSchema(ID_PREFIXES.node);
export const GraphEdgeIdSchema = makeOpaqueIdSchema(ID_PREFIXES.edge);
export const SkillIdSchema = makeOpaqueIdSchema(ID_PREFIXES.skill);
export const GoalIdSchema = makeOpaqueIdSchema(ID_PREFIXES.goal);
export const PlanItemIdSchema = makeOpaqueIdSchema(ID_PREFIXES.planItem);
export const EvidenceNoteIdSchema = makeOpaqueIdSchema(ID_PREFIXES.evidenceNote);
export const ProgressProjectionIdSchema = makeOpaqueIdSchema(ID_PREFIXES.projection);
export const RecommendationIdSchema = makeOpaqueIdSchema(ID_PREFIXES.recommendation);
export const RecommendationRunIdSchema = makeOpaqueIdSchema(
  ID_PREFIXES.recommendationRun
);
export const ProviderIdSchema = makeOpaqueIdSchema(ID_PREFIXES.provider);
export const EventIdSchema = makeOpaqueIdSchema(ID_PREFIXES.event);
export const CommandIdSchema = makeOpaqueIdSchema(ID_PREFIXES.command);
export const QueryIdSchema = makeOpaqueIdSchema(ID_PREFIXES.query);
export const CorrelationIdSchema = z
  .string()
  .regex(/^(?:cor|cmd|evt)_[A-Za-z0-9][A-Za-z0-9_-]*$/);

export const ACTOR_KIND_VALUES = [
  "human",
  "system",
  "external-tool"
] as const;
export type ActorKind = (typeof ACTOR_KIND_VALUES)[number];

export const API_KEY_PROFILE_VALUES = [
  "read-only",
  "read+recommend",
  "read+edit"
] as const;
export type ApiKeyProfile = (typeof API_KEY_PROFILE_VALUES)[number];

export const CONSISTENCY_MODE_VALUES = ["eventual", "strong"] as const;
export type ConsistencyMode = (typeof CONSISTENCY_MODE_VALUES)[number];

export const SERVICE_NAME_VALUES = [
  "gateway",
  "graph-service",
  "planner-service",
  "tracker-service",
  "recommendation-service",
  "mcp-service",
  "web"
] as const;
export type ServiceName = (typeof SERVICE_NAME_VALUES)[number];

export const CAPABILITY_NAME_VALUES = [
  "brainstorm",
  "skill-graph",
  "planner",
  "tracker",
  "recommendations",
  "mcp"
] as const;
export type CapabilityName = (typeof CAPABILITY_NAME_VALUES)[number];

export const HEALTH_STATUS_VALUES = [
  "up",
  "down",
  "degraded",
  "unknown"
] as const;
export type HealthStatus = (typeof HEALTH_STATUS_VALUES)[number];

export const SchemaVersionSchema = z.enum(SCHEMA_VERSION_VALUES);
export const ActorKindSchema = z.enum(ACTOR_KIND_VALUES);
export const ApiKeyProfileSchema = z.enum(API_KEY_PROFILE_VALUES);
export const ConsistencyModeSchema = z.enum(CONSISTENCY_MODE_VALUES);
export const ServiceNameSchema = z.enum(SERVICE_NAME_VALUES);
export const CapabilityNameSchema = z.enum(CAPABILITY_NAME_VALUES);
export const HealthStatusSchema = z.enum(HEALTH_STATUS_VALUES);

export interface ActorRef {
  actorId: ActorId;
  actorKind: ActorKind;
  displayName?: string;
  apiKeyId?: ApiKeyId;
}

export const ActorRefSchema = z.object({
  actorId: ActorIdSchema,
  actorKind: ActorKindSchema,
  displayName: z.string().min(1).optional(),
  apiKeyId: ApiKeyIdSchema.optional()
});

export interface AuditFields {
  workspaceId: WorkspaceId;
  createdBy: ActorId;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export const AuditFieldsSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  createdBy: ActorIdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});

export interface Workspace extends AuditFields {
  id: WorkspaceId;
  slug: string;
  displayName: string;
  ownerUserId: UserId;
  defaultApiKeyProfile: ApiKeyProfile;
  archivedAt?: IsoDateTime;
}

export const WorkspaceSchema = AuditFieldsSchema.extend({
  id: WorkspaceIdSchema,
  slug: z.string().min(1),
  displayName: z.string().min(1),
  ownerUserId: UserIdSchema,
  defaultApiKeyProfile: ApiKeyProfileSchema,
  archivedAt: IsoDateTimeSchema.optional()
});

export interface EntityRef {
  service: ServiceName;
  entityType: string;
  entityId: string;
  label?: string;
}

export const EntityRefSchema = z.object({
  service: ServiceNameSchema,
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  label: z.string().min(1).optional()
});

export interface ServiceCapability {
  capability: CapabilityName;
  title: string;
  route: string;
  service: ServiceName;
  version: SchemaVersion;
  optional: boolean;
}

export const ServiceCapabilitySchema = z.object({
  capability: CapabilityNameSchema,
  title: z.string().min(1),
  route: z.string().startsWith("/"),
  service: ServiceNameSchema,
  version: SchemaVersionSchema,
  optional: z.boolean()
});

export interface ServiceHealthSnapshot {
  service: ServiceName;
  status: HealthStatus;
  checkedAt: IsoDateTime;
  capabilities: ServiceCapability[];
  message?: string;
}

export const ServiceHealthSnapshotSchema = z.object({
  service: ServiceNameSchema,
  status: HealthStatusSchema,
  checkedAt: IsoDateTimeSchema,
  capabilities: z.array(ServiceCapabilitySchema),
  message: z.string().min(1).optional()
});

export interface ModuleDefinition {
  key: CapabilityName;
  service: ServiceName;
  optional: boolean;
  description: string;
}

export const ModuleDefinitionSchema = z.object({
  key: CapabilityNameSchema,
  service: ServiceNameSchema,
  optional: z.boolean(),
  description: z.string().min(1)
});

export interface ModuleCapability extends ServiceCapability {
  key: CapabilityName;
  description: string;
  enabled: boolean;
  status: HealthStatus;
}

export const ModuleCapabilitySchema = ServiceCapabilitySchema.extend({
  key: CapabilityNameSchema,
  description: z.string().min(1),
  enabled: z.boolean(),
  status: HealthStatusSchema
});

export const MODULE_DEFINITIONS: readonly ModuleDefinition[] = [
  {
    key: "brainstorm",
    service: "graph-service",
    optional: false,
    description:
      "Capture ideas, certificates, courses, projects, and growth themes on multi-tab canvases."
  },
  {
    key: "skill-graph",
    service: "graph-service",
    optional: false,
    description:
      "Model canonical skills, references, and duplicate-safe skill relationships."
  },
  {
    key: "planner",
    service: "planner-service",
    optional: false,
    description:
      "Turn brainstorm items into goals, milestones, tasks, and evidence-backed plans."
  },
  {
    key: "tracker",
    service: "tracker-service",
    optional: true,
    description:
      "Read projection-based progress, execution state, and lag diagnostics."
  },
  {
    key: "recommendations",
    service: "recommendation-service",
    optional: true,
    description:
      "Review recommendation nodes, provider health, and proactive suggestion runs."
  },
  {
    key: "mcp",
    service: "mcp-service",
    optional: true,
    description:
      "Expose scoped tools for external LLMs and automation clients."
  }
] as const;

export function buildModuleCapabilities(
  snapshots: readonly ServiceHealthSnapshot[]
): ModuleCapability[] {
  if (snapshots.length === 0) {
    return MODULE_DEFINITIONS.map((definition) => ({
      key: definition.key,
      capability: definition.key,
      title: startCase(definition.key),
      route: `/${definition.key}`,
      service: definition.service,
      version: "v1",
      optional: definition.optional,
      description: definition.description,
      enabled: !definition.optional,
      status: definition.optional ? "unknown" : "up"
    }));
  }

  const descriptions = new Map(
    MODULE_DEFINITIONS.map((definition) => [definition.key, definition] as const)
  );
  const byService = new Map(
    snapshots.map((snapshot) => [snapshot.service, snapshot] as const)
  );

  return MODULE_DEFINITIONS.flatMap((definition) => {
    const snapshot = byService.get(definition.service);

    if (!snapshot) {
      return [];
    }

    return snapshot.capabilities
      .filter((capability) => capability.capability === definition.key)
      .map((capability) => ({
        ...capability,
        key: capability.capability,
        description: descriptions.get(capability.capability)?.description ?? "",
        enabled: snapshot.status === "up" || snapshot.status === "degraded",
        status: snapshot.status
      }));
  });
}

export interface CommandMeta {
  commandId: CommandId;
  workspaceId: WorkspaceId;
  requestedAt: IsoDateTime;
  requestedBy: ActorRef;
  correlationId?: CorrelationId;
  causationEventId?: EventId;
}

export const CommandMetaSchema = z.object({
  commandId: CommandIdSchema,
  workspaceId: WorkspaceIdSchema,
  requestedAt: IsoDateTimeSchema,
  requestedBy: ActorRefSchema,
  correlationId: CorrelationIdSchema.optional(),
  causationEventId: EventIdSchema.optional()
});

export interface QueryMeta {
  queryId: QueryId;
  workspaceId: WorkspaceId;
  requestedAt: IsoDateTime;
  requestedBy: ActorRef;
  consistency: ConsistencyMode;
}

export const QueryMetaSchema = z.object({
  queryId: QueryIdSchema,
  workspaceId: WorkspaceIdSchema,
  requestedAt: IsoDateTimeSchema,
  requestedBy: ActorRefSchema,
  consistency: ConsistencyModeSchema
});

export interface DomainCommandEnvelope<
  TName extends string,
  TPayload extends object
> {
  commandName: TName;
  schemaVersion: SchemaVersion;
  meta: CommandMeta;
  payload: TPayload;
}

export function createDomainCommandEnvelopeSchema<
  TName extends string,
  TPayloadSchema extends z.ZodTypeAny
>(commandName: z.ZodType<TName>, payload: TPayloadSchema) {
  return z.object({
    commandName,
    schemaVersion: SchemaVersionSchema,
    meta: CommandMetaSchema,
    payload
  });
}

export interface DomainQueryEnvelope<
  TName extends string,
  TParams extends object
> {
  queryName: TName;
  schemaVersion: SchemaVersion;
  meta: QueryMeta;
  params: TParams;
}

export function createDomainQueryEnvelopeSchema<
  TName extends string,
  TParamsSchema extends z.ZodTypeAny
>(queryName: z.ZodType<TName>, params: TParamsSchema) {
  return z.object({
    queryName,
    schemaVersion: SchemaVersionSchema,
    meta: QueryMetaSchema,
    params
  });
}

export interface DomainEventEnvelope<
  TName extends string,
  TPayload extends object
> {
  eventId: EventId;
  eventName: TName;
  schemaVersion: SchemaVersion;
  workspaceId: WorkspaceId;
  occurredAt: IsoDateTime;
  actor: ActorRef;
  correlationId?: CorrelationId;
  sourceService: ServiceName;
  payload: TPayload;
}

export function createDomainEventEnvelopeSchema<
  TName extends string,
  TPayloadSchema extends z.ZodTypeAny
>(eventName: z.ZodType<TName>, payload: TPayloadSchema) {
  return z.object({
    eventId: EventIdSchema,
    eventName,
    schemaVersion: SchemaVersionSchema,
    workspaceId: WorkspaceIdSchema,
    occurredAt: IsoDateTimeSchema,
    actor: ActorRefSchema,
    correlationId: CorrelationIdSchema.optional(),
    sourceService: ServiceNameSchema,
    payload
  });
}

export interface PageRequest {
  limit: number;
  cursor?: string;
}

export const PageRequestSchema = z.object({
  limit: z.number().int().positive(),
  cursor: z.string().min(1).optional()
});

export interface PageInfo {
  nextCursor?: string;
  hasMore: boolean;
}

export const PageInfoSchema = z.object({
  nextCursor: z.string().min(1).optional(),
  hasMore: z.boolean()
});

export interface CursorPage<TItem> {
  items: TItem[];
  pageInfo: PageInfo;
}

export function createCursorPageSchema<TItemSchema extends z.ZodTypeAny>(
  item: TItemSchema
) {
  return z.object({
    items: z.array(item),
    pageInfo: PageInfoSchema
  });
}

export interface SortSpec {
  field: string;
  direction: "asc" | "desc";
}

export const SortSpecSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(["asc", "desc"])
});

export interface SearchFilter {
  field: string;
  value: JsonValue;
}

export const SearchFilterSchema = z.object({
  field: z.string().min(1),
  value: JsonValueSchema
});

export interface ValidationIssue {
  path: string;
  rule: string;
  message: string;
}

export const ValidationIssueSchema = z.object({
  path: z.string().min(1),
  rule: z.string().min(1),
  message: z.string().min(1)
});

export const COMMON_ERROR_CODE_VALUES = [
  "BAD_REQUEST",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_FAILED",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR"
] as const;
export type CommonErrorCode = (typeof COMMON_ERROR_CODE_VALUES)[number];

export const CommonErrorCodeSchema = z.enum(COMMON_ERROR_CODE_VALUES);

export interface DomainError<
  TCode extends string = CommonErrorCode,
  TDetails extends object = JsonObject
> {
  code: TCode;
  message: string;
  status: number;
  retryable: boolean;
  details?: TDetails;
}

export function createDomainErrorSchema<
  TCode extends string,
  TDetailsSchema extends z.ZodTypeAny = z.ZodObject<z.ZodRawShape>
>(
  code: z.ZodType<TCode>,
  details?: TDetailsSchema
) {
  return z.object({
    code,
    message: z.string().min(1),
    status: z.number().int().min(400).max(599),
    retryable: z.boolean(),
    details: (details ?? z.record(z.string(), JsonValueSchema)).optional()
  });
}

export interface ValidationErrorDetails {
  issues: ValidationIssue[];
}

export const ValidationErrorDetailsSchema = z.object({
  issues: z.array(ValidationIssueSchema)
});

export interface NotFoundErrorDetails {
  entityType: string;
  entityId: string;
}

export const NotFoundErrorDetailsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1)
});

export interface ConflictErrorDetails {
  resourceType: string;
  resourceId: string;
  conflictingResourceId?: string;
}

export const ConflictErrorDetailsSchema = z.object({
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  conflictingResourceId: z.string().min(1).optional()
});

export interface DependencyUnavailableDetails {
  dependency: ServiceName | string;
  reason: string;
}

export const DependencyUnavailableDetailsSchema = z.object({
  dependency: z.string().min(1),
  reason: z.string().min(1)
});

function startCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const CORE_SCHEMA_CONSTANTS = {
  apiKeyProfiles: API_KEY_PROFILE_VALUES,
  capabilityNames: CAPABILITY_NAME_VALUES,
  commonErrorCodes: COMMON_ERROR_CODE_VALUES,
  eventSubjectPattern: EVENT_SUBJECT_PATTERN,
  httpRoutePrefixes: HTTP_ROUTE_PREFIXES,
  idPrefixes: ID_PREFIXES,
  schemaVersions: SCHEMA_VERSION_VALUES,
  serviceNames: SERVICE_NAME_VALUES
} as const;

export const PLATFORM_EVENT_SUBJECTS = {
  serviceHealthChanged: makeEventSubject("platform", "service-health", "changed"),
  capabilitiesChanged: makeEventSubject("platform", "capabilities", "changed")
} as const;
