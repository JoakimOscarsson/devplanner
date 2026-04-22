# Planner Service Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/planner-service/src`.
- `@pdp-helper/contracts-core`
- `@pdp-helper/contracts-planner`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- Future planner-owned persistence adapters and event clients

## Forbidden Dependencies
- Source imports from sibling services or UI packages.
- Direct reads from graph, tracker, recommendation, gateway, or MCP storage.
- Read-model ownership that belongs to the tracker service.
