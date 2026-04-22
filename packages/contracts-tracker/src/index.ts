import { z } from "zod";
import type {
  AuditFields,
  DomainCommandEnvelope,
  DomainError,
  DomainEventEnvelope,
  DomainQueryEnvelope,
  GoalId,
  IsoDateTime,
  PlanItemId,
  ProgressProjectionId
} from "@pdp-helper/contracts-core";
import {
  AuditFieldsSchema,
  GoalIdSchema,
  IsoDateTimeSchema,
  ProgressProjectionIdSchema,
  createDomainEventEnvelopeSchema,
  makeEventSubject
} from "@pdp-helper/contracts-core";

export const PROJECTION_STATUS_VALUES = [
  "current",
  "stale",
  "rebuilding",
  "failed"
] as const;
export type ProjectionStatus = (typeof PROJECTION_STATUS_VALUES)[number];

export const GOAL_PROGRESS_STATUS_VALUES = [
  "not-started",
  "on-track",
  "at-risk",
  "blocked",
  "completed"
] as const;
export type GoalProgressStatus = (typeof GOAL_PROGRESS_STATUS_VALUES)[number];

export interface ProjectionMetric {
  completedCount: number;
  totalCount: number;
  percentComplete: number;
}

export interface GoalProgressProjection extends AuditFields {
  id: ProgressProjectionId;
  goalId: GoalId;
  status: GoalProgressStatus;
  taskMetric: ProjectionMetric;
  milestoneMetric: ProjectionMetric;
  hiddenSkillCount: number;
  lastSourceEventAt?: IsoDateTime;
}

export interface WorkspaceProgressOverview extends AuditFields {
  id: ProgressProjectionId;
  activeGoalCount: number;
  completedGoalCount: number;
  overdueGoalCount: number;
  totalPlanItemCount: number;
  completedPlanItemCount: number;
  completionPercent: number;
  lastSourceEventAt?: IsoDateTime;
}

export interface ProjectionLagSnapshot {
  projectionName: string;
  status: ProjectionStatus;
  lagSeconds: number;
  lastAppliedEventAt?: IsoDateTime;
  lastError?: string;
}

export const ProjectionStatusSchema = z.enum(PROJECTION_STATUS_VALUES);
export const GoalProgressStatusSchema = z.enum(GOAL_PROGRESS_STATUS_VALUES);

export const ProjectionMetricSchema = z.object({
  completedCount: z.number().int(),
  totalCount: z.number().int(),
  percentComplete: z.number()
});

export const GoalProgressProjectionSchema = AuditFieldsSchema.extend({
  id: ProgressProjectionIdSchema,
  goalId: GoalIdSchema,
  status: GoalProgressStatusSchema,
  taskMetric: ProjectionMetricSchema,
  milestoneMetric: ProjectionMetricSchema,
  hiddenSkillCount: z.number().int(),
  lastSourceEventAt: IsoDateTimeSchema.optional()
});

export const WorkspaceProgressOverviewSchema = AuditFieldsSchema.extend({
  id: ProgressProjectionIdSchema,
  activeGoalCount: z.number().int(),
  completedGoalCount: z.number().int(),
  overdueGoalCount: z.number().int(),
  totalPlanItemCount: z.number().int(),
  completedPlanItemCount: z.number().int(),
  completionPercent: z.number(),
  lastSourceEventAt: IsoDateTimeSchema.optional()
});

export const ProjectionLagSnapshotSchema = z.object({
  projectionName: z.string().min(1),
  status: ProjectionStatusSchema,
  lagSeconds: z.number().int(),
  lastAppliedEventAt: IsoDateTimeSchema.optional(),
  lastError: z.string().min(1).optional()
});

export const TRACKER_COMMAND_NAMES = [
  "tracker.rebuild-goal-progress-projection",
  "tracker.rebuild-workspace-progress-overview",
  "tracker.reconcile-projection-lag"
] as const;
export type TrackerCommandName = (typeof TRACKER_COMMAND_NAMES)[number];

export const TRACKER_QUERY_NAMES = [
  "tracker.get-workspace-progress-overview",
  "tracker.get-goal-progress-projection",
  "tracker.list-projection-lag",
  "tracker.get-plan-item-progress-slice"
] as const;
export type TrackerQueryName = (typeof TRACKER_QUERY_NAMES)[number];

export interface RebuildGoalProgressProjectionCommandPayload {
  goalId: GoalId;
  projectionId: ProgressProjectionId;
}

export type RebuildGoalProgressProjectionCommand = DomainCommandEnvelope<
  "tracker.rebuild-goal-progress-projection",
  RebuildGoalProgressProjectionCommandPayload
>;

export interface RebuildWorkspaceProgressOverviewCommandPayload {
  projectionId: ProgressProjectionId;
}

export type RebuildWorkspaceProgressOverviewCommand = DomainCommandEnvelope<
  "tracker.rebuild-workspace-progress-overview",
  RebuildWorkspaceProgressOverviewCommandPayload
>;

export interface ReconcileProjectionLagCommandPayload {
  projectionName: string;
}

