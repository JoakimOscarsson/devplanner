# PDP Helper Interface Catalog

## Purpose
This document defines the v1 public interfaces for HTTP, WebSocket, events, and MCP.

The authoritative conventions live in:
- `@pdp-helper/contracts-core` for ids, route prefixes, error envelopes, service health, and event-subject rules
- `@pdp-helper/contracts-*` for domain commands, queries, events, and MCP tool contracts

## Versioning Rules
- Gateway-visible HTTP routes use `/api/v1/...`.
- Service-internal HTTP routes use `/v1/...`.
- Event subjects use `pdp.v1.<domain>.<aggregate>.<past-tense-event>`.
- MCP tool definitions use `version: "v1"`.
- Breaking changes require a new versioned export in the relevant contract package.

## Identity And Scopes
- Interactive web use is single-owner in v1.
- External tools authenticate with API keys managed by `mcp-service`.
- Supported API key scopes:
  - `read-only`
  - `read+recommend`
  - `read+edit`
- Default external scope: `read+recommend`

## ID Formats
Use the prefixes exported by `@pdp-helper/contracts-core.ID_PREFIXES`.

| Entity | Prefix |
| --- | --- |
| Workspace | `wrk_` |
| Actor | `act_` |
| API key | `key_` |
| Canvas | `can_` |
| Node | `nod_` |
| Edge | `edg_` |
| Skill | `skl_` |
| Goal | `gol_` |
| Plan item | `pli_` |
| Evidence note | `env_` |
| Projection | `prj_` |
| Recommendation | `rec_` |
| Recommendation run | `rrn_` |
| Provider | `prv_` |
| Event | `evt_` |

