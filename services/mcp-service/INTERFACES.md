# MCP Service Interfaces

## HTTP routes
- `GET /health`
- `GET /v1/tools`
- `POST /v1/tools/:toolName`

## Shared conventions
- Uses MCP tool contracts from `@pdp-helper/contracts-mcp.MCP_TOOL_DEFINITIONS`
- Uses MCP event subjects from `@pdp-helper/contracts-mcp.MCP_EVENT_SUBJECTS`
- Uses `McpAuditEntry` from `@pdp-helper/contracts-mcp` for audit logging
