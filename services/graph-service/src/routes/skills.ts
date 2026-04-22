import type {
  Canvas,
  DuplicateResolutionStrategy,
  GraphNode,
  GraphNodePosition,
  Skill
} from "@pdp-helper/contracts-graph";
import { DUPLICATE_RESOLUTION_STRATEGY_VALUES } from "@pdp-helper/contracts-graph";
import type { ValidationIssue } from "@pdp-helper/contracts-core";
import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { createDomainError, json, readBody } from "@pdp-helper/runtime-node";
import {
  checkDuplicateSkill,
  createSkillReference,
  getSkillInventorySnapshot,
  promoteNodeToSkill,
  resolveDuplicateSkill
} from "../storage/in-memory.js";

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

function parseDuplicateCheckBody(body: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];

  if (typeof body.label !== "string" || body.label.trim().length === 0) {
    issues.push({
      path: "label",
      rule: "min",
      message: "A non-empty skill label is required."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    label: body.label as string
  };
}

function parsePosition(value: unknown, path: string, issues: ValidationIssue[]) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object") {
    issues.push({
      path,
      rule: "type",
      message: "Position must be an object with numeric x and y values."
    });
    return undefined;
  }

  const x = (value as Record<string, unknown>).x;
  const y = (value as Record<string, unknown>).y;

  if (typeof x !== "number" || typeof y !== "number") {
    issues.push({
      path,
      rule: "type",
      message: "Position must include numeric x and y values."
    });
    return undefined;
  }

  return { x, y } satisfies GraphNodePosition;
}

function parsePromoteBody(body: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];

  if (typeof body.nodeId !== "string" || body.nodeId.trim().length === 0) {
    issues.push({
      path: "nodeId",
      rule: "min",
      message: "A non-empty source node id is required."
    });
  }

  if (
    typeof body.preferredSkillId !== "string" ||
    body.preferredSkillId.trim().length === 0
  ) {
    issues.push({
      path: "preferredSkillId",
      rule: "min",
      message: "A non-empty preferred skill id is required."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    nodeId: body.nodeId as GraphNode["id"],
    preferredSkillId: body.preferredSkillId as Skill["id"]
  };
}

function parseResolveDuplicateBody(body: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];
  const allowedStrategies = new Set<DuplicateResolutionStrategy>(
    DUPLICATE_RESOLUTION_STRATEGY_VALUES
  );

  if (typeof body.nodeId !== "string" || body.nodeId.trim().length === 0) {
    issues.push({
      path: "nodeId",
      rule: "min",
      message: "A non-empty source node id is required."
    });
  }

  if (
    typeof body.canonicalSkillId !== "string" ||
    body.canonicalSkillId.trim().length === 0
  ) {
    issues.push({
      path: "canonicalSkillId",
      rule: "min",
      message: "A non-empty canonical skill id is required."
    });
  }

  if (
    typeof body.strategy !== "string" ||
    !allowedStrategies.has(body.strategy as DuplicateResolutionStrategy) ||
    body.strategy === "create-new-canonical"
  ) {
    issues.push({
      path: "strategy",
      rule: "enum",
      message:
        "strategy must be either use-existing-canonical or create-reference-to-existing."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    nodeId: body.nodeId as GraphNode["id"],
    canonicalSkillId: body.canonicalSkillId as Skill["id"],
    strategy: body.strategy as "use-existing-canonical" | "create-reference-to-existing"
  };
}

function parseCreateReferenceBody(body: Record<string, unknown>) {
  const issues: ValidationIssue[] = [];
  const position = parsePosition(body.position, "position", issues);

  if (typeof body.canvasId !== "string" || body.canvasId.trim().length === 0) {
    issues.push({
      path: "canvasId",
      rule: "min",
      message: "A non-empty canvasId is required."
    });
  }

  if (typeof body.label !== "string" || body.label.trim().length === 0) {
    issues.push({
      path: "label",
      rule: "min",
      message: "A non-empty label is required."
    });
  }

  if (
    body.referenceNodeId !== undefined &&
    (typeof body.referenceNodeId !== "string" || body.referenceNodeId.trim().length === 0)
  ) {
    issues.push({
      path: "referenceNodeId",
      rule: "min",
      message: "referenceNodeId must be a non-empty string when provided."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    canvasId: body.canvasId as Canvas["id"],
    label: body.label as string,
    ...(position ? { position } : {}),
    ...(typeof body.referenceNodeId === "string"
      ? { referenceNodeId: body.referenceNodeId as GraphNode["id"] }
      : {})
  };
}

export const graphSkillRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/skills" ? {} : null),
    handle: ({ response, correlation }) => {
      json(response, 200, getSkillInventorySnapshot(), correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) =>
      pathname === "/v1/skills/check-duplicate" ? {} : null,
    handle: async ({ request, response, correlation }) => {
      const body = parseDuplicateCheckBody(await readBody(request));

      json(
        response,
        200,
        checkDuplicateSkill(body.label),
        correlation
      );
    }
  },
  {
    method: "POST",
    match: (pathname) => (pathname === "/v1/skills/promote" ? {} : null),
    handle: async ({ request, response, correlation }) => {
      const body = parsePromoteBody(await readBody(request));
      const result = promoteNodeToSkill(body.nodeId, body.preferredSkillId);

      json(response, 201, result, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) =>
      pathname === "/v1/skills/resolve-duplicate" ? {} : null,
    handle: async ({ request, response, correlation }) => {
      const body = parseResolveDuplicateBody(await readBody(request));
      const result = resolveDuplicateSkill(
        body.nodeId,
        body.canonicalSkillId,
        body.strategy
      );

      json(response, 201, result, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/skills\/([^/]+)\/references$/);
      const skillId = match?.[1];

      return skillId ? { skillId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseCreateReferenceBody(await readBody(request));
      const result = createSkillReference(params.skillId as Skill["id"], body);

      json(response, 201, result, correlation);
    }
  }
] as const;
