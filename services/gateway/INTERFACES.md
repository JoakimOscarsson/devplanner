# Gateway Interfaces

## Public routes
- `GET /health`
- `GET /api/v1/capabilities`
- `GET /api/v1/services/health`

## Proxy surface
- Forwards `/api/v1/canvases*` and `/api/v1/skills*` to `graph-service`
- Forwards `/api/v1/goals*` to `planner-service`
- Forwards `/api/v1/progress*` to `tracker-service`
- Forwards `/api/v1/recommendations*` and `/api/v1/providers*` to `recommendation-service`
- Forwards `/api/v1/tools*` to `mcp-service`

## Event references
- `PLATFORM_EVENT_SUBJECTS.serviceHealthChanged`
- `PLATFORM_EVENT_SUBJECTS.capabilitiesChanged`
