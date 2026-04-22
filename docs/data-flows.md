# PDP Helper Data Flows

## Purpose
This document defines the required command, query, event, and persistence flow for each major v1 scenario. It is intentionally aligned with [use-cases.md](/Users/joakim/Documents/codex/PDP-helper/docs/use-cases.md) and [interface-catalog.md](/Users/joakim/Documents/codex/PDP-helper/docs/interface-catalog.md).

## Data Ownership
| Module | Owns |
| --- | --- |
| `gateway` | owner web session, capability cache, public API composition |
| `graph-service` | categories, canvases, nodes, edges, canonical skills, skill references |
| `planner-service` | goals, plan items, evidence notes, plan-item visibility state |
| `tracker-service` | workspace and goal progress projections |
| `recommendation-service` | recommendation runs, recommendations, recommendation decisions, provider health |
| `mcp-service` | API keys, MCP tool audit log, external tool policy enforcement |
| `postgres` | one cluster, isolated per-service schema |
| `nats` | cross-service event transport and durable subscriptions |

## Event Envelope
Every emitted domain event uses this envelope before the domain-specific payload:

```json
{
  "event_id": "evt_01JABCDEF0123456789ABCDE",
  "event_type": "pdp.v1.graph.node.created",
  "event_version": 1,
  "workspace_id": "wrk_01JABCDEF0123456789ABCDE",
  "producer": "graph-service",
  "occurred_at": "2026-04-22T08:00:00.000Z",
  "actor": {
    "actor_type": "user",
    "actor_id": "usr_01JABCDEF0123456789ABCDE"
  },
  "correlation_id": "cor_01JABCDEF0123456789ABCDE",
  "causation_id": "cmd_01JABCDEF0123456789ABCDE",
  "payload": {}
}
```

## DF-01 Brainstorm Editing
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Graph as graph-service
    participant PG as Postgres(graph)
    participant NATS

    Owner->>Web: Create or edit brainstorm node
    Web->>Gateway: POST/PATCH /api/v1/canvases/:canvasId/nodes
    Gateway->>Graph: Forward graph command
    Graph->>PG: Persist node and child edge updates
    Graph-->>Gateway: Return committed node and layout
    Graph->>NATS: Publish graph.node.* and graph.edge.* events
    Gateway-->>Web: HTTP response
    NATS-->>Gateway: Deliver event for workspace channel
    Gateway-->>Web: WebSocket graph update
```

**Notes**
- Brainstorm commands are synchronous because the owner needs immediate edit confirmation.
- Layout is server-approved so the same canvas reads consistently across refreshes and external edits.
- Recommendation nodes are excluded from this flow; they are created only through DF-09 or DF-11.

## DF-02 Multiple Brainstorm Tabs
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Graph as graph-service
    participant PG as Postgres(graph)
    participant NATS

    Owner->>Web: Create, rename, reorder, or delete a tab
    Web->>Gateway: POST/PATCH/DELETE /api/v1/canvases
    Gateway->>Graph: Forward canvas command
    Graph->>PG: Persist brainstorm canvas record
    Graph-->>Gateway: Return updated tab metadata
    Graph->>NATS: Publish graph.canvas.* event
    Gateway-->>Web: HTTP response
    NATS-->>Gateway: Deliver graph.canvas.* update
    Gateway-->>Web: WebSocket tab refresh
```

**Notes**
- Only `kind=brainstorm` canvases can be created or deleted in v1.
- The Skill Graph canvas is created automatically for the workspace and is not part of the user-managed tab lifecycle.

## DF-03 Skill Promotion
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Graph as graph-service
    participant PG as Postgres(graph)
    participant NATS

    Owner->>Web: Promote brainstorm node to skill
    Web->>Gateway: POST /api/v1/skills/promote
    Gateway->>Graph: Promote source node
    Graph->>PG: Load source node and check normalized skill label
    alt No duplicate found
        Graph->>PG: Insert canonical Skill
        Graph->>PG: Insert canonical skill node on Skill Graph
        Graph-->>Gateway: Return skill and node ids
        Graph->>NATS: Publish pdp.v1.skill.canonical.created
        Graph->>NATS: Publish pdp.v1.graph.node.created
        Gateway-->>Web: Success response
    else Duplicate found
        Graph-->>Gateway: 409 SKILL_DUPLICATE_CANDIDATES
        Gateway-->>Web: Duplicate prompt payload
    end
