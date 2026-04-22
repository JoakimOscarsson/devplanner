# MCP Service Spec

## Purpose
The MCP service is the boundary for external LLMs and automation clients. It exposes tools for reading data, submitting recommendations, and performing scoped writes according to API-key policies.

## Responsibilities
- Authenticate external callers and enforce `read-only`, `read+recommend`, and `read+edit` API-key profiles.
- Translate MCP tool calls into documented graph, planner, tracker, and recommendation service APIs.
- Expose service/tool capability metadata and health to clients.
- Keep external write flows auditable and policy constrained.

## Non-Goals
- Owning graph, planner, tracker, or recommendation persistence.
- Allowing direct storage-level access for external systems.
- Re-implementing domain rules locally.

## Owned Data
- `api_key_profile`
- `mcp_session_audit`
- `tool_invocation_audit`