export type ReconcileProjectionLagCommand = DomainCommandEnvelope<
  "tracker.reconcile-projection-lag",
  ReconcileProjectionLagCommandPayload
>;

export type TrackerCommand =
  | RebuildGoalProgressProjectionCommand
  | RebuildWorkspaceProgressOverviewCommand
  | ReconcileProjectionLagCommand;

export interface GetWorkspaceProgressOverviewQueryParams {
  includeLag?: boolean;
}

export type GetWorkspaceProgressOverviewQuery = DomainQueryEnvelope<
  "tracker.get-workspace-progress-overview",
  GetWorkspaceProgressOverviewQueryParams
>;

export interface GetGoalProgressProjectionQueryParams {
  goalId: GoalId;
}

export type GetGoalProgressProjectionQuery = DomainQueryEnvelope<
  "tracker.get-goal-progress-projection",
  GetGoalProgressProjectionQueryParams
>;

export interface ListProjectionLagQueryParams {
  status?: ProjectionStatus;
}

export type ListProjectionLagQuery = DomainQueryEnvelope<
  "tracker.list-projection-lag",
  ListProjectionLagQueryParams
>;

export interface GetPlanItemProgressSliceQueryParams {
  goalId: GoalId;
  parentPlanItemId?: PlanItemId;
}

export type GetPlanItemProgressSliceQuery = DomainQueryEnvelope<
  "tracker.get-plan-item-progress-slice",
  GetPlanItemProgressSliceQueryParams
>;

export type TrackerQuery =
  | GetGoalProgressProjectionQuery
  | GetPlanItemProgressSliceQuery
  | GetWorkspaceProgressOverviewQuery
  | ListProjectionLagQuery;

export const TRACKER_EVENT_SUBJECTS = {
  projectionUpdated: makeEventSubject("tracker", "projection", "updated"),
  projectionRebuilt: makeEventSubject("tracker", "projection", "rebuilt"),
  projectionLagDetected: makeEventSubject("tracker", "projection", "lag-detected")
} as const;

export const TRACKER_EVENT_NAMES = [
  TRACKER_EVENT_SUBJECTS.projectionUpdated,
  TRACKER_EVENT_SUBJECTS.projectionRebuilt,
  TRACKER_EVENT_SUBJECTS.projectionLagDetected
] as const;
export type TrackerEventName = (typeof TRACKER_EVENT_NAMES)[number];

export type ProjectionUpdatedEvent = DomainEventEnvelope<
  (typeof TRACKER_EVENT_SUBJECTS)["projectionUpdated"],
  {
    projectionId: ProgressProjectionId;
    goalId?: GoalId;
    status: ProjectionStatus;
  }
>;

export type ProjectionRebuiltEvent = DomainEventEnvelope<
  (typeof TRACKER_EVENT_SUBJECTS)["projectionRebuilt"],
  {
    projectionId: ProgressProjectionId;
    projectionName: string;
  }
>;

export type ProjectionLagDetectedEvent = DomainEventEnvelope<
  (typeof TRACKER_EVENT_SUBJECTS)["projectionLagDetected"],
  {
    projectionName: string;
    lagSeconds: number;
    status: ProjectionStatus;
  }
>;

export const ProjectionUpdatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(TRACKER_EVENT_SUBJECTS.projectionUpdated),
  z.object({
    projectionId: ProgressProjectionIdSchema,
    goalId: GoalIdSchema.optional(),
    status: ProjectionStatusSchema
  })
);

export const ProjectionRebuiltEventSchema = createDomainEventEnvelopeSchema(
  z.literal(TRACKER_EVENT_SUBJECTS.projectionRebuilt),
  z.object({
    projectionId: ProgressProjectionIdSchema,
    projectionName: z.string().min(1)
  })
);

export const ProjectionLagDetectedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(TRACKER_EVENT_SUBJECTS.projectionLagDetected),
  z.object({
    projectionName: z.string().min(1),
    lagSeconds: z.number().int(),
    status: ProjectionStatusSchema
  })
);

export const TrackerEventSchema = z.discriminatedUnion("eventName", [
  ProjectionUpdatedEventSchema,
  ProjectionRebuiltEventSchema,
  ProjectionLagDetectedEventSchema
]);

export type TrackerEvent =
  | ProjectionLagDetectedEvent
  | ProjectionRebuiltEvent
  | ProjectionUpdatedEvent;

export const TRACKER_ERROR_CODE_VALUES = [
  "PROJECTION_NOT_FOUND",
  "PROJECTION_UNAVAILABLE",
  "PROJECTION_REBUILD_FAILED"
] as const;
export type TrackerErrorCode = (typeof TRACKER_ERROR_CODE_VALUES)[number];

export interface ProjectionUnavailableDetails {
  projectionName: string;
  reason: string;
}

export type TrackerError = DomainError<
  TrackerErrorCode,
  ProjectionUnavailableDetails
>;

export const TRACKER_SCHEMA_CONSTANTS = {
  goalProgressStatuses: GOAL_PROGRESS_STATUS_VALUES,
  projectionStatuses: PROJECTION_STATUS_VALUES
} as const;
