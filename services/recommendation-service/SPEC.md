# Recommendation Service Spec

## Purpose
The recommendation service generates and manages recommendations from built-in or external providers. It owns provider health, scheduling, recommendation lifecycle state, and accept/deny decisions.

## Responsibilities
- Queue or defer recommendation runs depending on provider health.
- Store recommendation run state, provider health snapshots, and recommendation decisions.
- Request graph-service materialization of recommendation nodes for brainstorm and skill graph canvases.
- Expose accept/deny flows to the UI and MCP adapter.
- Publish auditable recommendation lifecycle events.

## Non-Goals
- Persisting canonical graph nodes outside of recommendation metadata.
- Owning goals, plan items, or tracker projections.
- Allowing providers to mutate graph/planner state directly.

## Owned Data
- `recommendation_run`
- `recommendation_record`
- `provider_health`
- `recommendation_decision`
