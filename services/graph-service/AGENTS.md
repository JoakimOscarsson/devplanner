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
- This service owns brainstorm canvases, skill graph entities, node and edge mutation rules, skill promotion, and duplicate-resolution workflows.
- It remains the canonical persistence boundary for graph-shaped data and recommendation-node materialization within canvases.

## Default workflow
- Work TDD-style with the narrowest domain, route, or contract test first.
- Keep storage ownership explicit and update local docs in the same change if ownership or interfaces shift.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders.

## Guardrails
- Do not import source from sibling services.
- Cross-service coordination must happen through documented APIs and NATS events.

