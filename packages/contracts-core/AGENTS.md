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
- Other contract packages may depend on this package for shared ids, envelopes, and error shapes.

## Default workflow
- Work TDD-style with contract tests first.
- Prefer additive changes. Breaking contract changes require an explicit schema version bump.
- Update architecture and interface docs in the same change when exported contracts move.

## Guardrails
- Do not add application logic, network clients, or persistence code here.
- Avoid runtime-heavy dependencies. Export TypeScript types and small readonly constants only.

