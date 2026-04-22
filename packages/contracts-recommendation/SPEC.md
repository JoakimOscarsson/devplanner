# contracts-recommendation

Purpose:
- Define contracts for recommendation runs, recommendation nodes, provider health, and accept or deny decisions.

Owns:
- Recommendation and provider-health entities.
- Recommendation command/query envelopes and event names.
- Recommendation-domain error codes and lifecycle constants.

Does not own:
- Graph persistence, planner execution, tracker projections, or MCP transport logic.
