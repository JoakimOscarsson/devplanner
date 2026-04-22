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
- This package owns shell-level capability and module-discovery contracts used by the web application.
- Stay lightweight, presentation-adjacent, and independent from backend transport logic.

## Default workflow
- Work TDD-style with package-export or shaping tests first.
- Update local docs before or with changes to public exports and package responsibilities.
- New code-bearing subfolders created later must receive their own `AGENTS.md`.

## Guardrails
- Depend only on `@pdp-helper/contracts-core` for shared capability and health types.
