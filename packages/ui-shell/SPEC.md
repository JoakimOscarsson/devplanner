# UI Shell Package Spec

## Purpose
`ui-shell` defines the shell-level contracts that let the app discover available modules, navigate between them, and surface degraded states when optional services are absent.

## Responsibilities
- Define capability-discovery contracts for module registration and health presentation.
- Provide shell-facing types for navigation items, module availability, and service health badges.
- Keep shell integration separate from graph-editor implementation details.

## Non-Goals
- Implementing route handlers for the app.
- Fetching backend data directly.
- Taking ownership of graph-canvas rendering or planner-specific view logic.
