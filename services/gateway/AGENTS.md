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
- This service owns only the gateway layer and lives entirely under `services/gateway`.
- It provides the single backend entrypoint for the web app, capability discovery, service health aggregation, and authenticated routing to domain services.

## Default workflow
- Work TDD-style with the narrowest route or composition test first.
- Keep the gateway thin and boundary-aware.
- Reflect ownership or surface changes in `ARCHITECTURE.md`, `SPEC.md`, `INTERFACES.md`, and `DEPENDENCIES.md` in the same change.

## Guardrails
- Do not import source from sibling services.
- Integrate only through documented APIs and future `@pdp-helper/contracts-*` packages.
- Keep domain ownership out of this service.
- New code-bearing subfolders created later must receive their own `AGENTS.md`.

