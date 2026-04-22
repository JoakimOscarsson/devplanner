# Contracts Planner Architecture

## Position in the system
- This package defines the compile-time public contract for goals, plan items, evidence notes, and planner commands, queries, and events.

## Boundaries
- Inbound: consumed by planner-service and MCP contracts.
- Outbound: depends only on `contracts-core`.
- Forbidden: graph logic, tracker logic, or runtime behavior.

## Current responsibilities
- Goal and plan item shapes
- Planner command and query envelopes
- Planner-specific status enums and error shapes

## Update this file when
- Planner entities or public workflows change.
- New planner events or status transitions are introduced.
- Ownership relative to tracker or graph changes.

