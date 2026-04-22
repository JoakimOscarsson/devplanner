# Recommendation Service Dependencies

## Allowed Compile-Time Imports
- Local source files under `services/recommendation-service/src`.
- `@pdp-helper/contracts-core`
- `@pdp-helper/contracts-recommendation`
- `@pdp-helper/runtime-node`

## Allowed Runtime Dependencies
- Shared runtime-node HTTP helpers
- Provider adapters such as Ollama or external recommendation-provider clients
- Future recommendation-owned persistence adapters and event clients

## Forbidden Dependencies
- Source imports from sibling services or UI packages.
- Direct reads from graph, planner, tracker, gateway, or MCP storage.
- Provider code that can mutate graph/planner data without going through service contracts.
