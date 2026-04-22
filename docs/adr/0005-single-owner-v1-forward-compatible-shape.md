# ADR 0005: Single-Owner V1 With Forward-Compatible Shape

## Status
Accepted

## Decision
- v1 remains a single-owner application.
- Contracts and persisted shapes continue to carry `workspace_id` and `created_by`.

## Consequences
- The schema stays ready for future multi-user work without overcomplicating v1 authorization.
