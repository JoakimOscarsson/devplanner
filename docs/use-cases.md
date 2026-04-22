# PDP Helper Use Cases

## Purpose
This document is the implementation-ready source of truth for user-facing and system-facing flows in PDP Helper v1.

The product scope covered here is:
- Web-first, private self-hosted deployment via `docker-compose`
- Single owner in v1, with future multi-user compatibility through `workspace_id` and `created_by` on persisted records
- Brainstorm canvases with multiple tabs and user-defined categories
- A separate Skill Graph with canonical skills and reference nodes
- A Planner module that is distinct from the Tracker module
- Recommendation nodes that can be accepted or denied
- A built-in recommendation engine that calls Ollama through a Cloudflare tunnel
- An MCP service for external LLM read, recommend, and edit access
- Graceful degradation when optional services are unavailable

## Actors
- `Owner`: the only interactive end user in v1
- `Gateway`: public HTTP and WebSocket API for the web app
- `Graph Service`: owns brainstorm categories, canvases, nodes, edges, canonical skills, and skill references
- `Planner Service`: owns goals, plan items, evidence notes, and visibility state relative to the Skill Graph
- `Tracker Service`: owns read-only progress projections
- `Recommendation Service`: owns recommendation runs, recommendation records, recommendation decisions, and provider health
- `MCP Service`: exposes external LLM tools with API-key scopes
- `External LLM`: an external client connected through MCP
- `Ollama Provider`: external model endpoint exposed over a Cloudflare tunnel

## Global Rules
- Every persisted record must include `workspace_id` and `created_by`.
- Each workspace has exactly one Skill Graph canvas in v1.
- A workspace can have many Brainstorm canvases; the UI presents them as tabs.
- Recommendation nodes are a reserved system node kind. The owner cannot create or categorize them directly.
- The Planner owns planning state. The Tracker never accepts write commands that change goals or plan items.
- Services never read each other’s database tables directly.
- `graph-service`, `planner-service`, `gateway`, `postgres`, and `nats` are required for core flows.
- `tracker-service`, `recommendation-service`, and `mcp-service` are optional. Their absence must not crash the web app.

## UC-01 Create, Rename, Reorder, and Delete Brainstorm Tabs
**Actor:** Owner

**Trigger:** The owner wants another brainstorming space or wants to reorganize existing tabs.

**Preconditions**
- The owner is authenticated in the web app.
- `graph-service` is available.
- The workspace exists.

**Happy path**
1. The owner opens the Brainstorm area.
2. The web app loads all `brainstorm` canvases for the workspace through the Gateway.
3. The owner creates a new tab with a title.
4. The Gateway forwards the request to `graph-service`.
5. `graph-service` creates a new `Canvas` with `kind=brainstorm`.
6. The new canvas is returned and shown as the active tab.
7. The owner may rename or reorder tabs.
8. Rename persists on the canvas record.
9. Reorder persists on the canvas `sort_order`.
10. The owner may delete a tab that is not the last remaining brainstorm tab.

**Alternate paths**
- If the owner opens Brainstorm and no brainstorm canvas exists yet, the system creates one default tab named `Inbox`.
- If a deleted tab was active, the next tab in sort order becomes active.

