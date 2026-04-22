import { z } from "zod";
import type {
  AuditFields,
  DomainCommandEnvelope,
  DomainError,
  DomainEventEnvelope,
  DomainQueryEnvelope,
  EvidenceNoteId,
  GoalId,
  GraphNodeId,
  IsoDate,
  IsoDateTime,
  JsonObject,
  PlanItemId,
  SkillId
} from "@pdp-helper/contracts-core";
import {
  AuditFieldsSchema,
  EvidenceNoteIdSchema,
  GoalIdSchema,
  GraphNodeIdSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  PlanItemIdSchema,
  SkillIdSchema,
  createDomainEventEnvelopeSchema,
  makeEventSubject
} from "@pdp-helper/contracts-core";

export const GOAL_STATUS_VALUES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived"
] as const;
export type GoalStatus = (typeof GOAL_STATUS_VALUES)[number];

export const PLAN_ITEM_KIND_VALUES = [
  "skill",
  "milestone",
  "task",
  "evidence-note"
] as const;
export type PlanItemKind = (typeof PLAN_ITEM_KIND_VALUES)[number];

export const PLAN_ITEM_STATUS_VALUES = [
  "not-started",
  "in-progress",
  "blocked",
  "completed",
  "canceled"
] as const;
export type PlanItemStatus = (typeof PLAN_ITEM_STATUS_VALUES)[number];

export const SKILL_GRAPH_VISIBILITY_VALUES = [
  "accepted",
  "hidden",
  "pending"
] as const;
export type SkillGraphVisibility = (typeof SKILL_GRAPH_VISIBILITY_VALUES)[number];

export interface Goal extends AuditFields {
  id: GoalId;
  title: string;
  description?: string;
  status: GoalStatus;
  sourceGraphNodeId?: GraphNodeId;
  targetDate?: IsoDate;
}

export interface PlanItem extends AuditFields {
  id: PlanItemId;
  goalId: GoalId;
  parentPlanItemId?: PlanItemId;
  title: string;
  description?: string;
  kind: PlanItemKind;
  status: PlanItemStatus;
  sortOrder: number;
  linkedSkillId?: SkillId;
  linkedGraphNodeId?: GraphNodeId;
  skillGraphVisibility: SkillGraphVisibility;
  dueDate?: IsoDate;
  completedAt?: IsoDateTime;
}

export interface EvidenceNote extends AuditFields {
  id: EvidenceNoteId;
  goalId: GoalId;
  planItemId?: PlanItemId;
  body: string;
  attachments?: string[];
}

export const GoalStatusSchema = z.enum(GOAL_STATUS_VALUES);
export const PlanItemKindSchema = z.enum(PLAN_ITEM_KIND_VALUES);
export const PlanItemStatusSchema = z.enum(PLAN_ITEM_STATUS_VALUES);
export const SkillGraphVisibilitySchema = z.enum(SKILL_GRAPH_VISIBILITY_VALUES);

export const GoalSchema = AuditFieldsSchema.extend({
  id: GoalIdSchema,
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  status: GoalStatusSchema,
  sourceGraphNodeId: GraphNodeIdSchema.optional(),
  targetDate: IsoDateSchema.optional()
});

export const PlanItemSchema = AuditFieldsSchema.extend({
  id: PlanItemIdSchema,
  goalId: GoalIdSchema,
  parentPlanItemId: PlanItemIdSchema.optional(),
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  kind: PlanItemKindSchema,
  status: PlanItemStatusSchema,
  sortOrder: z.number().int(),
  linkedSkillId: SkillIdSchema.optional(),
  linkedGraphNodeId: GraphNodeIdSchema.optional(),
  skillGraphVisibility: SkillGraphVisibilitySchema,
  dueDate: IsoDateSchema.optional(),
  completedAt: IsoDateTimeSchema.optional()
});

