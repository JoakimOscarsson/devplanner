# PDP Helper Milestones

## Purpose
This document tracks implementation milestones, substeps, dependencies, and clear definitions of done. Each substep is sized for agentic implementation and includes explicit ownership boundaries.

## Tracking Rules
- Treat this file as the authoritative delivery tracker for milestone and slice status.
- Mark an item as complete only when it is integrated on `main` and the latest GitHub Actions `CI` run on `main` is green.
- If implementation exists but is not yet integrated or the latest `main` CI run is not green, leave the item unchecked and note the blocker.
- When a slice is only partially complete, keep the parent substep unchecked and describe the completed portion in plain text.

## Current Status Snapshot
- Most recent confirmed green `main` CI before this tracker update: run `24783822191` for commit `309b4dd` on 2026-04-22.
- Current development baseline on `main`: architecture/contracts/platform/web foundation complete, plus integrated page-based demo flows for brainstorm mind-mapping, skill-tree promotion and duplicate handling, planner goal writes, tracker projections, and recommendations review.
- In-flight slice on the coordinator branch: brainstorm canvas interaction overhaul iteration 3, focused on visual-order reparenting, overlap-safe rendering, safer modal dismissal, lower-risk drag/pan behavior, and keyboard/control boundary cleanup. This remains untracked in the checkbox board until it is pushed to `main` and GitHub `CI` is green.

## Live Status Board

### Milestone 1: Architecture Locked
- [x] Gate docs authored
- [x] Shared convention review completed

### Milestone 2: Contracts Locked
- [x] Core conventions package finalized
- [x] Domain contract packages aligned
- [x] External recommendation and MCP audit contracts added

### Milestone 3: Platform Core
- [x] Dev-loop optimization and build avoidance
- [x] Shared runtime scaffolding
- [x] Gateway aggregation and proxy
- [x] Boundary enforcement and CI

### Milestone 4: Web Canvas Foundation
- [x] Shell split into stable module folders
- [x] Shared graph primitives

### Milestone 5: Graph Foundation
- [x] Demo slice: brainstorm tab lifecycle and node editing
- [x] Brainstorm quality pass: node editing and layout contracts
- [x] Demo slice: skill promotion and duplicate handling

### Milestone 6: Planning And Tracking
- [x] Demo slice: goal and plan-item writes
- [ ] Planner integration pass: visibility state relative to skill graph
- [x] Demo slice: tracker projections

### Milestone 7: Recommendations
- [x] Demo slice: provider health and run lifecycle
- [x] Demo slice: recommendation decision flow
- [ ] Integration pass: async downstream application model

### Milestone 8: External Agent Surface
- [ ] Demo slice: MCP tool catalog and scopes
- [ ] Demo slice: audit trail and policy enforcement

### Milestone 9: Resilience And Quality
- [x] Contract and dependency drift protection
- [ ] Failure-path and degradation validation

## Delivery Rhythm
- Prefer vertical slices that can be demoed through the web app at the end of each milestone.
- Shared-surface milestones may still be infrastructure-heavy, but each should expose a visible or callable demo checkpoint.
- Parallel work is encouraged only after the contract gate for that slice is stable.
- When parallel work is active, each agent should work on its own branch and return a branch-scoped slice for coordinator integration.
- If a milestone spans multiple demos, deliver the smallest demoable checkpoint first and treat the rest as follow-on substeps.
- Protect local iteration speed as a platform feature: avoid broad rebuilds and repeated dependency work in normal dev and demo loops whenever a narrower affected-only path is possible.

## Milestone 1: Architecture Locked
**Track:** `spec-foundation`

### Demo checkpoint
- The repo contains a complete, reviewable architectural baseline that agents can navigate without guessing.

### Substeps
1. Gate docs authored
Owner boundary: `docs/use-cases.md`, `docs/data-flows.md`, `docs/interface-catalog.md`, `docs/dependency-map.md`, `docs/milestones.md`
Contract gate: none
Acceptance test: shared-surface review checklist complete
Out of scope: service or UI implementation