**Failure paths**
- If `graph-service` is unavailable, the Brainstorm shell stays mounted but the tab strip shows an unavailable state and a retry action.
- If the owner attempts to delete the last remaining brainstorm tab, the request is rejected with `VALIDATION_ERROR`.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/graph-service`

**Emitted events**
- `pdp.v1.graph.canvas.created`
- `pdp.v1.graph.canvas.updated`
- `pdp.v1.graph.canvas.deleted`

**Expected UI result**
- The tab strip updates immediately after each successful operation.
- Keyboard focus remains in the tab strip after create, rename, or reorder.

## UC-02 Create, Edit, Move, and Remove Brainstorm Nodes
**Actor:** Owner

**Trigger:** The owner is brainstorming skills, certificates, courses, projects, or other ideas on a specific Brainstorm tab.

**Preconditions**
- A Brainstorm canvas is open.
- Categories already exist or the owner can create them inline.

**Happy path**
1. The owner creates a workspace category such as `Skill`, `Certificate`, `Course`, or `Project`.
2. The owner inserts a node using mouse or keyboard.
3. The owner may create a child node or sibling node from the selected node.
4. The owner assigns a category to the node.
5. The owner edits the node title and optional notes.
6. The owner moves nodes by drag-and-drop or keyboard movement commands.
7. The web app sends node and edge mutations through the Gateway to `graph-service`.
8. `graph-service` persists nodes and `child` edges.
9. `graph-service` returns the updated canvas state, including server-accepted positions.
10. The layout engine keeps nodes readable and non-overlapping.
11. The owner may delete a node; descendant nodes are either deleted recursively or reparented according to the delete mode supplied by the UI.

**Alternate paths**
- If the owner creates a category inline during node creation, the category is persisted before the node mutation is applied.
- If the owner moves a subtree, all descendants receive updated computed positions.

**Failure paths**
- If the owner tries to assign a category to a recommendation node, the request is rejected with `FORBIDDEN`.
- If a requested delete mode would orphan nodes without a valid parent, the request is rejected with `VALIDATION_ERROR`.

**Touched modules**
- `apps/web`
- `packages/ui-graph`
- `services/gateway`
- `services/graph-service`

**Emitted events**
- `pdp.v1.graph.category.created`
- `pdp.v1.graph.node.created`
- `pdp.v1.graph.node.updated`
- `pdp.v1.graph.node.deleted`
- `pdp.v1.graph.edge.created`
- `pdp.v1.graph.edge.deleted`

**Expected UI result**
- Node creation and editing feel immediate through optimistic UI.
- Final layout comes from the server so multiple reads of the same canvas stay stable.

## UC-03 Promote a Brainstorm Node Into a Canonical Skill
**Actor:** Owner

**Trigger:** The owner decides that a brainstorm item should become a skill in the Skill Graph.

**Preconditions**
- The source node exists on a Brainstorm canvas.
- The owner has access to the Skill Graph capability.

**Happy path**
1. The owner selects a brainstorm node and chooses `Promote to Skill`.
2. The Gateway sends the promotion command to `graph-service`.
3. `graph-service` normalizes the source node title and checks for an existing canonical skill with the same normalized label in the workspace.
4. No duplicate is found.
5. `graph-service` creates a canonical `Skill`.
6. `graph-service` creates a canonical skill node on the Skill Graph canvas.
7. `graph-service` stores a back-reference from the skill to the source node in `source_refs`.
8. The owner is redirected to the Skill Graph or shown an in-place success action.

**Alternate paths**
- The owner may stay on the Brainstorm tab and continue editing after promotion.
- The owner may immediately create planner items from the new skill from the success menu.

**Failure paths**
- If duplicate candidates exist, the request returns `SKILL_DUPLICATE_CANDIDATES` and moves into UC-04.
- If the Skill Graph capability is unavailable, the command fails with `CAPABILITY_DISABLED`.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/graph-service`

**Emitted events**
- `pdp.v1.skill.canonical.created`
- `pdp.v1.graph.node.created`

**Expected UI result**
- The source brainstorm node remains in place.
- The Skill Graph shows a new canonical skill node with clear visual distinction from reference nodes.

## UC-04 Resolve a Duplicate Skill During Direct Create or Promotion
**Actor:** Owner

**Trigger:** A direct skill creation or promotion attempt matches an existing canonical skill.

**Preconditions**
- The owner has already attempted to create or promote a skill.
- `graph-service` has returned candidate matches and a short-lived `resolution_token`.

**Happy path**
1. The UI shows duplicate candidates with their labels and context.
2. The owner chooses one canonical skill to keep as the workspace source of truth.
3. The owner chooses one of two outcomes:
4. `Use existing skill only`, which links the source item to the existing canonical skill and creates no new skill node.
5. `Create reference node`, which links the source item to the existing canonical skill and creates a new reference node at the requested canvas position.
6. The Gateway submits the resolution decision with the `resolution_token`.
7. `graph-service` validates the token and applies the selected resolution.

**Alternate paths**
- The owner can cancel the resolution flow and keep the source node unchanged.
- If multiple candidates are returned, only one may be selected as canonical in v1.

