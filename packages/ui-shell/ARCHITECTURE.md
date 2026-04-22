# UI Shell Architecture

## Position in the system
- This package owns shared shell-level capability and navigation helpers for the web app.

## Boundaries
- Inbound: consumed by `apps/web`.
- Outbound: depends on `contracts-core` only.
- Forbidden: service imports, graph editor internals, or backend transport logic.

## Current responsibilities
- Module definitions
- Capability-to-navigation shaping
- Unavailable-module summarization

## Update this file when
- Shell composition rules change.
- Capability modeling changes.
- This package becomes responsible for additional shared app-shell concerns.

