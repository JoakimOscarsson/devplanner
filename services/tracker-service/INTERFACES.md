# Tracker Service Interfaces

## HTTP routes
- `GET /health`
- `GET /v1/progress/overview`
- `GET /v1/progress/goals/:goalId`
- `GET /v1/progress/lag`

## Shared conventions
- Uses id prefixes from `@pdp-helper/contracts-core.ID_PREFIXES`
- Uses tracker event subjects from `@pdp-helper/contracts-tracker.TRACKER_EVENT_SUBJECTS`
- Consumes planner event subjects from `@pdp-helper/contracts-planner.PLANNER_EVENT_SUBJECTS`
