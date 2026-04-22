# AGENTS

## Scope
- Keep tests in this folder focused on web-module helper logic and user-facing slice behavior that does not require browser-only tooling.

## Workflow
- Prefer narrow tests around module helpers, derived state, and payload shaping.
- Avoid pulling service ownership or gateway mocks into these tests unless the web module contract explicitly requires it.
