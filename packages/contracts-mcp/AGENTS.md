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
- This package may depend on multiple domain contract packages because it models the external adapter surface.

## Default workflow
- Work TDD-style with contract tests first.
- Prefer additive changes. Breaking contract changes require an explicit schema version bump.
- Update architecture and interface docs in the same change when exported contracts move.

## Guardrails
- Do not add service logic or transport adapters here.
- Keep tool scopes, names, and payloads aligned with `docs/interface-catalog.md`.

