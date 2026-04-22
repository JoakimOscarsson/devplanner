# PDP Helper Agent Guide

## Read this first
- Read `./ARCHITECTURE.md` before making structural changes.
- Read `./docs/agentic-workflow.md` for the default implementation protocol.
- Read `./docs/dependency-map.md` before widening dependencies.
- Read `./docs/interface-catalog.md` and `./docs/data-flows.md` before changing public APIs, events, or cross-module behavior.
- Read the nearest local `AGENTS.md`, `ARCHITECTURE.md`, `SPEC.md`, `INTERFACES.md`, and `DEPENDENCIES.md` for the module you are editing.

## Core principles
- Treat this repo as a spec-first, module-first monorepo.
- Do not implement behavior before the relevant contract and documentation are in place.
- Prefer small, isolated edits inside a single bounded context.
- Preserve clear service boundaries: services communicate through documented APIs and events, never through each other's storage.

## Default workflow
- Work TDD-style by writing or updating the smallest failing test that captures the desired behavior first.
- Implement the smallest change that satisfies the test while staying inside the owned module boundary.
- Run the narrowest relevant verification during development, then run broader checks before finishing.
- If the local Docker demo stack is in use, finish by running `pnpm demo:refresh` after the checks are green so a browser refresh shows the latest code.
- Add or update regression coverage whenever a bug is fixed or a behavior changes in a way that could silently break existing flows.
- Update architecture and guide documents in the same change when responsibilities, interfaces, dependencies, or data ownership shift.
- Commit each coherent change after its checks are green. Do not let multiple finished slices pile up uncommitted in the working tree.

## Coordination rules
- One agent task should stay inside one owned module boundary whenever possible.
- Every parallel agent task should work from its own Git branch rather than sharing the coordinator branch or another agent branch.
- Use branch names that make ownership obvious, such as `agent/<area>-<slice>` or `codex/<milestone>-<module>`.
- The coordinator is responsible for creating, tracking, and integrating agent branches back into the main line.
- Stop and coordinate before changing `docs/interface-catalog.md`, `docs/dependency-map.md`, `packages/contracts-*/src`, `ARCHITECTURE.md`, `docker-compose.yml`, or the root `package.json`.
- Shared runtime packages such as `packages/runtime-node` and `packages/runtime-web` are coordination surfaces. Keep their API changes small and intentional.
- Prefer opening a contract or runtime change first, then fan out to dependent modules.

## Architecture rules
- `apps/web` may only talk to `services/gateway`.
- External tools may only talk to `services/mcp-service`.
- Domain services own their own schemas, migrations, and event publication.
- Shared types belong in `packages/contracts-*`.
- Shared presentation primitives belong in `packages/ui-*`.

## Implementation style
- Keep files small and intent-revealing.
- Add comments only when the reasoning is not obvious from the code.
- Prefer composition over inheritance.
- Make optional modules degrade cleanly when unavailable.

## Delivery expectations
- Update docs when interfaces or responsibilities change.
- Add or update tests for contract, boundary, or behavior changes.
- Treat regression protection as part of delivery, not optional cleanup.
- Do not widen dependencies casually; if a dependency rule must change, update the dependency docs in the same change.
- If you add a new service module, add `AGENTS.md`, `ARCHITECTURE.md`, `SPEC.md`, `INTERFACES.md`, and `DEPENDENCIES.md` immediately.
- If you add a new shared runtime package, add `AGENTS.md`, `ARCHITECTURE.md`, `SPEC.md`, and `DEPENDENCIES.md`.
- If you add a new contracts or UI package, add `AGENTS.md` plus a concise README or existing package docs, and keep the code API itself authoritative.
- If you add a new code-bearing subfolder, add a local `AGENTS.md` before filling it with implementation.
