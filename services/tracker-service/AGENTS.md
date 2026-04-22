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
- This service owns projection building, lag monitoring, rebuild flows, and read APIs for progress views.
- It must remain projection-only and rebuildable from source events.

## Default workflow
- Work TDD-style with projection or read-surface tests first.
- Keep projection ownership and rebuild assumptions documented in local docs.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders.

## Guardrails
- Do not import source from sibling services.
- Do not let tracker become a second source of truth.