```

**Notes**
- Promotion never removes the original brainstorm node.
- Duplicate checking uses the normalized skill label within the same workspace only.

## DF-04 Duplicate Skill Resolution
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Graph as graph-service
    participant PG as Postgres(graph)
    participant NATS

    Owner->>Web: Choose canonical skill and resolution action
    Web->>Gateway: POST /api/v1/skills/resolve-duplicate
    Gateway->>Graph: Submit resolution_token and outcome
    Graph->>PG: Validate token and selected canonical skill
    alt Use existing skill only
        Graph->>PG: Store source_ref link only
        Graph-->>Gateway: Return canonical skill link
    else Create reference node
        Graph->>PG: Insert SkillReference
        Graph->>PG: Insert skill_reference node
        Graph->>NATS: Publish pdp.v1.skill.reference.created
        Graph->>NATS: Publish pdp.v1.graph.node.created
        Graph-->>Gateway: Return canonical skill and reference node
    end
    Gateway-->>Web: Resolution result
```

**Notes**
- No event is emitted for the duplicate prompt itself because no domain state changes yet.
- The resolution token expires quickly and is never persisted to long-term domain tables.

## DF-05 Goal Creation
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Planner as planner-service
    participant PG as Postgres(planner)
    participant NATS
    participant Tracker as tracker-service
    participant TPG as Postgres(tracker)

    Owner->>Web: Create goal
    Web->>Gateway: POST /api/v1/goals
    Gateway->>Planner: Forward goal command
    Planner->>PG: Insert Goal with optional source_ref
    Planner-->>Gateway: Return Goal
    Planner->>NATS: Publish pdp.v1.plan.goal.created
    Gateway-->>Web: Success response
    opt tracker-service available
        NATS-->>Tracker: pdp.v1.plan.goal.created
        Tracker->>TPG: Create initial projection row
        Tracker->>NATS: Publish pdp.v1.tracker.projection.updated
    end
```

**Notes**
- Planner writes do not depend on tracker availability.
- `source_ref` is stored as a cross-service reference, not as a foreign key to another service’s table.

## DF-06 Plan Breakdown
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Planner as planner-service
    participant PG as Postgres(planner)
    participant NATS
    participant Tracker as tracker-service
    participant TPG as Postgres(tracker)

    Owner->>Web: Add or update goal breakdown items
    Web->>Gateway: POST/PATCH /api/v1/goals/:goalId/items
    Gateway->>Planner: Forward plan-item command
    Planner->>PG: Insert or update PlanItem rows
    Planner-->>Gateway: Return committed items
    Planner->>NATS: Publish pdp.v1.plan.item.created or pdp.v1.plan.item.updated
    Gateway-->>Web: Success response
    opt tracker-service available
        NATS-->>Tracker: Planner event
        Tracker->>TPG: Recompute affected goal and workspace projection
        Tracker->>NATS: Publish pdp.v1.tracker.projection.updated
    end
```

**Notes**
- Plan items can be `skill`, `milestone`, `task`, or `evidence`.
- Tracker projections are derived and can be rebuilt from planner events plus planner read repairs if needed.

## DF-07 Hide or Show a Plan Skill in the Skill Graph
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Planner as planner-service
    participant Graph as graph-service
    participant PPG as Postgres(planner)
    participant GPG as Postgres(graph)
    participant NATS

    Owner->>Web: Show or hide skill-type plan item in Skill Graph
    Web->>Gateway: POST visibility command
    Gateway->>Planner: GET current plan item
    Planner-->>Gateway: Return skill plan item
    alt Show in Skill Graph
        Gateway->>Graph: Create or resolve canonical skill and planner-linked reference node
        Graph->>GPG: Upsert canonical skill when needed
        Graph->>GPG: Insert planner-linked skill_reference node
        Graph-->>Gateway: Return linked_skill_id and reference_node_id
        Gateway->>Planner: PATCH visibility to linked
        Planner->>PPG: Persist linked visibility and ids
        Planner->>NATS: Publish pdp.v1.plan.item.visibility.changed
        Graph->>NATS: Publish pdp.v1.skill.canonical.created or pdp.v1.skill.reference.created
    else Hide from Skill Graph
        Gateway->>Graph: Archive planner-linked reference node
        Graph->>GPG: Mark node archived
        Graph->>NATS: Publish pdp.v1.graph.node.updated
        Gateway->>Planner: PATCH visibility to hidden
        Planner->>PPG: Persist hidden visibility
        Planner->>NATS: Publish pdp.v1.plan.item.visibility.changed
    end
    Gateway-->>Web: Success response
