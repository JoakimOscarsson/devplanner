# Tracker Service Architecture

## Position in the system
- This service is a projection-only read model for progress and execution visibility.
- It does not own planning writes.

## Inbound and outbound boundaries
- Inbound: planner and graph events that affect projections.
- Outbound: tracker read endpoints and projection status events.
- Forbidden: direct mutation of planner state or graph state.

## Current responsibilities
- `src/storage/*` currently holds the in-memory bootstrap store and will later own projection persistence adapters.
- `src/routes/*` owns tracker HTTP read surfaces.
- `src/domain/*` owns tracker service metadata.
- `src/events/*` owns tracker event subject references.

## Update this file when
- Tracker begins consuming new event streams.
- Projection ownership changes.
- Any write behavior is added or deliberately kept out.