2. Shared convention review completed
Owner boundary: same as above plus `packages/contracts-core/src`
Contract gate: `HTTP_ROUTE_PREFIXES`, `ID_PREFIXES`, `makeEventSubject`
Acceptance test: contract tests for route-prefix and event-subject conventions
Out of scope: domain behavior

### Definition of done
- All five gate documents exist.
- No route-prefix, id-prefix, or event-subject contradictions remain.
- Implementation can be delegated without open design decisions.

## Milestone 2: Contracts Locked
**Track:** `spec-foundation`
**Dependencies:** Milestone 1

### Demo checkpoint
- Contract tests demonstrate stable ids, routes, event subjects, and runtime schemas for every public domain boundary.

### Substeps
1. Core conventions package finalized
Owner boundary: `packages/contracts-core/src`, `tests/contracts`
Contract gate: none
Acceptance test: contract tests validate shared ids, error codes, route prefixes, and event-subject pattern
Out of scope: service routing

2. Domain contract packages aligned
Owner boundary: `packages/contracts-graph`, `packages/contracts-planner`, `packages/contracts-tracker`, `packages/contracts-recommendation`, `packages/contracts-mcp`
Contract gate: core conventions exported from `contracts-core`
Acceptance test: package build plus contract tests
Out of scope: service implementations

3. External recommendation and MCP audit contracts added
Owner boundary: `packages/contracts-recommendation`, `packages/contracts-mcp`
Contract gate: recommendation and MCP event subject exports
Acceptance test: contract examples and scope catalog stay valid
Out of scope: provider execution logic

### Definition of done
- Contract packages build and typecheck.
- Shared ids, route prefixes, and event subjects are runtime-checkable.
- Public contracts match `docs/interface-catalog.md`.

## Milestone 3: Platform Core
**Track:** `platform-core`
**Dependencies:** Milestone 1, Milestone 2

### Demo checkpoint
- `gateway` exposes health, capabilities, and working proxy routes so every later slice can be exercised end to end in local dev.

### Current priority
- Before further broad domain fan-out, prioritize faster dev and demo startup by eliminating unnecessary workspace-wide rebuilds and repeated install/build work in Docker and local service loops.

### Substeps
1. Dev-loop optimization and build avoidance
Owner boundary: root `package.json`, `docker-compose.yml`, workspace task docs, service/package `package.json` files, and any supporting platform scripts
Contract gate: existing package boundaries and service entrypoints stay unchanged
Acceptance test: a single-service restart does not trigger a full workspace install, service `dev:*` commands avoid broad root rebuilds where safe, and the documented demo boot flow is measurably shorter and narrower than the current baseline
Out of scope: changing domain contracts or feature behavior

2. Shared runtime scaffolding
Owner boundary: `packages/runtime-node`, `packages/runtime-web`
Contract gate: shared core schemas exported
Acceptance test: package build plus gateway/web smoke usage
Out of scope: domain rules

3. Gateway aggregation and proxy
Owner boundary: `services/gateway/src`, `services/gateway/ARCHITECTURE.md`, `services/gateway/INTERFACES.md`
Contract gate: service capability and health shapes available
Acceptance test: gateway health/capabilities routes plus proxy smoke test
Out of scope: downstream domain mutations

4. Boundary enforcement and CI
Owner boundary: `tools/check-dependencies.mjs`, root lint config, `.github/workflows/ci.yml`
Contract gate: dependency map stabilized
Acceptance test: `pnpm lint`, `pnpm test:deps`
Out of scope: feature UI work

### Definition of done
- Shared runtime packages are in place.
- The gateway proxies domain routes and reports capability metadata from services.
- Quality gates exist for lint, dependency drift, contracts, test, and build.
- Local and Docker-based dev flows avoid unnecessary workspace-wide rebuilds as the default path.

