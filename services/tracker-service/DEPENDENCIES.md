# Tracker Service Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/tracker-service/src`.
- `@pdp-helper/contracts-core`
- `@pdp-helper/contracts-tracker`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- Future tracker-owned projection adapters and event subscribers

## Forbidden Dependencies
- Source imports from sibling services or UI packages.
- Direct reads from planner, graph, recommendation, gateway, or MCP storage.
- Canonical write logic for plans, skills, canvases, or recommendations.
