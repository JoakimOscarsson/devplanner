import type {
  CanvasMode,
  GraphNode,
  GraphNodePosition,
  UserNodeCategory
} from "@pdp-helper/contracts-graph";
import { USER_NODE_CATEGORY_VALUES } from "@pdp-helper/contracts-graph";
import type { ValidationIssue } from "@pdp-helper/contracts-core";
import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { createDomainError, errorResponse, json, readBody } from "@pdp-helper/runtime-node";
import {
  createCanvas,
  createNode,
  deleteNode,
  getCanvasGraph,
  listCanvases,
  updateCanvas,
  updateNode
} from "../storage/in-memory.js";

interface CreateCanvasBody {
  name: string;
  mode?: CanvasMode;
  sortOrder?: number;
}

interface UpdateCanvasBody {
  name?: string;
  sortOrder?: number;
}

interface CreateNodeBody {
  label: string;
  category: UserNodeCategory;
  description?: string;
  parentNodeId?: GraphNode["id"];
  position?: GraphNodePosition;
}

interface UpdateNodeBody {
  label?: string;
  category?: UserNodeCategory;
  description?: string | null;
  parentNodeId?: GraphNode["id"] | null;
  position?: GraphNodePosition;
}

const userNodeCategories = new Set<string>(USER_NODE_CATEGORY_VALUES);

function notFoundError(entityType: string, entityId: string) {
  return createDomainError(
    "NOT_FOUND",
    `${entityType} ${entityId} was not found.`,
    404
  );
}

function validationError(issues: ValidationIssue[]) {
  const issueDetails = issues.map((issue) => ({
    path: issue.path,
    rule: issue.rule,
    message: issue.message
  }));

  return createDomainError(
    "VALIDATION_FAILED",
    "Request validation failed.",
    422,
    false,
    { issues: issueDetails }
  );
}

