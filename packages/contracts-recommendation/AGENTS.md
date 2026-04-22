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
- Keep this package contract-only.
- Keep recommendation ids, payloads, and provider states aligned with `docs/interface-catalog.md`.

## Default workflow
- Work TDD-style with contract tests first.
- Prefer additive changes. Breaking contract changes require an explicit schema version bump.
- Update architecture and interface docs in the same change when exported contracts move.

## Guardrails
- Depend only on `@pdp-helper/contracts-core`.
- Do not add provider clients, service logic, or persistence code here.

