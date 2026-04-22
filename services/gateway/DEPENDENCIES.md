# Gateway Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/gateway/src`.
- `@pdp-helper/contracts-*`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- Fetch-based client adapters for documented internal APIs

## Forbidden Dependencies
- Any source import from `services/*` outside this service.
- Any source import from `packages/ui-*`.
- Direct database access to domain-service schemas.
- Domain logic that belongs to graph, planner, tracker, recommendation, or MCP services.
