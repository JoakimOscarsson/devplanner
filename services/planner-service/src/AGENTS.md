# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on planner HTTP handlers, command and query orchestration, domain services, and planner-owned persistence adapters.

## Default workflow
- Work TDD-style with the narrowest domain or handler test first.
- Use `../INTERFACES.md` as the authoritative list of routes, ids, and event names.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `domain`, `events`, or `persistence`.

## Guardrails
- Do not let tracker or graph concerns become write logic in local helpers.

