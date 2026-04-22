import { z } from "zod";
import type {
  AuditFields,
  CanvasId,
  DomainCommandEnvelope,
  DomainError,
  DomainEventEnvelope,
  DomainQueryEnvelope,
  GoalId,
  GraphNodeId,
  IsoDateTime,
  JsonObject,
  PlanItemId,
  ProviderId,
  RecommendationId,
  RecommendationRunId,
  SkillId
} from "@pdp-helper/contracts-core";
import {
  AuditFieldsSchema,
  CanvasIdSchema,
  GoalIdSchema,
  GraphNodeIdSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  PlanItemIdSchema,
  ProviderIdSchema,
  RecommendationIdSchema,
  RecommendationRunIdSchema,
  SkillIdSchema,
  createDomainEventEnvelopeSchema,
  makeEventSubject
} from "@pdp-helper/contracts-core";

export const RECOMMENDATION_STATUS_VALUES = [
  "pending",
  "accepted",
  "denied",
  "expired"
] as const;
export type RecommendationStatus =
  (typeof RECOMMENDATION_STATUS_VALUES)[number];

export const RECOMMENDATION_ORIGIN_VALUES = [
  "built-in",
  "external-tool",
  "system"
] as const;
export type RecommendationOrigin = (typeof RECOMMENDATION_ORIGIN_VALUES)[number];

export const RECOMMENDATION_ACTION_VALUES = [
  "create-node",
  "create-edge",
  "create-plan-item",
  "link-skill",
  "annotate"
] as const;
export type RecommendationAction = (typeof RECOMMENDATION_ACTION_VALUES)[number];

export const RECOMMENDATION_TARGET_KIND_VALUES = [
  "canvas",
  "graph-node",
  "skill",
  "goal",
  "plan-item"
] as const;
export type RecommendationTargetKind =
  (typeof RECOMMENDATION_TARGET_KIND_VALUES)[number];

export const RECOMMENDATION_RUN_TRIGGER_VALUES = [
  "manual",
  "scheduled",
  "recovery",
  "external"
] as const;
export type RecommendationRunTrigger =
  (typeof RECOMMENDATION_RUN_TRIGGER_VALUES)[number];

export const RECOMMENDATION_RUN_STATUS_VALUES = [
  "queued",
  "running",
  "completed",
  "deferred",
  "failed"
] as const;
export type RecommendationRunStatus =
  (typeof RECOMMENDATION_RUN_STATUS_VALUES)[number];

export const PROVIDER_KIND_VALUES = ["ollama", "external"] as const;
export type ProviderKind = (typeof PROVIDER_KIND_VALUES)[number];

export const PROVIDER_HEALTH_STATUS_VALUES = [
  "up",
  "down",
  "degraded"
] as const;
export type ProviderHealthStatus =
  (typeof PROVIDER_HEALTH_STATUS_VALUES)[number];

export interface RecommendationTargetRef {
  targetKind: RecommendationTargetKind;
  canvasId?: CanvasId;
  graphNodeId?: GraphNodeId;
  skillId?: SkillId;
  goalId?: GoalId;
  planItemId?: PlanItemId;
}

export interface Recommendation extends AuditFields {
  id: RecommendationId;
  runId: RecommendationRunId;
  status: RecommendationStatus;
  origin: RecommendationOrigin;
  action: RecommendationAction;
  title: string;
  rationale?: string;
  target: RecommendationTargetRef;
  payload: JsonObject;
}

export interface RecommendationRun extends AuditFields {
  id: RecommendationRunId;
  providerId: ProviderId;
  trigger: RecommendationRunTrigger;
  status: RecommendationRunStatus;
  startedAt?: IsoDateTime;
  completedAt?: IsoDateTime;
  deferredReason?: string;
}

export interface RecommendationDecision extends AuditFields {
  recommendationId: RecommendationId;
  decision: "accepted" | "denied";
  decidedAt: IsoDateTime;
  reason?: string;
}

export interface AcceptedRecommendationDecision extends RecommendationDecision {
  decision: "accepted";
}

export interface DeniedRecommendationDecision extends RecommendationDecision {
  decision: "denied";
}

export interface ProviderHealth extends AuditFields {
  providerId: ProviderId;
  providerKind: ProviderKind;
  status: ProviderHealthStatus;
  checkedAt: IsoDateTime;
  lastSuccessfulAt?: IsoDateTime;
  message?: string;
}

export const RecommendationStatusSchema = z.enum(RECOMMENDATION_STATUS_VALUES);
export const RecommendationOriginSchema = z.enum(RECOMMENDATION_ORIGIN_VALUES);
export const RecommendationActionSchema = z.enum(RECOMMENDATION_ACTION_VALUES);
export const RecommendationTargetKindSchema = z.enum(
  RECOMMENDATION_TARGET_KIND_VALUES
);
export const RecommendationRunTriggerSchema = z.enum(
  RECOMMENDATION_RUN_TRIGGER_VALUES
);
export const RecommendationRunStatusSchema = z.enum(
  RECOMMENDATION_RUN_STATUS_VALUES
);
export const ProviderKindSchema = z.enum(PROVIDER_KIND_VALUES);
export const ProviderHealthStatusSchema = z.enum(PROVIDER_HEALTH_STATUS_VALUES);