```

**Notes**
- The planner-linked reference node is disposable. The canonical skill is not deleted when a plan item is hidden.
- If duplicate resolution is needed during the show flow, control pauses and returns to the UI using the same conflict contract as skill promotion.
- Gateway owns the compensation step if graph creation succeeds but planner persistence fails.

## DF-08 Progress Updates and Tracker Reads
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Planner as planner-service
    participant PPG as Postgres(planner)
    participant NATS
    participant Tracker as tracker-service
    participant TPG as Postgres(tracker)

    Owner->>Web: Mark item in progress, done, blocked, or reopened
    Web->>Gateway: PATCH /api/v1/plan-items/:itemId
    Gateway->>Planner: Forward status change
    Planner->>PPG: Persist status and timestamps
    Planner-->>Gateway: Return committed item
    Planner->>NATS: Publish pdp.v1.plan.item.updated or pdp.v1.plan.item.completed
    Gateway-->>Web: Success response
    opt tracker-service available
        NATS-->>Tracker: Planner event
        Tracker->>TPG: Recompute progress projection
        Tracker->>NATS: Publish pdp.v1.tracker.projection.updated
        Web->>Gateway: GET /api/v1/progress/overview
        Gateway->>Tracker: Forward read query
        Tracker-->>Gateway: Return projection
        Gateway-->>Web: Tracker response
    end
```

**Notes**
- Planner is the write owner for progress state.
- Tracker is read-only and must never be called to mutate goals or plan items.

## DF-09 Recommendation Generation
```mermaid
sequenceDiagram
    participant Owner
    participant Web
    participant Gateway
    participant Rec as recommendation-service
    participant Graph as graph-service
    participant Planner as planner-service
    participant Tracker as tracker-service
    participant Ollama
    participant RPG as Postgres(recommendation)
    participant NATS

    Owner->>Web: Run recommendations now
    Web->>Gateway: POST /api/v1/recommendations/runs
    Gateway->>Rec: Forward run request
    Rec->>RPG: Insert run as requested
    Rec->>NATS: Publish pdp.v1.recommendation.requested
    Rec->>Graph: Query graph context
    Rec->>Planner: Query planner context
    opt tracker-service available
        Rec->>Tracker: Query tracker summary
    end
    Rec->>Ollama: POST /api/chat via Cloudflare tunnel
    Ollama-->>Rec: Suggested recommendations
    Rec->>RPG: Persist Recommendation rows
    Rec->>NATS: Publish pdp.v1.recommendation.generated for each recommendation
    NATS-->>Graph: pdp.v1.recommendation.generated
    Graph->>Graph: Create recommendation node on target canvas
    Graph->>NATS: Publish pdp.v1.graph.node.created
    Gateway-->>Web: Accepted run response
    NATS-->>Gateway: Deliver recommendation and graph updates
    Gateway-->>Web: WebSocket recommendation refresh
```

**Notes**
- Recommendations are first stored in `recommendation-service` and only then projected onto canvases as recommendation nodes.
- The Graph Service owns all node persistence, including recommendation nodes.

## DF-10 Accept or Deny a Recommendation
```mermaid
sequenceDiagram
    participant Actor as Owner or External LLM
    participant Entry as Gateway or MCP
    participant Rec as recommendation-service
    participant Domain as graph-service or planner-service
    participant RPG as Postgres(recommendation)
    participant NATS
    participant Graph as graph-service

    Actor->>Entry: Accept or deny recommendation
    Entry->>Rec: POST recommendation decision
    Rec->>RPG: Load recommendation and validate pending state
    alt Accept
        Rec->>Domain: Apply stored domain command
        Domain-->>Rec: Command success
        Rec->>RPG: Mark recommendation accepted
        Rec->>NATS: Publish pdp.v1.recommendation.accepted
    else Deny
        Rec->>RPG: Mark recommendation denied
        Rec->>NATS: Publish pdp.v1.recommendation.denied
    end
    NATS-->>Graph: Recommendation decision event
    Graph->>Graph: Mark recommendation node resolved
    Graph->>NATS: Publish pdp.v1.graph.node.updated
```

