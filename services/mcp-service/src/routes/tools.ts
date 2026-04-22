import type { RouteDefinition } from "@pdp-helper/runtime-node";
import {
  createDomainError,
  errorResponse,
  json,
  readBody
} from "@pdp-helper/runtime-node";
import { MCP_TOOL_DEFINITIONS, type McpAuditEntry, type McpToolName } from "@pdp-helper/contracts-mcp";
import { mcpAuditLog } from "../storage/audit-log.js";

export const mcpToolRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/tools" ? {} : null),
    handle: ({ response, correlation }) => {
      json(response, 200, { tools: MCP_TOOL_DEFINITIONS }, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/tools\/(.+)$/);
      const toolName = match?.[1];
      return toolName ? { toolName: toolName as McpToolName } : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const tool = MCP_TOOL_DEFINITIONS.find((entry) => entry.name === params.toolName);

      if (!tool) {
        errorResponse(
          response,
          createDomainError(
            "NOT_FOUND",
            `MCP tool ${params.toolName} is not defined.`,
            404
          ),
          correlation
        );
        return;
      }

      const body = await readBody(request);
      const auditEntry: McpAuditEntry = {
        id: `mcp_audit_${Date.now()}`,
        toolName: tool.name,
        scope: tool.minimumScope,
        status: "completed",
        requestedAt: new Date().toISOString() as McpAuditEntry["requestedAt"],
        completedAt: new Date().toISOString() as McpAuditEntry["completedAt"],
        inputSummary:
          typeof body === "object" && body !== null
            ? (body as McpAuditEntry["inputSummary"])
            : undefined
      };
      mcpAuditLog.push(auditEntry);

      json(
        response,
        200,
        {
          tool: tool.name,
          version: tool.version,
          minimumScope: tool.minimumScope,
          accepted: true,
          input: body,
          note: "This is the bootstrap HTTP adapter. Domain tool execution will be wired in the implementation tracks."
        },
        correlation
      );
    }
  }
] as const;