**Failure paths**
- If the `resolution_token` expires, the UI must re-run the duplicate check.
- If the selected canonical skill was deleted between duplicate detection and resolution, the request fails with `CONFLICT`.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/graph-service`

**Emitted events**
- `pdp.v1.skill.reference.created` when a reference node is created
- No domain event is emitted when the owner cancels or when the request stops at a duplicate prompt

**Expected UI result**
- The UI makes it obvious which node is canonical and which node is only a reference.

## UC-05 Create a Manual Skill Reference Node
**Actor:** Owner

**Trigger:** The owner wants to show the same skill in another location in the Skill Graph without creating a duplicate canonical skill.

**Preconditions**
- The Skill Graph canvas exists.
- At least one canonical skill exists in the workspace.

**Happy path**
1. The owner chooses `Insert reference`.
2. The UI searches canonical skills by label.
3. The owner picks a canonical skill.
4. The owner places the new node in the Skill Graph.
5. The Gateway sends the command to `graph-service`.
6. `graph-service` creates a `SkillReference` and a `skill_reference` node on the Skill Graph canvas.
7. The Skill Graph renders the reference with a visual badge showing that it is not canonical.

**Alternate paths**
- The owner may start from a canonical skill node and choose `Create reference here`.

**Failure paths**
- If the target skill no longer exists, the request fails with `NOT_FOUND`.
- If the owner attempts this while `graph-service` is unavailable, the Skill Graph remains visible but the insert action is disabled until retry succeeds.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/graph-service`

**Emitted events**
- `pdp.v1.skill.reference.created`
- `pdp.v1.graph.node.created`

**Expected UI result**
- The new reference node is visible immediately and links back to the canonical skill detail panel.

## UC-06 Create a Goal From a Brainstorm Item or Directly
**Actor:** Owner

**Trigger:** The owner decides to turn an idea into a tracked development goal.

**Preconditions**
- `planner-service` is available.
- The source item may be a brainstorm node, a skill, or nothing if the goal is created from scratch.

**Happy path**
1. The owner chooses `Create goal` from a brainstorm node, a skill node, or the Planner landing page.
2. The Gateway sends the create command to `planner-service`.
3. `planner-service` creates the `Goal`, storing any supplied `source_ref`.
4. `planner-service` emits a goal-created event.
5. `tracker-service`, if available, consumes the event and creates an initial projection.
6. The UI navigates to the new goal detail page.

**Alternate paths**
- If created from a source node, the source panel shows a backlink to the goal.
- If `tracker-service` is unavailable, the goal still exists and the planner view still works.

**Failure paths**
- If `planner-service` is unavailable, the Planner area shows an unavailable state and the command does not partially execute.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/planner-service`
- `services/tracker-service` when available

**Emitted events**
- `pdp.v1.plan.goal.created`
- `pdp.v1.tracker.projection.updated` when tracker is available

**Expected UI result**
- The goal opens in the Planner and is editable immediately.

## UC-07 Break a Goal Into Mixed Plan Items
**Actor:** Owner

**Trigger:** The owner wants to decompose a goal into skills, milestones, tasks, and evidence notes.

**Preconditions**
- A goal exists.
- `planner-service` is available.

**Happy path**
1. The owner opens a goal detail page.
2. The owner adds one or more plan items of kinds `skill`, `milestone`, `task`, or `evidence`.
3. The owner may nest items under milestones in the allowed hierarchy.
4. The Gateway sends create and update commands to `planner-service`.
5. `planner-service` persists the items and emits events.
6. `tracker-service`, if available, updates the read projection.

**Alternate paths**
- A `skill` plan item may be created from scratch or linked to an existing canonical skill.
- An `evidence` item may be attached to a goal or to a specific task or milestone.

**Failure paths**
- If the owner attempts an invalid hierarchy, such as a goal as a child of a task, `planner-service` rejects the request with `VALIDATION_ERROR`.
- If `tracker-service` is down, tracker summaries stop updating, but planning commands still succeed.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/planner-service`
- `services/tracker-service` when available

**Emitted events**
- `pdp.v1.plan.item.created`
- `pdp.v1.plan.item.updated`
- `pdp.v1.tracker.projection.updated` when tracker is available

**Expected UI result**
- The Planner shows the new structure immediately.
- The Tracker refreshes asynchronously when available.

## UC-08 Show or Hide a Skill-Type Plan Item in the Skill Graph
**Actor:** Owner

**Trigger:** The owner wants a planned skill to appear in the Skill Graph, or wants to hide its planner-linked reference without deleting the plan item.

**Preconditions**
- The plan item exists and has `kind=skill`.
- The Skill Graph capability is available.

**Happy path for show**
1. The owner chooses `Show in Skill Graph` on a skill-type plan item.
2. The Gateway loads the plan item from `planner-service`.
3. If the plan item is already linked to a canonical skill, the Gateway asks `graph-service` to create a planner-linked reference node.
4. If the plan item is not linked, the Gateway asks `graph-service` to create or resolve the canonical skill first.
5. Duplicate conflicts follow UC-04.
6. `graph-service` returns the canonical skill id and the new planner-linked reference node id.
7. The Gateway updates the plan item in `planner-service` with `skill_graph_visibility=linked`, `linked_skill_id`, and `skill_graph_reference_node_id`.