**Notes**
- A recommendation is authoritative only while still `pending`.
- If the stored command no longer validates, `recommendation-service` rejects accept with `RECOMMENDATION_STALE` and no decision event is emitted.

## DF-11 External MCP Read and Write
```mermaid
sequenceDiagram
    participant LLM as External LLM
    participant MCP as mcp-service
    participant Graph as graph-service
    participant Planner as planner-service
    participant Rec as recommendation-service
    participant Tracker as tracker-service
    participant MPG as Postgres(mcp)
    participant NATS

    LLM->>MCP: Tool call with API key
    MCP->>MPG: Validate key, scope, and workspace access
    alt Read tool
        MCP->>Graph: Read graph data when requested
        MCP->>Planner: Read planner data when requested
        opt tracker tool requested
            MCP->>Tracker: Read progress projection
        end
        MCP-->>LLM: Return normalized JSON
    else Recommend tool
        MCP->>Rec: Create recommendation
        Rec->>NATS: Publish pdp.v1.recommendation.generated
        MCP-->>LLM: Return recommendation id
    else Edit tool with read+edit scope
        MCP->>Graph: or Planner: Forward owning command
        Graph-->>MCP: or Planner-->>MCP: Return domain result
        MCP-->>LLM: Return committed entity
    end
```

**Notes**
- `read-only` keys can call only read tools.
- `read+recommend` keys can read and create or decide recommendations, but cannot directly mutate first-class domain entities.
- `read+edit` keys can call domain edit tools and will receive the same conflicts and validation errors as the web app.

## DF-12 Provider Down
```mermaid
sequenceDiagram
    participant Rec as recommendation-service
    participant Ollama
    participant RPG as Postgres(recommendation)
    participant NATS
    participant Gateway
    participant Web

    Rec->>Ollama: Health check or recommendation request
    Ollama--xRec: Timeout or non-2xx failure
    Rec->>RPG: Mark provider health down after threshold
    Rec->>NATS: Publish pdp.v1.provider.health.changed
    Web->>Gateway: Request recommendations
    Gateway->>Rec: Forward run request
    Rec->>RPG: Insert deferred run, no provider job enqueued
    Rec->>NATS: Publish pdp.v1.recommendation.deferred
    Rec-->>Gateway: Return deferred response
    Gateway-->>Web: Recommendations unavailable/deferred state
```

**Notes**
- While provider health is `down`, the system records demand but does not build a backlog of live jobs.
- The response to the caller is successful at the API layer but indicates `status=deferred`.

## DF-13 Provider Recovery
```mermaid
sequenceDiagram
    participant Rec as recommendation-service
    participant Ollama
    participant RPG as Postgres(recommendation)
    participant NATS

    Rec->>Ollama: Scheduled health check
    Ollama-->>Rec: Success
    Rec->>RPG: Mark provider health up
    Rec->>NATS: Publish pdp.v1.provider.health.changed
    Rec->>RPG: Load deferred runs grouped by workspace
    Rec->>RPG: Coalesce deferred runs into catch-up run requests
    Rec->>NATS: Publish pdp.v1.recommendation.requested
    Note over Rec: Catch-up processing then follows DF-09
```

**Notes**
- Recovery creates at most one catch-up run per workspace for the deferred window in v1.
- Failed catch-up runs return to deferred state instead of recursively enqueuing new jobs.

## Cross-Flow Consistency Rules
- All cross-service references use service-neutral `EntityRef` values rather than database foreign keys.
- A recommendation node is a projection of a `Recommendation` record, not the source of truth itself.
- Planner visibility changes and Skill Graph rendering must remain consistent through explicit ids stored on the plan item: `linked_skill_id` and `skill_graph_reference_node_id`.
- Capability status is queryable through the Gateway and pushed over WebSocket whenever `pdp.v1.platform.capabilities.changed` or `pdp.v1.provider.health.changed` changes user-visible availability.
