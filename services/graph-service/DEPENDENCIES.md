# Graph Service Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/graph-service/src`.
- `@pdp-helper/contracts-core`
- `@pdp-helper/contracts-graph`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- Future graph-owned persistence adapters and event clients

## Forbidden Dependencies
- Source imports from sibling services or UI packages.
- Direct reads from planner, tracker, recommendation, gateway, or MCP databases.
- Planner ownership concerns such as goals, plan items, evidence, or completion logic.
