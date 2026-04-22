# ADR 0001: Shared Conventions Live In Contracts

## Status
Accepted

## Decision
- Route-prefix rules, id-prefix rules, event-subject rules, and shared envelopes live in `@pdp-helper/contracts-core`.
- Docs may explain those conventions, but the runtime-checkable source of truth is the contract package.

## Consequences
- Parallel agents have one executable authority for shared conventions.
- Shared-surface changes must be coordinated earlier than feature work.
