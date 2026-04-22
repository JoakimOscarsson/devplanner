# Graph Service Interfaces

## HTTP routes
- `GET /health`
- `GET /v1/canvases`
- `GET /v1/canvases/:canvasId/graph`
- `POST /v1/canvases`
- `PATCH /v1/canvases/:canvasId`
- `POST /v1/canvases/:canvasId/nodes`
- `PATCH /v1/canvases/:canvasId/nodes/:nodeId`
- `DELETE /v1/canvases/:canvasId/nodes/:nodeId`
- `POST /v1/skills/check-duplicate`
- `POST /v1/skills/promote`
- `POST /v1/skills/resolve-duplicate`
- `POST /v1/skills/:skillId/references`
- `POST /v1/skills/tree/nodes`
- `PATCH /v1/skills/tree/nodes/:nodeId`
- `POST /v1/skills/tree/nodes/:nodeId/reorder`
- `DELETE /v1/skills/tree/nodes/:nodeId`

## Shared conventions
- Uses id prefixes from `@pdp-helper/contracts-core.ID_PREFIXES`
- Uses route prefixes from `@pdp-helper/contracts-core.HTTP_ROUTE_PREFIXES`
- Uses graph event subjects from `@pdp-helper/contracts-graph.GRAPH_EVENT_SUBJECTS`