## Milestone 4: Web Canvas Foundation
**Track:** `web-canvas-foundation`
**Dependencies:** Milestone 2, Milestone 3

### Demo checkpoint
- The web shell renders capability state and a reusable graph canvas shell that later domain slices can plug into without rewriting layout and module composition.

### Substeps
1. Shell split into stable module folders
Owner boundary: `apps/web/src/shell`, `apps/web/src/lib`, `apps/web/src/modules/*`
Contract gate: `runtime-web` gateway client and capability hooks exist
Acceptance test: web build passes and module folders have local `AGENTS.md`
Out of scope: full feature behavior

2. Shared graph primitives
Owner boundary: `packages/ui-graph`, `packages/ui-shell`
Contract gate: graph contracts and service health shapes exported
Acceptance test: UI packages build and web shell renders graph preview and capability state
Out of scope: persistence

### Definition of done
- The web app builds through Vite.
- Shell and module folders are separated enough for parallel UI work.
- Shared UI packages remain free of service imports.

## Milestone 5: Graph Foundation
**Track:** `graph-domain`
**Dependencies:** Milestone 2, Milestone 3, Milestone 4

### Demo checkpoint
- A user can open the web app, switch between brainstorm canvases, create and edit nodes, and see the canvas update through the real gateway and graph service.

### Substeps
1. Demo slice: brainstorm tab lifecycle and node editing
Owner boundary: `services/graph-service/src/routes/canvases.ts`, graph domain/storage files, brainstorm UI folder
Contract gate: graph canvas routes and canvas events finalized
Acceptance test: graph-service route tests, brainstorm UI tests, and gateway proxy smoke test
Out of scope: promotion, duplicate resolution, and reference nodes

2. Brainstorm quality pass: node editing and layout contracts
Owner boundary: graph routes/domain plus `packages/ui-graph`
Contract gate: node and edge commands/queries finalized
Acceptance test: node mutation tests plus UI graph render tests
Out of scope: planner integration

3. Demo slice: skill promotion and duplicate handling
Owner boundary: graph routes/domain, skills UI folder
Contract gate: promotion command and duplicate-resolution contracts
Acceptance test: graph domain tests, skill-flow UI tests, and contract tests
Out of scope: recommendation decisions

### Definition of done
- Brainstorm tabs and skill graph flows work end to end.
- Duplicate collisions force explicit resolution.
- Graph-service remains the only owner of graph state.

## Milestone 6: Planning And Tracking
**Track:** `planner-domain`, `tracker-domain`
**Dependencies:** Milestone 2, Milestone 3, Milestone 4

### Demo checkpoint
- A user can create a goal from brainstorm content, break it into tasks or skills, and see tracker projections update in the UI.

### Substeps
1. Demo slice: goal and plan-item writes
Owner boundary: `services/planner-service/src`, planner UI folder
Contract gate: planner commands/queries/events finalized
Acceptance test: planner route tests, planner UI tests, and contract tests
Out of scope: tracker projections

2. Planner integration pass: visibility state relative to skill graph
Owner boundary: planner service plus graph integration docs
Contract gate: plan item visibility event finalized
Acceptance test: planner visibility tests
Out of scope: recommendation lifecycle

3. Demo slice: tracker projections
Owner boundary: `services/tracker-service/src`, tracker UI folder
Contract gate: planner event subjects finalized
Acceptance test: tracker projection tests, tracker UI tests, and rebuild smoke checks
Out of scope: planner writes

### Definition of done
- Goals can be created from brainstorm items or directly.
- Plan items support mixed skill, milestone, and task content.
- Tracker rebuilds remain event-driven and projection-only.

## Milestone 7: Recommendations
**Track:** `recommendation-domain`
**Dependencies:** Milestone 2, Milestone 3, Milestone 5, Milestone 6

### Demo checkpoint
- The user sees recommendation nodes or feed items in the UI, can accept or deny them, and can observe provider health and deferred-run behavior.

