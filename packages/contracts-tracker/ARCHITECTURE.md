# Contracts Tracker Architecture

## Position in the system
- This package defines the compile-time contract for tracker projections, reads, rebuild commands, and lag visibility.

## Boundaries
- Inbound: consumed by tracker-service and any read-only clients.
- Outbound: depends only on `contracts-core`.
- Forbidden: planner writes, graph mutation logic, or runtime behavior.

## Current responsibilities
- Progress projection shapes
- Projection read and rebuild contracts
- Tracker event and error contracts

## Update this file when
- Projection shapes or read boundaries change.
- Tracker begins exposing new read models.
- Rebuild or lag semantics change.

