# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep source in this folder focused on reusable graph-editor contracts and implementation primitives.

## Default workflow
- Work TDD-style with the narrowest package-level or helper-level test first.
- Public exports here must stay decoupled from backend transport details and app-shell concerns.
- If this package grows new code-bearing subfolders such as `layout` or `rendering`, add folder-level `AGENTS.md` files there first.

