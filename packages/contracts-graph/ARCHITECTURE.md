# Contracts Graph Architecture

## Position in the system
- This package defines the compile-time public contract for graph and skill-graph entities, commands, queries, and events.

## Boundaries
- Inbound: consumed by graph-service, UI graph packages, and MCP contracts.
- Outbound: depends only on `contracts-core`.
- Forbidden: service logic, persistence concerns, or UI rendering code.

## Current responsibilities
- Canvas, node, edge, skill, and reference shapes
- Graph command and query envelopes
- Graph-specific error and schema constants

## Update this file when
- Graph API shapes or event names change.
- New graph-owned entities are introduced.
- The contract boundary expands or narrows.

