# MCP Service Architecture

## Position in the system
- This service is the only external-agent entrypoint.
- It exposes scoped tools for read, recommend, and edit workflows.

## Inbound and outbound boundaries
- Inbound: external LLM or automation tool calls.
- Outbound: calls into owned public domain interfaces and future audit events.
- Forbidden: bypassing domain rules or reaching into service internals directly.

## Current responsibilities
- `src/storage/*` owns the bootstrap MCP audit log.
- `src/routes/*` owns tool listing and HTTP adapter execution.
- `src/domain/*` owns service metadata and future policy composition.
- `src/events/*` owns MCP event subject references.

## Update this file when
- Tool scope rules change.
- New external surfaces are introduced.
- The adapter starts composing multiple domain boundaries differently.
