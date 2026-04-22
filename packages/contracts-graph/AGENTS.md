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
- Keep this package focused on graph-domain contracts only.
- Keep graph ids, payloads, and error details aligned with `docs/interface-catalog.md`.

## Default workflow
- Work TDD-style with contract tests first.
- Prefer additive changes. Breaking contract changes require an explicit schema version bump.
- Update architecture and interface docs in the same change when exported contracts move.

## Guardrails
- Depend only on `@pdp-helper/contracts-core`.
- Do not add persistence or UI code here.
- Treat node-role, duplicate-resolution, and recommendation-node semantics as compatibility-sensitive.

