# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on projection consumers, read handlers, rebuild workflows, and tracker-owned persistence adapters.

## Default workflow
- Work TDD-style with the narrowest projection or read-model test first.
- Use `../INTERFACES.md` as the authoritative list of routes, ids, and projection event names.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `projections`, `read-models`, or `rebuild`.

## Guardrails
- Do not introduce writes that mutate planner-owned truth here.

