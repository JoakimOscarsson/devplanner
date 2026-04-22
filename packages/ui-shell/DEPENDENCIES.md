# UI Shell Package Dependencies

## Allowed Compile-Time Imports
- Local source files under `packages/ui-shell/src`.
- Future contract packages such as `@pdp-helper/contracts-core`.
- UI framework and state-management libraries once the web track selects them.

## Forbidden Dependencies
- Source imports from `services/*`.
- Storage, broker, or server-only runtime clients.
- Graph-editor implementation details that belong in `packages/ui-graph`.
