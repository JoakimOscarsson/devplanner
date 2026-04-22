# Planner Service Architecture

## Position in the system
- This service is the write owner for goals, plan items, evidence notes, and visibility state connected to the skill graph.

## Inbound and outbound boundaries
- Inbound: planner HTTP commands and queries from `gateway`.
- Outbound: planner domain events over NATS for tracker, recommendations, and future consumers.
- Forbidden: graph persistence, tracker projection ownership, or direct service table access.

## Current responsibilities
- `src/storage/*` currently holds the in-memory bootstrap store and will later own persistence adapters.
- `src/routes/*` owns planner HTTP surfaces.
- `src/domain/*` owns planner service metadata and future invariants.
- `src/events/*` owns planner event subject references.

## Update this file when
- Planner-owned entities or write responsibilities change.
- New planner event consumers matter to the architecture.
- The planner/tracker split changes.
