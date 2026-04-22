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

## Skill-tree metadata behavior
- Skill-tree create and update payloads accept comma- or semicolon-separated tag strings and persist them as both a display `tag` string and a normalized `tags` array in node metadata.
- Sending `color: null` on `PATCH /v1/skills/tree/nodes/:nodeId` explicitly removes the stored color from the skill metadata.
- Duplicate create or rename attempts can return `409 SKILL_RESOLUTION_REQUIRED` with candidate matches in `details.candidates`, allowing the web UI to resolve or redirect instead of silently failing.
- `POST /v1/skills/tree/nodes` accepts an optional `duplicateResolution` object for exact-name conflicts. The current strategies are `create-reference-to-existing` and `replace-existing-canonical-with-reference`.
- Exact duplicate resolution can create a reference node at the requested tree location, or can move canonical ownership to the new node while converting the old canonical node into a reference and preserving the subtree under the new canonical node.
- Duplicate promotion attempts can return the same `SKILL_RESOLUTION_REQUIRED` error and must be resolved through `POST /v1/skills/resolve-duplicate` or by focusing an existing canonical skill.
- `POST /v1/skills/tree/nodes/:nodeId/reorder` is intended for within-level tree ordering and the current web UI hides or disables it when filtered views would make the persisted order ambiguous.

## Shared conventions
- Uses id prefixes from `@pdp-helper/contracts-core.ID_PREFIXES`
- Uses route prefixes from `@pdp-helper/contracts-core.HTTP_ROUTE_PREFIXES`
- Uses graph event subjects from `@pdp-helper/contracts-graph.GRAPH_EVENT_SUBJECTS`
