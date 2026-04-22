# AGENTS

## Read this first
- `../AGENTS.md`
- `../ARCHITECTURE.md`
- `../INTERFACES.md`
- `../../../AGENTS.md`
- `../../../docs/agentic-workflow.md`

## Local focus
- Keep code here focused on MCP tool registration, scope checks, transport adapters, and audit logging helpers.

## Default workflow
- Work TDD-style with tool-definition or scope-enforcement tests first.
- Use `../INTERFACES.md` as the authoritative list of tool names, ids, and access rules.
- Add a new `AGENTS.md` before introducing deeper code-bearing folders such as `tools`, `auth`, or `audit`.

## Guardrails
- Do not bypass owning-service validation when forwarding commands.

