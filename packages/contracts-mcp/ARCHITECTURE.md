# Contracts MCP Architecture

## Position in the system
- This package is the adapter-level contract surface for external tools.
- It intentionally bridges multiple domain contract packages.

## Boundaries
- Inbound: consumed by `mcp-service` and external-tool test coverage.
- Outbound: depends on `contracts-core`, `contracts-graph`, `contracts-planner`, and `contracts-recommendation`.
- Forbidden: service internals, runtime tool execution, or transport logic.

## Current responsibilities
- MCP tool definitions
- Scope requirements per tool
- Input and output contract shapes

## Update this file when
- Tool catalog or scopes change.
- External tool semantics change.
- Additional domain surfaces are exposed externally.