export const EvidenceNoteSchema = AuditFieldsSchema.extend({
  id: EvidenceNoteIdSchema,
  goalId: GoalIdSchema,
  planItemId: PlanItemIdSchema.optional(),
  body: z.string().min(1),
  attachments: z.array(z.string().min(1)).optional()
});

export const PLANNER_COMMAND_NAMES = [
  "planner.create-goal",
  "planner.create-goal-from-graph-node",
  "planner.update-goal",
  "planner.complete-goal",
  "planner.create-plan-item",
  "planner.update-plan-item",
  "planner.set-plan-item-status",
  "planner.set-plan-item-skill-graph-visibility",
  "planner.add-evidence-note"
] as const;
export type PlannerCommandName = (typeof PLANNER_COMMAND_NAMES)[number];

export const PLANNER_QUERY_NAMES = [
  "planner.get-goal",
  "planner.list-goals",
  "planner.get-goal-plan",
  "planner.list-plan-items"
] as const;
export type PlannerQueryName = (typeof PLANNER_QUERY_NAMES)[number];

export interface CreateGoalCommandPayload {
  goalId: GoalId;
  title: string;
  description?: string;
  targetDate?: IsoDate;
}

export type CreateGoalCommand = DomainCommandEnvelope<
  "planner.create-goal",
  CreateGoalCommandPayload
>;

export interface CreateGoalFromGraphNodeCommandPayload {
  goalId: GoalId;
  sourceGraphNodeId: GraphNodeId;
  title?: string;
  description?: string;
  targetDate?: IsoDate;
}

export type CreateGoalFromGraphNodeCommand = DomainCommandEnvelope<
  "planner.create-goal-from-graph-node",
  CreateGoalFromGraphNodeCommandPayload
>;

export interface UpdateGoalCommandPayload {
  goalId: GoalId;
  title?: string;
  description?: string;
  status?: GoalStatus;
  targetDate?: IsoDate;
}

export type UpdateGoalCommand = DomainCommandEnvelope<
  "planner.update-goal",
  UpdateGoalCommandPayload
>;

export interface CompleteGoalCommandPayload {
  goalId: GoalId;
  completedAt: IsoDateTime;
}

export type CompleteGoalCommand = DomainCommandEnvelope<
  "planner.complete-goal",
  CompleteGoalCommandPayload
>;

export interface CreatePlanItemCommandPayload {
  planItemId: PlanItemId;
  goalId: GoalId;
  parentPlanItemId?: PlanItemId;
  title: string;
  description?: string;
  kind: PlanItemKind;
  sortOrder: number;
  linkedSkillId?: SkillId;
  linkedGraphNodeId?: GraphNodeId;
  dueDate?: IsoDate;
}

export type CreatePlanItemCommand = DomainCommandEnvelope<
  "planner.create-plan-item",
  CreatePlanItemCommandPayload
>;

export interface UpdatePlanItemCommandPayload {
  planItemId: PlanItemId;
  title?: string;
  description?: string;
  dueDate?: IsoDate;
  sortOrder?: number;
}

export type UpdatePlanItemCommand = DomainCommandEnvelope<
  "planner.update-plan-item",
  UpdatePlanItemCommandPayload
>;

export interface SetPlanItemStatusCommandPayload {
  planItemId: PlanItemId;
  status: PlanItemStatus;
  completedAt?: IsoDateTime;
}

export type SetPlanItemStatusCommand = DomainCommandEnvelope<
  "planner.set-plan-item-status",
  SetPlanItemStatusCommandPayload
>;

export interface SetPlanItemSkillGraphVisibilityCommandPayload {
  planItemId: PlanItemId;
  visibility: SkillGraphVisibility;
}

export type SetPlanItemSkillGraphVisibilityCommand = DomainCommandEnvelope<
  "planner.set-plan-item-skill-graph-visibility",
  SetPlanItemSkillGraphVisibilityCommandPayload
>;

