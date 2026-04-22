# PDP Helper

PDP Helper is a spec-first monorepo for a modular professional development app. The repository is organized to support parallel agent work, strict module boundaries, and a future path from single-owner use to multi-user scaling.

## Key docs
- `ARCHITECTURE.md`: top-level system structure and module boundaries
- `docs/agentic-workflow.md`: default TDD-first workflow and doc maintenance rules
- `docs/adr/*`: durable architectural decisions for future agents
- `docs/use-cases.md`: end-to-end scenarios
- `docs/data-flows.md`: command, query, event, and persistence flows
- `docs/interface-catalog.md`: public API, event, and MCP contracts
- `docs/dependency-map.md`: allowed dependency directions
- `docs/milestones.md`: implementation tracks and definitions of done

## Workspace layout
- `apps/web`: web client and module shell
- `services/*`: gateway, domain services, recommendation service, and MCP adapter
- `packages/contracts-*`: versioned shared interfaces and event contracts
- `packages/runtime-*`: shared runtime scaffolding for services and web modules
- `packages/ui-*`: reusable UI primitives
- `docs/*`: implementation gate, data flows, interfaces, dependencies, and milestones
- `tools/*`: validation and boundary scripts

## Quick start
1. `corepack enable`
2. `pnpm install`
3. `pnpm build`
4. `pnpm dev`

## Useful commands
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm test:deps`
- `pnpm format:check`
- `pnpm dev:web`
- `pnpm dev:gateway`
- `pnpm nx:graph`

## Runtime services
- `apps/web` runs the client shell
- `services/gateway` exposes the app-facing API surface and capability discovery
- `services/graph-service` owns brainstorm canvases and the skill graph
- `services/planner-service` owns goals, breakdown items, and evidence notes
- `services/tracker-service` owns read projections for progress and execution views
- `services/recommendation-service` owns provider health and recommendation flows
- `services/mcp-service` exposes an MCP adapter for external LLM tooling
