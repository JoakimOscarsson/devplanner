# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep source in this folder focused on shared shell modeling and helper functions rather than app-specific wiring.

## Default workflow
- Work TDD-style with the narrowest package-level helper test first.
- Public exports here must stay transport-agnostic and reusable across shells.
- If this package grows new code-bearing subfolders such as `capabilities` or `navigation`, add folder-level `AGENTS.md` files there first.
