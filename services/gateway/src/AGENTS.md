# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on gateway HTTP handlers, health aggregation, capability discovery, and thin composition logic.

## Default workflow
- Work TDD-style with route-level or composition-level tests first.
- Use `../INTERFACES.md` as the authoritative list of routes and external surface area.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `routes`, `composition`, or `platform`.

## Guardrails
- Do not move domain logic into this folder.

