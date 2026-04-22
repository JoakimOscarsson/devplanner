# contracts-mcp

Purpose:
- Define MCP tool contracts, scope requirements, adapter events, and error shapes for external LLM integration.

Owns:
- Tool-name registry and tool metadata.
- Tool input and output contracts for domain reads and permitted writes.
- MCP adapter event names and scope-denial error codes.

Does not own:
- Graph, planner, tracker, or recommendation business rules.
