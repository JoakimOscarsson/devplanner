import type { ValidationIssue } from "@pdp-helper/contracts-core";
import type {
  Goal,
  PlanItem
} from "@pdp-helper/contracts-planner";
import { PLAN_ITEM_KIND_VALUES } from "@pdp-helper/contracts-planner";
import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { createDomainError, errorResponse, json, readBody } from "@pdp-helper/runtime-node";
import {
  addEvidenceNote,
  createGoal,
  createPlanItem,
  getGoal,
  listGoalPlan,
  listGoals
} from "../storage/in-memory.js";

interface CreateGoalBody {
  title: string;
  description?: string;
  targetDate?: Goal["targetDate"];
  sourceGraphNodeId?: Goal["sourceGraphNodeId"];
}

interface CreatePlanItemBody {
  title: string;
  description?: string;
  kind: PlanItem["kind"];
  sortOrder?: number;
  parentPlanItemId?: PlanItem["parentPlanItemId"];
  linkedSkillId?: PlanItem["linkedSkillId"];
  linkedGraphNodeId?: PlanItem["linkedGraphNodeId"];
  dueDate?: PlanItem["dueDate"];
}

interface AddEvidenceNoteBody {
  body: string;
  planItemId?: PlanItem["id"];
  attachments?: string[];
}

const planItemKinds = new Set<string>(PLAN_ITEM_KIND_VALUES);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function notFoundError(entityType: string, entityId: string) {
  return createDomainError(
    "NOT_FOUND",
    `${entityType} ${entityId} was not found.`,
    404
  );
}

function validationError(issues: ValidationIssue[]) {
  return createDomainError(
    "VALIDATION_FAILED",
    "Request validation failed.",
    422,
    false,
    {
      issues: issues.map((issue) => ({
        path: issue.path,
        rule: issue.rule,
        message: issue.message
      }))
    }
  );
}

function parseOptionalString(
  value: unknown,
  path: string,
  issues: ValidationIssue[]
) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({
      path,
      rule: "min",
      message: `${path} must be a non-empty string when provided.`
    });
    return undefined;
  }

  return value;
}

