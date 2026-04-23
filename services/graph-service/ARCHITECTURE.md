# Graph Service Architecture

## Position in the system
- This service is the source of truth for brainstorm canvases and the skill graph.
- It owns graph persistence, canonical skills, references, promotion flows, and duplicate handling.

## Inbound and outbound boundaries
- Inbound: graph HTTP commands and queries from `gateway`.
- Outbound: graph and skill domain events over NATS.
- Forbidden: planner or tracker persistence, direct service-to-service table access.

## Current responsibilities
- `src/storage/*` currently holds the in-memory bootstrap store and will later own persistence adapters.
- `src/routes/*` owns graph HTTP surfaces.
- `src/domain/*` owns health metadata and future graph invariants.
- `src/events/*` owns graph event subject references.
- Brainstorm graph invariants currently include acyclic parent-child relationships for node reparenting.

## Update this file when
- Graph ownership changes.
- New graph event consumers or producers are added.
- Promotion, duplicate-resolution, or canvas lifecycle responsibilities move.