export const RecommendationTargetRefSchema = z.object({
  targetKind: RecommendationTargetKindSchema,
  canvasId: CanvasIdSchema.optional(),
  graphNodeId: GraphNodeIdSchema.optional(),
  skillId: SkillIdSchema.optional(),
  goalId: GoalIdSchema.optional(),
  planItemId: PlanItemIdSchema.optional()
});

export const RecommendationSchema = AuditFieldsSchema.extend({
  id: RecommendationIdSchema,
  runId: RecommendationRunIdSchema,
  status: RecommendationStatusSchema,
  origin: RecommendationOriginSchema,
  action: RecommendationActionSchema,
  title: z.string().min(1),
  rationale: z.string().min(1).optional(),
  target: RecommendationTargetRefSchema,
  payload: JsonObjectSchema
});

export const RecommendationRunSchema = AuditFieldsSchema.extend({
  id: RecommendationRunIdSchema,
  providerId: ProviderIdSchema,
  trigger: RecommendationRunTriggerSchema,
  status: RecommendationRunStatusSchema,
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
  deferredReason: z.string().min(1).optional()
});

export const RecommendationDecisionSchema = AuditFieldsSchema.extend({
  recommendationId: RecommendationIdSchema,
  decision: z.enum(["accepted", "denied"]),
  decidedAt: IsoDateTimeSchema,
  reason: z.string().min(1).optional()
});

export const AcceptedRecommendationDecisionSchema =
  RecommendationDecisionSchema.extend({
    decision: z.literal("accepted")
  });

export const DeniedRecommendationDecisionSchema =
  RecommendationDecisionSchema.extend({
    decision: z.literal("denied")
  });

export const ProviderHealthSchema = AuditFieldsSchema.extend({
  providerId: ProviderIdSchema,
  providerKind: ProviderKindSchema,
  status: ProviderHealthStatusSchema,
  checkedAt: IsoDateTimeSchema,
  lastSuccessfulAt: IsoDateTimeSchema.optional(),
  message: z.string().min(1).optional()
});

export const RECOMMENDATION_COMMAND_NAMES = [
  "recommendation.request-run",
  "recommendation.ingest-external",
  "recommendation.accept",
  "recommendation.deny",
  "recommendation.update-provider-health"
] as const;
export type RecommendationCommandName =
  (typeof RECOMMENDATION_COMMAND_NAMES)[number];

export const RECOMMENDATION_QUERY_NAMES = [
  "recommendation.get-feed",
  "recommendation.list-runs",
  "recommendation.get-provider-health"
] as const;
export type RecommendationQueryName =
  (typeof RECOMMENDATION_QUERY_NAMES)[number];

export interface RequestRecommendationRunCommandPayload {
  runId: RecommendationRunId;
  providerId: ProviderId;
  trigger: RecommendationRunTrigger;
  target?: RecommendationTargetRef;
}

export type RequestRecommendationRunCommand = DomainCommandEnvelope<
  "recommendation.request-run",
  RequestRecommendationRunCommandPayload
>;

export interface IngestExternalRecommendationCommandPayload {
  recommendationId: RecommendationId;
  runId: RecommendationRunId;
  origin: RecommendationOrigin;
  action: RecommendationAction;
  title: string;
  rationale?: string;
  target: RecommendationTargetRef;
  payload: JsonObject;
}

export type IngestExternalRecommendationCommand = DomainCommandEnvelope<
  "recommendation.ingest-external",
  IngestExternalRecommendationCommandPayload
>;

export interface AcceptRecommendationCommandPayload {
  recommendationId: RecommendationId;
  reason?: string;
}

export type AcceptRecommendationCommand = DomainCommandEnvelope<
  "recommendation.accept",
  AcceptRecommendationCommandPayload
>;

export interface DenyRecommendationCommandPayload {
  recommendationId: RecommendationId;
  reason?: string;
}

export type DenyRecommendationCommand = DomainCommandEnvelope<
  "recommendation.deny",
  DenyRecommendationCommandPayload
>;

export interface UpdateProviderHealthCommandPayload {
  providerId: ProviderId;
  providerKind: ProviderKind;
  status: ProviderHealthStatus;
  checkedAt: IsoDateTime;
  message?: string;
}

export type UpdateProviderHealthCommand = DomainCommandEnvelope<
  "recommendation.update-provider-health",
  UpdateProviderHealthCommandPayload
>;

export type RecommendationCommand =
  | AcceptRecommendationCommand
  | DenyRecommendationCommand
  | IngestExternalRecommendationCommand
  | RequestRecommendationRunCommand
  | UpdateProviderHealthCommand;

export interface GetRecommendationFeedQueryParams {
  status?: RecommendationStatus;
  targetKind?: RecommendationTargetKind;
}

export type GetRecommendationFeedQuery = DomainQueryEnvelope<
  "recommendation.get-feed",
  GetRecommendationFeedQueryParams
>;

export interface ListRecommendationRunsQueryParams {
  providerId?: ProviderId;
  status?: RecommendationRunStatus;
}

