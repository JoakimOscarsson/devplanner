# contracts-planner

Purpose:
- Define contracts for goals, plan breakdown items, evidence notes, and skill-graph visibility state.

Owns:
- Goal and plan-item entities.
- Planner command/query envelopes and event names.
- Planner-domain error codes and lifecycle constants.

Does not own:
- Graph persistence, duplicate skill resolution, progress projections, recommendation providers, or MCP tool manifests.
