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
- This service owns MCP tool exposure, API-key scope enforcement, audit logging, and external-tool adapters.
- It remains the only external-LLM entrypoint while enforcing the same domain rules as first-party clients.

## Default workflow
- Work TDD-style with tool-contract or scope-enforcement tests first.
- Keep scope rules and adapter responsibilities reflected in local docs.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders.

## Guardrails
- Do not import source from sibling services.
- Cross-service coordination must happen through documented APIs and NATS events.

