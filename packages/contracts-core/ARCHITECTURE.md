# Contracts Core Architecture

## Position in the system
- This package is the foundational compile-time contract layer for ids, envelopes, shared error shapes, and cross-cutting constants.
- It has no runtime side effects.

## Boundaries
- Inbound: consumed by other contract packages, UI packages, and services.
- Outbound: none beyond exported types and constants.
- Forbidden: runtime behavior, persistence code, transport clients, or UI logic.

## Current responsibilities
- Branded ids
- Shared command, query, and event envelopes
- Shared service and capability enums
- Shared error shapes

## Update this file when
- Core shared types change.
- Additional cross-cutting identifiers or envelope rules are introduced.
- This package’s dependency policy changes.

