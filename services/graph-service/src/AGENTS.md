# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on graph-domain HTTP handlers, event consumers and publishers, domain services, and graph-owned persistence adapters.

## Default workflow
- Work TDD-style with the narrowest domain or handler test first.
- Use `../INTERFACES.md` as the authoritative list of routes, ids, and NATS subjects.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `domain`, `messaging`, or `persistence`.

## Guardrails
- Never bypass duplicate-resolution rules or skill-promotion rules in local helpers.