function parsePosition(
  value: unknown,
  path: string,
  required: boolean,
  issues: ValidationIssue[]
) {
  if (value === undefined) {
    if (required) {
      issues.push({
        path,
        rule: "required",
        message: "Position is required."
      });
    }

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

function parseCreateCanvasBody(body: Record<string, unknown>): CreateCanvasBody {
  const issues: ValidationIssue[] = [];

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    issues.push({
      path: "name",
      rule: "min",
      message: "Canvas name is required."
    });
  }

  if (body.mode !== undefined && body.mode !== "brainstorm") {
    issues.push({
      path: "mode",
      rule: "literal",
      message: "Only brainstorm canvases can be created through this route."
    });
  }

  if (
    body.sortOrder !== undefined &&
    (!Number.isInteger(body.sortOrder) || typeof body.sortOrder !== "number")
  ) {
    issues.push({
      path: "sortOrder",
      rule: "int",
      message: "sortOrder must be an integer."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    name: body.name as string,
    ...(body.mode ? { mode: body.mode as CanvasMode } : {}),
    ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {})
  };
}

function parseUpdateCanvasBody(body: Record<string, unknown>): UpdateCanvasBody {
  const issues: ValidationIssue[] = [];

  if (
    body.name !== undefined &&
    (typeof body.name !== "string" || body.name.trim().length === 0)
  ) {
    issues.push({
      path: "name",
      rule: "min",
      message: "Canvas name must be a non-empty string."
    });
  }

  if (
    body.sortOrder !== undefined &&
    (!Number.isInteger(body.sortOrder) || typeof body.sortOrder !== "number")
  ) {
    issues.push({
      path: "sortOrder",
      rule: "int",
      message: "sortOrder must be an integer."
    });
  }

  if (body.name === undefined && body.sortOrder === undefined) {
    issues.push({
      path: "$",
      rule: "required",
      message: "At least one canvas field must be provided."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.sortOrder === "number" ? { sortOrder: body.sortOrder } : {})
  };
}

function parseNodeCategory(
  value: unknown,
  path: string,
  required: boolean,
  issues: ValidationIssue[]
) {
  if (value === undefined) {
    if (required) {
      issues.push({
        path,
        rule: "required",
        message: "Node category is required."
      });
    }

    return undefined;
  }

  if (typeof value !== "string" || !userNodeCategories.has(value)) {
    issues.push({
      path,
      rule: "enum",
      message: "Node category must be one of the brainstorm user categories."
    });
    return undefined;
  }

  return value as UserNodeCategory;
}

function parseCreateNodeBody(body: Record<string, unknown>): CreateNodeBody {
  const issues: ValidationIssue[] = [];

  if (typeof body.label !== "string" || body.label.trim().length === 0) {
    issues.push({
      path: "label",
      rule: "min",
      message: "Node label is required."
    });
  }

  const category = parseNodeCategory(body.category, "category", true, issues);
  const position = parsePosition(body.position, "position", false, issues);

  if (
    body.description !== undefined &&
    (typeof body.description !== "string" || body.description.trim().length === 0)
  ) {
    issues.push({
      path: "description",
      rule: "min",
      message: "Description must be a non-empty string when provided."
    });
  }

  if (
    body.parentNodeId !== undefined &&
    body.parentNodeId !== null &&
    (typeof body.parentNodeId !== "string" || body.parentNodeId.trim().length === 0)
  ) {
    issues.push({
      path: "parentNodeId",
      rule: "min",
      message: "parentNodeId must be a non-empty string when provided."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    label: body.label as string,
    category: category!,
    ...(position ? { position } : {}),
    ...(typeof body.description === "string" ? { description: body.description } : {}),
    ...(typeof body.parentNodeId === "string"
      ? { parentNodeId: body.parentNodeId as GraphNode["id"] }
      : {})
  };
}

function parseUpdateNodeBody(body: Record<string, unknown>): UpdateNodeBody {
  const issues: ValidationIssue[] = [];
  const category = parseNodeCategory(body.category, "category", false, issues);
  const position = parsePosition(body.position, "position", false, issues);

  if (
    body.label !== undefined &&
    (typeof body.label !== "string" || body.label.trim().length === 0)
  ) {
    issues.push({
      path: "label",
      rule: "min",
      message: "Node label must be a non-empty string."
    });
  }

  if (
    body.description !== undefined &&
    body.description !== null &&
    (typeof body.description !== "string" || body.description.trim().length === 0)
  ) {
    issues.push({
      path: "description",
      rule: "min",
      message: "Description must be a non-empty string or null."
    });
  }

  if (
    body.parentNodeId !== undefined &&
    body.parentNodeId !== null &&
    (typeof body.parentNodeId !== "string" || body.parentNodeId.trim().length === 0)
  ) {
    issues.push({
      path: "parentNodeId",
      rule: "min",
      message: "parentNodeId must be a non-empty string or null."
    });
  }

  if (
    body.label === undefined &&
    body.category === undefined &&
    body.description === undefined &&
    body.position === undefined &&
    body.parentNodeId === undefined
  ) {
    issues.push({
      path: "$",
      rule: "required",
      message: "At least one node field must be provided."
    });
  }

  if (issues.length > 0) {
    throw validationError(issues);
  }

  return {
    ...(typeof body.label === "string" ? { label: body.label } : {}),
    ...(category ? { category } : {}),
    ...(body.description !== undefined ? { description: body.description as string | null } : {}),
    ...(body.parentNodeId !== undefined
      ? { parentNodeId: body.parentNodeId as GraphNode["id"] | null }
      : {}),
    ...(position ? { position } : {})
  };
}

export const graphCanvasRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/canvases" ? {} : null),
    handle: ({ response, correlation }) => {
      json(
        response,
        200,
        { canvases: listCanvases() },
        correlation
      );
    }
  },
  {
    method: "POST",
    match: (pathname) => (pathname === "/v1/canvases" ? {} : null),
    handle: async ({ request, response, correlation }) => {
      const body = parseCreateCanvasBody(await readBody(request));
      const canvas = createCanvas(body);

      json(response, 201, { canvas }, correlation);
    }
  },
  {
    method: "PATCH",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/canvases\/([^/]+)$/);
      const canvasId = match?.[1];
      return canvasId ? { canvasId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseUpdateCanvasBody(await readBody(request));
      const canvas = updateCanvas(params.canvasId as never, body);

      json(response, 200, { canvas }, correlation);
    }
  },
  {
    method: "GET",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/canvases\/([^/]+)\/graph$/);
      const canvasId = match?.[1];
      return canvasId ? { canvasId } : null;
    },
    handle: ({ response, params, correlation }) => {
      const graph = getCanvasGraph(params.canvasId as never);

      if (!graph) {
        errorResponse(
          response,
          notFoundError("Canvas", params.canvasId as string),
          correlation
        );
        return;
      }

      json(response, 200, graph, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/canvases\/([^/]+)\/nodes$/);
      const canvasId = match?.[1];
      return canvasId ? { canvasId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseCreateNodeBody(await readBody(request));
      const node = createNode(params.canvasId as never, body);

      json(response, 201, { node }, correlation);
    }
  },
  {
    method: "PATCH",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/canvases\/([^/]+)\/nodes\/([^/]+)$/);
      const canvasId = match?.[1];
      const nodeId = match?.[2];
      return canvasId && nodeId ? { canvasId, nodeId } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const body = parseUpdateNodeBody(await readBody(request));
      const node = updateNode(params.canvasId as never, params.nodeId as never, body);

      json(response, 200, { node }, correlation);
    }
  },
  {
    method: "DELETE",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/canvases\/([^/]+)\/nodes\/([^/]+)$/);
      const canvasId = match?.[1];
      const nodeId = match?.[2];
      return canvasId && nodeId ? { canvasId, nodeId } : null;
    },
    handle: ({ response, params, correlation }) => {
      const deleted = deleteNode(params.canvasId as never, params.nodeId as never);

      json(response, 200, deleted, correlation);
    }
  }
] as const;
