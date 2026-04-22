# MCP Service Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/mcp-service/src`.
- `@pdp-helper/contracts-*`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- HTTP client adapters for internal service APIs
- Storage only for MCP-owned policy and audit tables

## Forbidden Dependencies
- Source imports from sibling services or UI packages.
- Direct reads from graph, planner, tracker, recommendation, or gateway storage.
- Local copies of domain rules that can drift from domain services.
