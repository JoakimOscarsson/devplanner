# AGENTS

## Read this first
- `./ARCHITECTURE.md`
- `./SPEC.md`
- `./INTERFACES.md`
- `./DEPENDENCIES.md`
- `../../ARCHITECTURE.md`
- `../../AGENTS.md`
- `../../docs/agentic-workflow.md`

## Scope
- This service owns goals, plan items, evidence notes, completion commands, and visibility controls for skills hidden from the skill graph.
- It keeps planning logic independent from graph persistence and tracker projections.

## Default workflow
- Work TDD-style with the narrowest domain, route, or event-contract test first.
- Update local architecture and interface docs in the same change when ownership or event surfaces move.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders.

## Guardrails
- Use documented APIs and NATS events for all cross-service coordination.
- Never read sibling-service storage directly.