## Common Error Model
Every non-2xx HTTP response returns:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable summary",
    "status": 422,
    "retryable": false,
    "details": {}
  }
}
```

Supported common error codes come from `@pdp-helper/contracts-core.COMMON_ERROR_CODE_VALUES`.

## Gateway HTTP Interfaces

### Platform routes
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Gateway health snapshot |
| `GET` | `/api/v1/capabilities` | Current module capability state for the web app |
| `GET` | `/api/v1/services/health` | Current downstream service health snapshots |

### Proxy routes
The gateway forwards the following public prefixes to downstream services by stripping the `/api` prefix:

| Public prefix | Downstream owner |
| --- | --- |
| `/api/v1/canvases` | `graph-service` |
| `/api/v1/skills` | `graph-service` |
| `/api/v1/goals` | `planner-service` |
| `/api/v1/progress` | `tracker-service` |
| `/api/v1/recommendations` | `recommendation-service` |
| `/api/v1/providers` | `recommendation-service` |
| `/api/v1/tools` | `mcp-service` |

## Service HTTP Interfaces

### Graph service
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health and capability metadata |
| `GET` | `/v1/canvases` | List canvases for the current workspace |
| `GET` | `/v1/canvases/:canvasId/graph` | Get nodes and edges for a canvas |
| `POST` | `/v1/canvases` | Create a brainstorm canvas |
| `PATCH` | `/v1/canvases/:canvasId` | Rename or reorder a canvas |
| `POST` | `/v1/canvases/:canvasId/nodes` | Create a node |
| `PATCH` | `/v1/canvases/:canvasId/nodes/:nodeId` | Update a node |
| `DELETE` | `/v1/canvases/:canvasId/nodes/:nodeId` | Delete a node |
| `POST` | `/v1/skills/check-duplicate` | Check for canonical skill collisions |
| `POST` | `/v1/skills/promote` | Promote a brainstorm node to a canonical skill |
| `POST` | `/v1/skills/resolve-duplicate` | Resolve a duplicate skill flow |
| `POST` | `/v1/skills/:skillId/references` | Create a skill reference node |

### Planner service
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health and capability metadata |
| `GET` | `/v1/goals` | List goals |
| `GET` | `/v1/goals/:goalId` | Get goal detail |
| `GET` | `/v1/goals/:goalId/plan` | Get goal plus plan items and evidence |
| `POST` | `/v1/goals` | Create a goal |
| `POST` | `/v1/goals/:goalId/items` | Create a plan item |
| `PATCH` | `/v1/goals/:goalId/items/:planItemId` | Update a plan item |
| `POST` | `/v1/goals/:goalId/evidence-notes` | Add evidence |

### Tracker service
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health and capability metadata |
| `GET` | `/v1/progress/overview` | Workspace progress overview |
| `GET` | `/v1/progress/goals/:goalId` | Goal projection |
| `GET` | `/v1/progress/lag` | Projection lag snapshot |

### Recommendation service
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health and capability metadata |
| `GET` | `/v1/providers/health` | Current provider health |
| `GET` | `/v1/recommendations` | Recommendation feed |
| `POST` | `/v1/recommendations/runs` | Request manual or scheduled recommendation run |
| `POST` | `/v1/recommendations/:recommendationId/accept` | Accept recommendation |
| `POST` | `/v1/recommendations/:recommendationId/deny` | Deny recommendation |

### MCP service
| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health and capability metadata |
| `GET` | `/v1/tools` | List supported MCP tool definitions |
| `POST` | `/v1/tools/:toolName` | HTTP adapter for MCP-like tool execution in local dev |

## WebSocket Interfaces
- `gateway` exposes a single WebSocket channel in v1 for capability changes and downstream domain updates.
- Initial topics:
  - `platform.capabilities.updated`
  - `platform.service-health.updated`
  - `graph.canvas.updated`
  - `graph.node.updated`
  - `planner.goal.updated`
  - `tracker.projection.updated`
  - `recommendation.feed.updated`

## Event Interfaces
Canonical event subjects are exported from the domain contract packages.

### Graph
- `pdp.v1.graph.category.created`
- `pdp.v1.graph.canvas.created`
- `pdp.v1.graph.canvas.updated`
- `pdp.v1.graph.canvas.deleted`
- `pdp.v1.graph.node.created`
- `pdp.v1.graph.node.updated`
- `pdp.v1.graph.node.deleted`
- `pdp.v1.graph.edge.created`
- `pdp.v1.graph.edge.deleted`
- `pdp.v1.skill.canonical.created`
- `pdp.v1.skill.reference.created`
- `pdp.v1.skill.duplicate.detected`

### Planner
- `pdp.v1.plan.goal.created`
- `pdp.v1.plan.goal.updated`
- `pdp.v1.plan.goal.completed`
- `pdp.v1.plan.item.created`
- `pdp.v1.plan.item.updated`
- `pdp.v1.plan.item.completed`
- `pdp.v1.plan.item.visibility.changed`
- `pdp.v1.plan.evidence.recorded`

### Tracker
- `pdp.v1.tracker.projection.updated`
- `pdp.v1.tracker.projection.rebuilt`
- `pdp.v1.tracker.projection.lag-detected`

### Recommendation
- `pdp.v1.provider.health.changed`
- `pdp.v1.recommendation.requested`
- `pdp.v1.recommendation.generated`
- `pdp.v1.recommendation.deferred`
- `pdp.v1.recommendation.accepted`
- `pdp.v1.recommendation.denied`

### MCP and platform
- `pdp.v1.mcp.tool.invoked`
- `pdp.v1.mcp.policy.denied`
- `pdp.v1.mcp.tool.completed`
- `pdp.v1.platform.service-health.changed`
- `pdp.v1.platform.capabilities.changed`

## MCP Tools
Tool definitions come from `@pdp-helper/contracts-mcp`.

| Tool | Minimum scope | Purpose |
| --- | --- | --- |
| `graph.list_canvases` | `read-only` | List brainstorm and skill canvases |
| `graph.get_canvas` | `read-only` | Get full canvas |
| `graph.get_canvas_subgraph` | `read-only` | Get bounded subgraph |
| `graph.get_skill_graph` | `read-only` | Get canonical skills and references |
| `graph.search_duplicate_skills` | `read-only` | Search duplicate skill candidates |
| `graph.create_node` | `read+edit` | Create graph node directly |
| `planner.list_goals` | `read-only` | List goals |
| `planner.get_goal` | `read-only` | Get goal |
| `planner.get_goal_plan` | `read-only` | Get plan detail |
| `planner.create_goal` | `read+edit` | Create goal |
| `planner.add_evidence_note` | `read+edit` | Attach evidence note |
| `recommendation.get_feed` | `read-only` | Read recommendation feed |
| `recommendation.get_provider_health` | `read-only` | Read provider health |
| `recommendation.submit` | `read+recommend` | Submit external recommendation |
| `recommendation.accept` | `read+recommend` | Accept recommendation |
| `recommendation.deny` | `read+recommend` | Deny recommendation |

## Sample Payloads

### Sample capability response
```json
{
  "capabilities": [
    {
      "capability": "brainstorm",
      "title": "Brainstorm",
      "route": "/brainstorm",
      "service": "graph-service",
      "version": "v1",
      "optional": false,
      "enabled": true,
      "status": "up",
      "description": "Capture ideas, certificates, courses, projects, and growth themes on multi-tab canvases."
    }
  ]
}
```

### Sample health response
```json
{
  "service": "graph-service",
  "status": "up",
  "checkedAt": "2026-04-22T08:00:00.000Z",
  "capabilities": [
    {
      "capability": "brainstorm",
      "title": "Brainstorm",
      "route": "/brainstorm",
      "service": "graph-service",
      "version": "v1",
      "optional": false
    }
  ]
}
```

### Sample recommendation decision response
```json
{
  "accepted": true,
  "decision": {
    "recommendationId": "rec_01JABCDEF0123456789ABCDE",
    "decision": "accepted",
    "decidedAt": "2026-04-22T08:15:00.000Z"
  }
}
```
