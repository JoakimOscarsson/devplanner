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
- This app owns UI composition only.
- Fetch runtime data from `services/gateway` only.
- Use `packages/ui-shell` for module-shell logic and `packages/ui-graph` for graph presentation helpers.

## Default workflow
- Work TDD-style. Start with the narrowest failing UI, contract, or composition test you can add.
- Keep degraded states explicit and user-friendly.
- If routing, capability behavior, or shared UI ownership changes, update `ARCHITECTURE.md` in the same change.

## Guardrails
- Do not import from `services/*` directly.
- Do not move domain ownership into the web layer.

