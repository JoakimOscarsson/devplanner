# ADR 0004: Recommendations Are Record-First

## Status
Accepted

## Decision
- Recommendation acceptance and denial are recorded in the recommendation domain first.
- Downstream materialization is modeled as event-driven, idempotent follow-on work rather than synchronous cross-service mutation.

## Consequences
- Retries are safer.
- Recommendation-service stays decoupled from graph and planner persistence concerns.