**Happy path for hide**
1. The owner chooses `Hide from Skill Graph`.
2. The Gateway asks `graph-service` to archive the planner-linked reference node.
3. The Gateway updates `planner-service` with `skill_graph_visibility=hidden`.
4. The canonical skill remains intact.

**Alternate paths**
- If the plan item already has `skill_graph_visibility=linked`, the show command is a no-op.
- If the plan item was hidden and still has a valid `linked_skill_id`, showing it again creates a fresh planner-linked reference node rather than reusing the archived node.

**Failure paths**
- If duplicate resolution is required and the owner cancels it, the plan item remains unchanged.
- If `graph-service` succeeds but the planner update fails, the Gateway compensates by archiving the newly created planner-linked reference node before returning an error.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/graph-service`
- `services/planner-service`

**Emitted events**
- `pdp.v1.skill.reference.created`
- `pdp.v1.graph.node.updated`
- `pdp.v1.plan.item.visibility.changed`

**Expected UI result**
- Planner visibility changes never delete the plan item.
- The Skill Graph only shows the planner-linked reference when visibility is `linked`.

## UC-09 Update Progress and Review Tracker Projections
**Actor:** Owner

**Trigger:** The owner completes or reopens work and wants to review progress.

**Preconditions**
- A goal with plan items exists.

**Happy path**
1. The owner marks a plan item as `in_progress`, `done`, `blocked`, or `not_started`.
2. The Gateway sends the change to `planner-service`.
3. `planner-service` persists the new state and emits an item-updated or item-completed event.
4. `tracker-service`, if available, consumes planner events and rebuilds the affected goal and workspace projections.
5. The owner opens the Tracker view.
6. The Gateway queries `tracker-service` for summaries and per-goal progress.

**Alternate paths**
- The owner may attach an evidence note when marking an item as done.
- The owner may reopen a completed item, which reduces completion percentages in the Tracker after the projection catches up.

**Failure paths**
- If `tracker-service` is unavailable, Planner writes still succeed and the Tracker route shows `Temporarily unavailable`.
- If event delivery is delayed, the Planner detail remains correct and the Tracker may temporarily lag behind.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/planner-service`
- `services/tracker-service` when available

**Emitted events**
- `pdp.v1.plan.item.updated`
- `pdp.v1.plan.item.completed`
- `pdp.v1.tracker.projection.updated`

**Expected UI result**
- The Planner always reflects the latest committed state.
- The Tracker is explicitly read-only and never exposes write controls that would mutate plan state.

## UC-10 Generate Recommendations From the Built-In Engine
**Actors:** Owner, Recommendation Service, Ollama Provider

**Trigger:** The owner manually asks for recommendations, or the Recommendation Service schedules a proactive run.

**Preconditions**
- `recommendation-service` is available.
- The workspace has enough graph or planner context for the engine to analyze.
- Provider health is `up`.

**Happy path**
1. A recommendation run is requested manually or by the scheduler.
2. `recommendation-service` loads the needed workspace context from `graph-service`, `planner-service`, and `tracker-service` when available.
3. `recommendation-service` calls Ollama through the configured Cloudflare tunnel.
4. Ollama returns proposed suggestions.
5. `recommendation-service` persists the run and one `Recommendation` record per suggestion.
6. `recommendation-service` emits `pdp.v1.recommendation.generated` for each accepted record.
7. `graph-service` consumes those events and creates recommendation nodes on the target canvas.
8. The UI receives updates over WebSocket and renders the recommendation nodes with accept and deny actions.

**Alternate paths**
- If `tracker-service` is unavailable, the recommendation run still proceeds using graph and planner context only.
- A recommendation may target Brainstorm, Skill Graph, or Planner, but its visual node always lives on a graph canvas.

