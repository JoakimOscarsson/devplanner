# Planner Service Interfaces

## HTTP routes
- `GET /health`
- `GET /v1/goals`
- `GET /v1/goals/:goalId`
- `GET /v1/goals/:goalId/plan`
- `POST /v1/goals`
- `POST /v1/goals/:goalId/items`
- `PATCH /v1/goals/:goalId/items/:planItemId`
- `POST /v1/goals/:goalId/evidence-notes`

## Shared conventions
- Uses id prefixes from `@pdp-helper/contracts-core.ID_PREFIXES`
- Uses planner event subjects from `@pdp-helper/contracts-planner.PLANNER_EVENT_SUBJECTS`