### Substeps
1. Demo slice: provider health and run lifecycle
Owner boundary: `services/recommendation-service/src`, recommendations UI folder
Contract gate: recommendation and provider-health events finalized
Acceptance test: recommendation route tests and UI feed tests
Out of scope: MCP tooling

2. Demo slice: recommendation decision flow
Owner boundary: recommendation service and UI folder
Contract gate: accepted/denied/deferred event contracts
Acceptance test: recommendation decision tests and UI decision-flow checks
Out of scope: direct domain mutation bypasses

3. Integration pass: async downstream application model
Owner boundary: recommendation docs/contracts and dependent service docs
Contract gate: accepted event finalized
Acceptance test: data-flow and contract verification
Out of scope: synchronous cross-service writes

### Definition of done
- Recommendation generation is asynchronous and auditable.
- Provider-down state creates deferred runs rather than backlog pileups.
- Accept and deny flows work through UI and service interfaces.

## Milestone 8: External Agent Surface
**Track:** `mcp-adapter`
**Dependencies:** Milestone 2, Milestone 3, Milestone 7

### Demo checkpoint
- An external client can list tools, read graph/planner state, and submit or decide recommendations through the scoped MCP surface.

### Substeps
1. Demo slice: MCP tool catalog and scopes
Owner boundary: `services/mcp-service/src`, `packages/contracts-mcp`
Contract gate: tool definitions and audit entry contract finalized
Acceptance test: MCP contract tests plus service route tests
Out of scope: planner or graph UI

2. Demo slice: audit trail and policy enforcement
Owner boundary: MCP service domain/storage/routes
Contract gate: MCP audit entry contract
Acceptance test: audit logging tests
Out of scope: provider recommendations

### Definition of done
- Each scope exposes only its allowed tool set.
- External read, recommend, and edit calls follow the same domain rules as internal clients.
- Audit entries are available for external tool activity.

## Milestone 9: Resilience And Quality
**Track:** `integration-quality`
**Dependencies:** Milestone 3 through Milestone 8

### Demo checkpoint
- Optional-service outages, degraded states, and drift protection are visible and testable instead of only being documented.

### Substeps
1. Contract and dependency drift protection
Owner boundary: `tests/contracts`, `tests/dependency-boundaries`, CI config
Contract gate: shared conventions locked
Acceptance test: `pnpm test:contracts`, `pnpm test:deps`
Out of scope: new product features

2. Failure-path and degradation validation
Owner boundary: `tests`, gateway docs, web shell module docs
Contract gate: optional-module capability reporting finalized
Acceptance test: service-down and provider-down test coverage
Out of scope: database hardening

## Recommended Iteration Order
1. Finish Milestone 5 substep 3 by implementing brainstorm-to-skill promotion on top of the already integrated duplicate-guidance flow.
2. Finish Milestone 6 substep 2 so planner visibility state and skill-graph integration are no longer split across partially complete slices.
3. Finish Milestone 7 substep 3 by making recommendation application fully asynchronous and downstream-safe.
4. Move into Milestone 8 once the domain flows exposed through MCP are already proven in the web and gateway paths.

### Definition of done
- Contract drift and forbidden imports fail quality gates.
- Optional service outages are surfaced explicitly and do not crash unrelated modules.
- The repo stays safe for parallel agent work across independent tracks.

## Recommended Iteration Order Details
1. Milestone 5 substep 3
Why: the duplicate-guidance foundation is already integrated, so promotion is the next clean graph-domain vertical slice.
2. Milestone 6 substep 2
Why: planner-to-skill visibility is the main remaining gap before planning and graph feel like one coherent user flow.
3. Milestone 7 substep 3
Why: recommendation review is already demoable, and async downstream application is the remaining resilience step.
4. Milestone 8
Why: the external agent surface should expose already-proven domain flows rather than forcing domain work to debug through MCP first.
5. Milestone 9 substep 2
Why: once the main domain slices are integrated, service-down and degradation validation becomes more representative and more valuable.
