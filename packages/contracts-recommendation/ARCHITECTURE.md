# Contracts Recommendation Architecture

## Position in the system
- This package defines the compile-time public contract for recommendation records, runs, provider health, decisions, commands, queries, and events.

## Boundaries
- Inbound: consumed by recommendation-service and MCP contracts.
- Outbound: depends only on `contracts-core`.
- Forbidden: provider adapters, persistence code, or graph/planner runtime logic.

## Current responsibilities
- Recommendation lifecycle shapes
- Provider health shapes
- Command, query, and event contracts for recommendation workflows

## Update this file when
- Recommendation lifecycles change.
- Provider health or run semantics change.
- External integration rules affect the public contract.