export interface AddEvidenceNoteCommandPayload {
  evidenceNoteId: EvidenceNoteId;
  goalId: GoalId;
  planItemId?: PlanItemId;
  body: string;
  attachments?: string[];
}

export type AddEvidenceNoteCommand = DomainCommandEnvelope<
  "planner.add-evidence-note",
  AddEvidenceNoteCommandPayload
>;

export type PlannerCommand =
  | AddEvidenceNoteCommand
  | CompleteGoalCommand
  | CreateGoalCommand
  | CreateGoalFromGraphNodeCommand
  | CreatePlanItemCommand
  | SetPlanItemSkillGraphVisibilityCommand
  | SetPlanItemStatusCommand
  | UpdateGoalCommand
  | UpdatePlanItemCommand;

export interface GetGoalQueryParams {
  goalId: GoalId;
}

export type GetGoalQuery = DomainQueryEnvelope<
  "planner.get-goal",
  GetGoalQueryParams
>;

export interface ListGoalsQueryParams {
  status?: GoalStatus;
  includeArchived?: boolean;
}

export type ListGoalsQuery = DomainQueryEnvelope<
  "planner.list-goals",
  ListGoalsQueryParams
>;

export interface GetGoalPlanQueryParams {
  goalId: GoalId;
  includeEvidence?: boolean;
}

export type GetGoalPlanQuery = DomainQueryEnvelope<
  "planner.get-goal-plan",
  GetGoalPlanQueryParams
>;

export interface ListPlanItemsQueryParams {
  goalId: GoalId;
  status?: PlanItemStatus;
}

export type ListPlanItemsQuery = DomainQueryEnvelope<
  "planner.list-plan-items",
  ListPlanItemsQueryParams
>;

export type PlannerQuery =
  | GetGoalPlanQuery
  | GetGoalQuery
  | ListGoalsQuery
  | ListPlanItemsQuery;

export const PLANNER_EVENT_SUBJECTS = {
  goalCreated: makeEventSubject("plan", "goal", "created"),
  goalUpdated: makeEventSubject("plan", "goal", "updated"),
  goalCompleted: makeEventSubject("plan", "goal", "completed"),
  itemCreated: makeEventSubject("plan", "item", "created"),
  itemUpdated: makeEventSubject("plan", "item", "updated"),
  itemCompleted: makeEventSubject("plan", "item", "completed"),
  itemVisibilityChanged: makeEventSubject("plan", "item", "visibility", "changed"),
  evidenceRecorded: makeEventSubject("plan", "evidence", "recorded")
} as const;

export const PLANNER_EVENT_NAMES = [
  PLANNER_EVENT_SUBJECTS.goalCreated,
  PLANNER_EVENT_SUBJECTS.goalUpdated,
  PLANNER_EVENT_SUBJECTS.goalCompleted,
  PLANNER_EVENT_SUBJECTS.itemCreated,
  PLANNER_EVENT_SUBJECTS.itemUpdated,
  PLANNER_EVENT_SUBJECTS.itemCompleted,
  PLANNER_EVENT_SUBJECTS.itemVisibilityChanged,
  PLANNER_EVENT_SUBJECTS.evidenceRecorded
] as const;
export type PlannerEventName = (typeof PLANNER_EVENT_NAMES)[number];

export type GoalCreatedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["goalCreated"],
  {
    goal: Goal;
  }
>;

export type GoalUpdatedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["goalUpdated"],
  {
    goalId: GoalId;
    changes: JsonObject;
  }
>;

export type GoalCompletedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["goalCompleted"],
  {
    goalId: GoalId;
    completedAt: IsoDateTime;
  }
>;

export type PlanItemCreatedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["itemCreated"],
  {
    planItem: PlanItem;
  }
>;

export type PlanItemUpdatedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["itemUpdated"],
  {
    planItemId: PlanItemId;
    changes: JsonObject;
  }
>;