export type ListRecommendationRunsQuery = DomainQueryEnvelope<
  "recommendation.list-runs",
  ListRecommendationRunsQueryParams
>;

export interface GetProviderHealthQueryParams {
  providerId?: ProviderId;
}

export type GetProviderHealthQuery = DomainQueryEnvelope<
  "recommendation.get-provider-health",
  GetProviderHealthQueryParams
>;

export type RecommendationQuery =
  | GetProviderHealthQuery
  | GetRecommendationFeedQuery
  | ListRecommendationRunsQuery;

export const RECOMMENDATION_EVENT_SUBJECTS = {
  requested: makeEventSubject("recommendation", "requested"),
  generated: makeEventSubject("recommendation", "generated"),
  accepted: makeEventSubject("recommendation", "accepted"),
  denied: makeEventSubject("recommendation", "denied"),
  deferred: makeEventSubject("recommendation", "deferred"),
  providerHealthChanged: makeEventSubject("provider", "health", "changed")
} as const;

export const RECOMMENDATION_EVENT_NAMES = [
  RECOMMENDATION_EVENT_SUBJECTS.requested,
  RECOMMENDATION_EVENT_SUBJECTS.generated,
  RECOMMENDATION_EVENT_SUBJECTS.accepted,
  RECOMMENDATION_EVENT_SUBJECTS.denied,
  RECOMMENDATION_EVENT_SUBJECTS.deferred,
  RECOMMENDATION_EVENT_SUBJECTS.providerHealthChanged
] as const;
export type RecommendationEventName =
  (typeof RECOMMENDATION_EVENT_NAMES)[number];

export type RecommendationRequestedEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["requested"],
  {
    run: RecommendationRun;
  }
>;

export type RecommendationGeneratedEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["generated"],
  {
    recommendation: Recommendation;
  }
>;

export type RecommendationAcceptedEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["accepted"],
  {
    decision: AcceptedRecommendationDecision;
  }
>;

export type RecommendationDeniedEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["denied"],
  {
    decision: DeniedRecommendationDecision;
  }
>;

export type RecommendationDeferredEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["deferred"],
  {
    runId: RecommendationRunId;
    providerId: ProviderId;
    reason: string;
  }
>;

export type ProviderHealthChangedEvent = DomainEventEnvelope<
  (typeof RECOMMENDATION_EVENT_SUBJECTS)["providerHealthChanged"],
  {
    providerHealth: ProviderHealth;
  }
>;

export const RecommendationRequestedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.requested),
  z.object({
    run: RecommendationRunSchema
  })
);

export const RecommendationGeneratedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.generated),
  z.object({
    recommendation: RecommendationSchema
  })
);

export const RecommendationAcceptedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.accepted),
  z.object({
    decision: AcceptedRecommendationDecisionSchema
  })
);

export const RecommendationDeniedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.denied),
  z.object({
    decision: DeniedRecommendationDecisionSchema
  })
);

export const RecommendationDeferredEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.deferred),
  z.object({
    runId: RecommendationRunIdSchema,
    providerId: ProviderIdSchema,
    reason: z.string().min(1)
  })
);

export const ProviderHealthChangedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(RECOMMENDATION_EVENT_SUBJECTS.providerHealthChanged),
  z.object({
    providerHealth: ProviderHealthSchema
  })
);

export const RecommendationEventSchema = z.discriminatedUnion("eventName", [
  RecommendationRequestedEventSchema,
  RecommendationGeneratedEventSchema,
  RecommendationAcceptedEventSchema,
  RecommendationDeniedEventSchema,
  RecommendationDeferredEventSchema,
  ProviderHealthChangedEventSchema
]);

export type RecommendationEvent =
  | ProviderHealthChangedEvent
  | RecommendationAcceptedEvent
  | RecommendationDeferredEvent
  | RecommendationDeniedEvent
  | RecommendationGeneratedEvent
  | RecommendationRequestedEvent;

export const RECOMMENDATION_ERROR_CODE_VALUES = [
  "RECOMMENDATION_NOT_FOUND",
  "RECOMMENDATION_ALREADY_DECIDED",
  "PROVIDER_UNAVAILABLE",
  "INVALID_RECOMMENDATION_TARGET"
] as const;
export type RecommendationErrorCode =
  (typeof RECOMMENDATION_ERROR_CODE_VALUES)[number];

export interface ProviderUnavailableDetails {
  providerId: ProviderId;
  status: ProviderHealthStatus;
  reason: string;
}

export type RecommendationError = DomainError<
  RecommendationErrorCode,
  ProviderUnavailableDetails
>;

export const RECOMMENDATION_SCHEMA_CONSTANTS = {
  actions: RECOMMENDATION_ACTION_VALUES,
  origins: RECOMMENDATION_ORIGIN_VALUES,
  providerHealthStatuses: PROVIDER_HEALTH_STATUS_VALUES,
  runStatuses: RECOMMENDATION_RUN_STATUS_VALUES,
  statuses: RECOMMENDATION_STATUS_VALUES,
  targetKinds: RECOMMENDATION_TARGET_KIND_VALUES
} as const;