function parseCreateGoalBody(body: Record<string, unknown>): CreateGoalBody {
  const issues: ValidationIssue[] = [];

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    issues.push({
      path: "title",
      rule: "min",
      message: "Goal title is required."
    });
  }

  const description = parseOptionalString(body.description, "description", issues);
  const sourceGraphNodeId = parseOptionalString(
    body.sourceGraphNodeId,
    "sourceGraphNodeId",
    issues
  ) as Goal["sourceGraphNodeId"] | undefined;
  const targetDate = parseOptionalString(body.targetDate, "targetDate", issues);

  if (targetDate && !isoDatePattern.test(targetDate)) {
    issues.push({
      path: "targetDate",
      rule: "format",
      message: "targetDate must use YYYY-MM-DD."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    title: body.title as string,
    ...(description ? { description } : {}),
    ...(sourceGraphNodeId ? { sourceGraphNodeId } : {}),
    ...(targetDate ? { targetDate: targetDate as Goal["targetDate"] } : {})
  };
}

function parseCreatePlanItemBody(body: Record<string, unknown>): CreatePlanItemBody {
  const issues: ValidationIssue[] = [];

  if (typeof body.title !== "string" || body.title.trim().length === 0) {
    issues.push({
      path: "title",
      rule: "min",
      message: "Plan item title is required."
    });
  }

  if (typeof body.kind !== "string" || !planItemKinds.has(body.kind)) {
    issues.push({
      path: "kind",
      rule: "enum",
      message: "Plan item kind must be one of the supported planner kinds."
    });
  }

  if (
    body.sortOrder !== undefined &&
    (!Number.isInteger(body.sortOrder) || typeof body.sortOrder !== "number")
  ) {
    issues.push({
      path: "sortOrder",
      rule: "int",
      message: "sortOrder must be an integer when provided."
    });
  }

  const description = parseOptionalString(body.description, "description", issues);
  const parentPlanItemId = parseOptionalString(
    body.parentPlanItemId,
    "parentPlanItemId",
    issues
  ) as PlanItem["parentPlanItemId"] | undefined;
  const linkedSkillId = parseOptionalString(
    body.linkedSkillId,
    "linkedSkillId",
    issues
  ) as PlanItem["linkedSkillId"] | undefined;
  const linkedGraphNodeId = parseOptionalString(
    body.linkedGraphNodeId,
    "linkedGraphNodeId",
    issues
  ) as PlanItem["linkedGraphNodeId"] | undefined;
  const dueDate = parseOptionalString(body.dueDate, "dueDate", issues);

  if (dueDate && !isoDatePattern.test(dueDate)) {
    issues.push({
      path: "dueDate",
      rule: "format",
      message: "dueDate must use YYYY-MM-DD."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    title: body.title as string,
    kind: body.kind as PlanItem["kind"],
    ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {}),
    ...(description ? { description } : {}),
    ...(parentPlanItemId ? { parentPlanItemId } : {}),
    ...(linkedSkillId ? { linkedSkillId } : {}),
    ...(linkedGraphNodeId ? { linkedGraphNodeId } : {}),
    ...(dueDate ? { dueDate: dueDate as PlanItem["dueDate"] } : {})
  };
}

function parseAddEvidenceNoteBody(body: Record<string, unknown>): AddEvidenceNoteBody {
  const issues: ValidationIssue[] = [];

  if (typeof body.body !== "string" || body.body.trim().length === 0) {
    issues.push({
      path: "body",
      rule: "min",
      message: "Evidence note body is required."
    });
  }

  const planItemId = parseOptionalString(
    body.planItemId,
    "planItemId",
    issues
  ) as PlanItem["id"] | undefined;

  let attachments: string[] | undefined;

  if (body.attachments !== undefined) {
    if (!Array.isArray(body.attachments)) {
      issues.push({
        path: "attachments",
        rule: "type",
        message: "attachments must be an array of non-empty strings."
      });
    } else {
      attachments = [];

      for (const [index, value] of body.attachments.entries()) {
        if (typeof value !== "string" || value.trim().length === 0) {
          issues.push({
            path: `attachments.${index}`,
            rule: "min",
            message: "attachments entries must be non-empty strings."
          });
          continue;
        }

        attachments.push(value);
      }
    }
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    body: body.body as string,
    ...(planItemId ? { planItemId } : {}),
    ...(attachments ? { attachments } : {})
  };
}

export const plannerGoalRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/goals" ? {} : null),
    handle: ({ response, correlation }) => {
      json(response, 200, { goals: listGoals() }, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => (pathname === "/v1/goals" ? {} : null),
    handle: async ({ request, response, correlation }) => {
      const body = parseCreateGoalBody(await readBody(request));
      const goal = createGoal(body);

      json(response, 201, { goal }, correlation);
    }
  },
  {
    method: "GET",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/goals\/([^/]+)$/);
      const goalId = match?.[1];
      return goalId ? { goalId } : null;
    },
    handle: ({ response, params, correlation }) => {
      try {
        const goal = getGoal(params.goalId as Goal["id"]);
        json(response, 200, { goal }, correlation);
      } catch {
        errorResponse(
          response,
          notFoundError("Goal", params.goalId as string),
          correlation
        );
      }
    }
  },
  {
    method: "GET",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/goals\/([^/]+)\/plan$/);
      const goalId = match?.[1];
      return goalId ? { goalId } : null;
    },
    handle: ({ response, params, correlation }) => {
      try {
        const plan = listGoalPlan(params.goalId as Goal["id"]);
        json(response, 200, plan, correlation);
      } catch {
        errorResponse(
          response,
          notFoundError("Goal", params.goalId as string),
          correlation
        );
      }
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/goals\/([^/]+)\/items$/);
      const goalId = match?.[1];
      return goalId ? { goalId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseCreatePlanItemBody(await readBody(request));
      const planItem = createPlanItem(params.goalId as Goal["id"], body);

      json(response, 201, { planItem }, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/goals\/([^/]+)\/evidence-notes$/);
      const goalId = match?.[1];
      return goalId ? { goalId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseAddEvidenceNoteBody(await readBody(request));
      const evidenceNote = addEvidenceNote(params.goalId as Goal["id"], body);

      json(response, 201, { evidenceNote }, correlation);
    }
  }
] as const;
