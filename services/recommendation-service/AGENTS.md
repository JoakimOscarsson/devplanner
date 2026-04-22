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
- This service owns provider health, recommendation runs, recommendation decisions, and recommendation records.
- It keeps recommendation generation asynchronous, auditable, and safe when the external provider is unavailable.

## Default workflow
- Work TDD-style with the narrowest recommendation lifecycle or provider-state test first.
- Keep provider behavior and fallback rules reflected in local docs.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders.

## Guardrails
- Do not import source from sibling services.
- Cross-service coordination must happen through documented APIs and NATS events.

