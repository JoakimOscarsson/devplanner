# DEPENDENCIES

Allowed dependencies:
- `@pdp-helper/contracts-core`
- `@pdp-helper/contracts-graph`
- `@pdp-helper/contracts-planner`
- `@pdp-helper/contracts-recommendation`
- `typescript` for local build/typecheck only

Forbidden dependencies:
- Tracker contract package unless a future MCP tool explicitly needs tracker reads
- Any service implementation or UI package
