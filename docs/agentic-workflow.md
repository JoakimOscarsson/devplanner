# Agentic Implementation Workflow

## Required reading order
1. Read the nearest `AGENTS.md`.
2. Read the nearest `ARCHITECTURE.md`.
3. Read the nearest `SPEC.md`, `INTERFACES.md`, and `DEPENDENCIES.md`.
4. Read the repository root `ARCHITECTURE.md` and `AGENTS.md` when working outside a tiny local-only refactor.
5. Read `docs/interface-catalog.md`, `docs/data-flows.md`, and `docs/dependency-map.md` before changing public boundaries.

## Default implementation protocol
1. Confirm the ownership boundary and the exact contract or behavior being changed.
2. Work TDD-style by writing or updating the narrowest failing test that captures the expected behavior first.
3. Implement the smallest change that makes the test pass while staying inside the owned boundary.
4. Run the narrowest useful verification first, then the broader repo checks when the change crosses boundaries.
5. Update architecture and guide docs in the same change whenever behavior, boundaries, dependencies, or public interfaces move.

## TDD defaults
- Prefer contract tests for contract packages and boundary changes.
- Prefer unit or module tests for local domain logic.
- Prefer integration tests when the value is in a boundary handoff between modules.
- When fixing a defect or tightening an existing behavior, add or update a regression test that would fail before the fix and pass after it.
- If a test cannot be added yet because the harness does not exist, create the smallest missing harness first and document that in the change.

## Documentation update triggers
- Update `ARCHITECTURE.md` when responsibilities, data ownership, inbound dependencies, outbound dependencies, or runtime topology change.
- Update `SPEC.md` when purpose, responsibilities, or non-goals change.
- Update `INTERFACES.md` when routes, events, MCP tools, ids, or payload shapes change.
- Update `DEPENDENCIES.md` when allowed imports, consumers, or collaborators change.
- Update `AGENTS.md` when the recommended reading order, workflow, or local guardrails change.

## New folder rule
- Before adding a new code-bearing folder below an existing module, add a local `AGENTS.md`.
- Before adding a new service module, add `AGENTS.md`, `ARCHITECTURE.md`, `SPEC.md`, `INTERFACES.md`, and `DEPENDENCIES.md`.
- Before adding a new shared runtime package, add `AGENTS.md`, `ARCHITECTURE.md`, `SPEC.md`, and `DEPENDENCIES.md`.
- Before adding a new contracts or UI package, add `AGENTS.md` and keep the package API plus package docs authoritative.

## Shared-surface guardrails
- Treat `packages/contracts-*`, `packages/runtime-*`, `docs/interface-catalog.md`, and `docs/dependency-map.md` as shared surfaces that should be stabilized before parallel feature fan-out.
- When a change affects those surfaces, update the corresponding `ARCHITECTURE.md`, `SPEC.md`, or `DEPENDENCIES.md` in the same patch.

## Definition of done for agent work
- Tests added or updated first when feasible.
- Regression coverage added or updated for any bug fix or behavior correction.
- Implementation passes local verification.
- Architecture and interface docs reflect the new reality.
- The change stays within the declared ownership boundary or explicitly updates the boundary docs.
