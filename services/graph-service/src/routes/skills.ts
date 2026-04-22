import type { ValidationIssue } from "@pdp-helper/contracts-core";
import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { createDomainError, json, readBody } from "@pdp-helper/runtime-node";
import {
  checkDuplicateSkill,
  getSkillInventory
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

export const graphSkillRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/skills" ? {} : null),
    handle: ({ response, correlation }) => {
      json(response, 200, getSkillInventory(), correlation);
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
  }
] as const;
