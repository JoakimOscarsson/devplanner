# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on recommendation handlers, provider integrations, decision flows, and recommendation-owned persistence adapters.

## Default workflow
- Work TDD-style with the narrowest lifecycle or provider integration test first.
- Use `../INTERFACES.md` as the authoritative list of routes, ids, event names, and provider states.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `providers`, `runs`, or `decisions`.

## Guardrails
- Do not let local helpers mutate graph- or planner-owned data directly.