**Failure paths**
- If provider health is not `up`, the request follows UC-15 instead of calling Ollama.
- If Ollama returns malformed output, the run is recorded as failed and no recommendation nodes are created.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/recommendation-service`
- `services/graph-service`
- `services/planner-service`
- `services/tracker-service` when available
- External Ollama endpoint

**Emitted events**
- `pdp.v1.recommendation.requested`
- `pdp.v1.recommendation.generated`
- `pdp.v1.graph.node.created`

**Expected UI result**
- Recommendation nodes are visually distinct from owner-created nodes and cannot be recategorized.

## UC-11 Accept or Deny a Recommendation Node
**Actors:** Owner or External LLM, Recommendation Service

**Trigger:** A pending recommendation node is reviewed.

**Preconditions**
- The recommendation exists and is still `pending`.
- `recommendation-service` is available.

**Happy path for accept**
1. The owner or an authorized external tool chooses `Accept`.
2. The Gateway or MCP Service sends the decision to `recommendation-service`.
3. `recommendation-service` validates that the recommendation is still pending and not stale.
4. `recommendation-service` applies the underlying domain command to `graph-service` or `planner-service`.
5. On success, `recommendation-service` marks the recommendation `accepted`.
6. `recommendation-service` emits `pdp.v1.recommendation.accepted`.
7. `graph-service` consumes the event and marks the recommendation node resolved.

**Happy path for deny**
1. The owner or an authorized external tool chooses `Deny`.
2. `recommendation-service` marks the recommendation `denied`.
3. `recommendation-service` emits `pdp.v1.recommendation.denied`.
4. `graph-service` marks the recommendation node resolved without applying the proposed change.

**Alternate paths**
- The applied domain command may create a new brainstorm node, a planner item, a canonical skill, or a skill reference depending on the recommendation payload.

**Failure paths**
- If the proposed change no longer validates, such as a duplicate-skill conflict appearing after the recommendation was generated, the accept request fails with `RECOMMENDATION_STALE`.
- If `graph-service` is unavailable when the node-resolution event is consumed, the recommendation remains accepted or denied logically and the node is resolved on retry.

**Touched modules**
- `apps/web`
- `services/gateway`
- `services/recommendation-service`
- `services/graph-service`
- `services/planner-service`
- `services/mcp-service` when the actor is external

**Emitted events**
- `pdp.v1.recommendation.accepted`
- `pdp.v1.recommendation.denied`
- Domain events from the applied command, when accept succeeds

**Expected UI result**
- Accepted and denied recommendation nodes remain auditable but no longer present pending actions.

## UC-12 External LLM Reads Workspace Data Through MCP
**Actors:** External LLM, MCP Service

**Trigger:** An external client with a `read-only`, `read+recommend`, or `read+edit` API key wants to inspect workspace data.

**Preconditions**
- `mcp-service` is available.
- The API key is active and scoped to the target workspace.

**Happy path**
1. The external client connects to the MCP Service.
2. The client calls tools such as `workspace.get_overview`, `brainstorm.list_tabs`, `brainstorm.get_canvas`, `skills.search`, `plans.list_goals`, or `tracker.get_summary`.
3. `mcp-service` authenticates the API key and checks its scope.
4. `mcp-service` reads the required data from owner services through documented APIs.
5. The tool response returns normalized JSON objects only.

**Alternate paths**
- If `tracker-service` is unavailable, tracker read tools return `CAPABILITY_DISABLED` while graph and planner reads continue to work.

**Failure paths**
- If the API key does not authorize the workspace, the request fails with `FORBIDDEN`.
- If `mcp-service` is unavailable, the rest of the product continues functioning without external access.

**Touched modules**
- `services/mcp-service`
- `services/graph-service`
- `services/planner-service`
- `services/tracker-service` when available

**Emitted events**
- None

**Expected UI result**
- No direct UI change is required unless the owner is monitoring API key activity.

## UC-13 External LLM Submits Recommendations Through MCP
**Actors:** External LLM, MCP Service

**Trigger:** An external tool with `read+recommend` or `read+edit` scope wants to add a suggestion without directly mutating domain data.

**Preconditions**
- The API key has at least `read+recommend`.
- `recommendation-service` and `graph-service` are available.

**Happy path**
1. The external client calls a recommendation tool such as `recommendations.propose_node` or `recommendations.propose_plan_item`.
2. `mcp-service` validates the key scope.
3. `mcp-service` forwards the proposal to `recommendation-service`.
4. `recommendation-service` persists a pending recommendation and emits `pdp.v1.recommendation.generated`.
5. `graph-service` creates the corresponding recommendation node.
6. The owner sees the recommendation in the UI and can accept or deny it later.

**Alternate paths**
- The external client may also deny or accept an existing recommendation if the key scope allows recommendation actions.

**Failure paths**
- If the proposal targets an unavailable capability, the request fails with `CAPABILITY_DISABLED`.
- If the API key has `read-only`, the request fails with `FORBIDDEN`.

**Touched modules**
- `services/mcp-service`
- `services/recommendation-service`
- `services/graph-service`

**Emitted events**
- `pdp.v1.recommendation.generated`
- `pdp.v1.graph.node.created`

**Expected UI result**
- Externally submitted recommendations are visually identical to built-in recommendations except for provenance metadata.

## UC-14 External LLM Directly Edits Domain Data Through MCP
**Actors:** External LLM, MCP Service

**Trigger:** An external client with `read+edit` scope wants to create or update first-class graph or planner entities.

**Preconditions**
- The API key has `read+edit`.
- The target module is available.

**Happy path**
1. The external client calls an edit tool such as `brainstorm.create_node`, `skills.create_reference`, or `plans.create_goal`.
2. `mcp-service` validates scope and payload.
3. `mcp-service` forwards the command to the owning service.
4. The owning service applies domain rules exactly as it would for the web app.
5. Domain events are emitted.
6. The web app receives the same updates over the Gateway WebSocket channel.

**Alternate paths**
- Duplicate-skill conflicts return the same `SKILL_DUPLICATE_CANDIDATES` contract used by the web app.
- An external edit tool may choose to fall back to a recommendation tool instead of resolving a conflict directly.

**Failure paths**
- If the external client tries to create a recommendation node directly through an edit tool, the request fails with `FORBIDDEN`; recommendation nodes can only be created through the recommendation flow.
- If the API key has only `read+recommend`, edit tools fail with `FORBIDDEN`.

**Touched modules**
- `services/mcp-service`
- Owning domain service for the tool
- `services/gateway` indirectly through downstream UI updates

**Emitted events**
- The same domain events emitted for equivalent web mutations

**Expected UI result**
- The owner sees external edits appear as ordinary domain changes with provenance metadata available in the detail panel.

## UC-15 Handle Recommendation Provider Outage and Recovery
**Actors:** Recommendation Service, Ollama Provider, Owner

**Trigger:** Ollama is unavailable or later becomes reachable again.

**Preconditions**
- `recommendation-service` is running.
- Provider health checks are enabled.

**Happy path when provider goes down**
1. Health checks or request failures mark provider health as `down`.
2. `recommendation-service` emits `pdp.v1.provider.health.changed`.
3. New manual or proactive recommendation requests are persisted as deferred runs.
4. `recommendation-service` emits `pdp.v1.recommendation.deferred`.
5. No work is queued against Ollama while the provider is down.
6. The UI shows `Recommendations temporarily unavailable`.

**Happy path when provider recovers**
1. A successful health check marks the provider `up`.
2. `recommendation-service` emits `pdp.v1.provider.health.changed`.
3. Deferred runs are coalesced per workspace into catch-up runs.
4. Catch-up runs follow UC-10.

**Alternate paths**
- If no deferred runs exist at recovery time, only the health state changes.

**Failure paths**
- If recovery fails mid-run, the run is marked failed and the remaining work is deferred again instead of piling up duplicate jobs.

**Touched modules**
- `services/recommendation-service`
- External Ollama endpoint
- `apps/web`
- `services/gateway`

**Emitted events**
- `pdp.v1.provider.health.changed`
- `pdp.v1.recommendation.deferred`
- `pdp.v1.recommendation.requested` after recovery

**Expected UI result**
- The owner always sees whether recommendations are unavailable, deferred, or current.

## UC-16 Graceful Degradation When Optional Services Are Down
**Actor:** Owner

**Trigger:** `tracker-service`, `recommendation-service`, or `mcp-service` is unavailable.

**Preconditions**
- `gateway` can still start and serve capability status.

**Happy path**
1. The Gateway polls or caches service capability state.
2. The web app loads `/api/v1/capabilities` on startup.
3. Any unavailable optional capability is rendered as disabled, hidden, or marked unavailable.
4. Core graph and planner flows continue if their services are healthy.

**Alternate paths**
- If an optional service recovers, the WebSocket channel publishes a capability update and the UI enables the feature without a full reload.

**Failure paths**
- If a required core service is down, the app shell still renders but the affected area shows an explicit unavailable state instead of crashing.

**Touched modules**
- `apps/web`
- `services/gateway`
- Optional service that is down

**Emitted events**
- `pdp.v1.platform.capabilities.changed`

**Expected UI result**
- Missing optional modules never break navigation, login, or core graph/planner editing.
