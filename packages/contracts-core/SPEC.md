# contracts-core

Purpose:
- Provide shared ids, envelope types, runtime schemas, error shapes, actor/auth concepts, and platform-level capability types.

Owns:
- Schema versions and event envelope structure.
- Shared branded identifiers used across domain contracts.
- Common error and pagination/query shapes.
- Capability and module-capability metadata used by gateway and web runtime layers.

Does not own:
- Domain entities for graph, planner, tracker, recommendation, or MCP tools.
