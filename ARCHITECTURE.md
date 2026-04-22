# PDP Helper Architecture

## System shape
- `apps/web` is the user-facing shell.
- `services/gateway` is the only backend entrypoint for the web app.
- `services/mcp-service` is the only external-agent entrypoint.
- Domain ownership is split across `graph-service`, `planner-service`, `tracker-service`, and `recommendation-service`.
- Shared contracts live in `packages/contracts-*`.
- Shared runtime scaffolding lives in `packages/runtime-node` and `packages/runtime-web`.
- Shared UI primitives live in `packages/ui-*`.
- Cross-service coordination happens through documented HTTP boundaries and NATS events.
- Persistence is one Postgres cluster in v1 with separate ownership per service schema.

## Architectural invariants
- No service may read another service's tables.
- `apps/web` must not import from `services/*`.
- `tracker-service` is projection-only and never becomes a write owner for planning state.
- Recommendation records are authoritative; recommendation nodes are graph projections.
- Gateway-visible routes use `/api/v1`; service-internal routes use `/v1`.
- Event-subject conventions live in `@pdp-helper/contracts-core.makeEventSubject`.
- Optional modules must degrade cleanly without crashing core graph or planner flows.

## Parallel implementation lanes
- `platform-core`: repo scaffolding, gateway, health, capability discovery, dependency enforcement
- `graph-domain`: brainstorm canvases, skill graph, promotion, duplicate handling, references
- `planner-domain`: goals, plan items, evidence notes, visibility rules
- `tracker-domain`: read models and progress projections
- `recommendation-domain`: provider health, runs, recommendation lifecycle
- `mcp-adapter`: external tool surface, API-key scopes, audit trail
- `web-canvas-foundation`: shell, graph UI primitives, module-level degraded states

## Delivery strategy
- Prefer demoable vertical slices over invisible horizontal completion.
- Freeze shared contracts first, then fan out work across services, shared packages, and web modules with disjoint write scopes.
- Each milestone should end with either a visible web flow or a directly callable integration surface that you can exercise locally.
- Treat dev-loop speed as enabling architecture, not polish: incremental builds, affected-only restarts, and Docker startup paths that avoid repeated full-workspace work should be prioritized before wider domain fan-out.

## Dev Loop Priority
- The default local and Docker demo path should avoid full workspace rebuilds when only one service or package changes.
- Root scripts may stay available for full verification, but normal per-service development should prefer narrow `tsx watch` or equivalent affected-only flows.
- Docker orchestration should install dependencies once per workspace state and then reuse them across service restarts.
- If Nx or another task runner is kept in the repo, it should eventually be wired to support affected-only builds instead of remaining informational only.

## Documentation upkeep
- Update this file whenever module boundaries, runtime topology, service ownership, or cross-module communication changes.
- Update the affected module `ARCHITECTURE.md` in the same change.
- If a change affects behavior contracts, also update `docs/interface-catalog.md`, `docs/data-flows.md`, and `docs/dependency-map.md`.
