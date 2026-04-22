# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep feature-shell logic in this folder and shared presentation logic in `packages/ui-*`.
- Prefer data fetching helpers and small components over large stateful containers.

## Default workflow
- Work TDD-style with the narrowest component or composition test first.
- Preserve graceful degraded states for optional services.
- If this folder grows a deeper code-bearing subtree, add a local `AGENTS.md` there first.