export type PlanItemCompletedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["itemCompleted"],
  {
    planItemId: PlanItemId;
    completedAt: IsoDateTime;
  }
>;

export type PlanItemVisibilityChangedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["itemVisibilityChanged"],
  {
    planItemId: PlanItemId;
    visibility: SkillGraphVisibility;
  }
>;

export type EvidenceRecordedEvent = DomainEventEnvelope<
  (typeof PLANNER_EVENT_SUBJECTS)["evidenceRecorded"],
  {
    evidenceNote: EvidenceNote;
  }
>;

export const GoalCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.goalCreated),
  z.object({
    goal: GoalSchema
  })
);

export const GoalUpdatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.goalUpdated),
  z.object({
    goalId: GoalIdSchema,
    changes: JsonObjectSchema
  })
);

export const GoalCompletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.goalCompleted),
  z.object({
    goalId: GoalIdSchema,
    completedAt: IsoDateTimeSchema
  })
);

export const PlanItemCreatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.itemCreated),
  z.object({
    planItem: PlanItemSchema
  })
);

export const PlanItemUpdatedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.itemUpdated),
  z.object({
    planItemId: PlanItemIdSchema,
    changes: JsonObjectSchema
  })
);

export const PlanItemCompletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.itemCompleted),
  z.object({
    planItemId: PlanItemIdSchema,
    completedAt: IsoDateTimeSchema
  })
);

export const PlanItemVisibilityChangedEventSchema =
  createDomainEventEnvelopeSchema(
    z.literal(PLANNER_EVENT_SUBJECTS.itemVisibilityChanged),
    z.object({
      planItemId: PlanItemIdSchema,
      visibility: SkillGraphVisibilitySchema
    })
  );

export const EvidenceRecordedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(PLANNER_EVENT_SUBJECTS.evidenceRecorded),
  z.object({
    evidenceNote: EvidenceNoteSchema
  })
);

export const PlannerEventSchema = z.discriminatedUnion("eventName", [
  GoalCreatedEventSchema,
  GoalUpdatedEventSchema,
  GoalCompletedEventSchema,
  PlanItemCreatedEventSchema,
  PlanItemUpdatedEventSchema,
  PlanItemCompletedEventSchema,
  PlanItemVisibilityChangedEventSchema,
  EvidenceRecordedEventSchema
]);

export type PlannerEvent =
  | EvidenceRecordedEvent
  | GoalCompletedEvent
  | GoalCreatedEvent
  | GoalUpdatedEvent
  | PlanItemCompletedEvent
  | PlanItemCreatedEvent
  | PlanItemVisibilityChangedEvent
  | PlanItemUpdatedEvent;

export const PLANNER_ERROR_CODE_VALUES = [
  "GOAL_NOT_FOUND",
  "PLAN_ITEM_NOT_FOUND",
  "EVIDENCE_NOTE_NOT_FOUND",
  "INVALID_PLAN_STATE_TRANSITION",
  "INVALID_PLAN_ITEM_KIND",
  "SOURCE_GRAPH_NODE_NOT_FOUND"
] as const;
export type PlannerErrorCode = (typeof PLANNER_ERROR_CODE_VALUES)[number];

export interface InvalidPlanStateDetails {
  entityType: "goal" | "plan-item";
  entityId: GoalId | PlanItemId;
  currentStatus: GoalStatus | PlanItemStatus;
  attemptedStatus: GoalStatus | PlanItemStatus;
}

export type PlannerError = DomainError<PlannerErrorCode, InvalidPlanStateDetails>;

export const PLANNER_SCHEMA_CONSTANTS = {
  goalStatuses: GOAL_STATUS_VALUES,
  planItemKinds: PLAN_ITEM_KIND_VALUES,
  planItemStatuses: PLAN_ITEM_STATUS_VALUES,
  skillGraphVisibility: SKILL_GRAPH_VISIBILITY_VALUES
} as const;
