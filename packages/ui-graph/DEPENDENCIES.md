# UI Graph Package Dependencies

## Allowed Compile-Time Imports
- Local source files under `packages/ui-graph/src`.
- Future contract packages such as `@pdp-helper/contracts-core` and `@pdp-helper/contracts-graph`.
- UI framework and rendering libraries once the web track selects them.

## Forbidden Dependencies
- Source imports from `services/*`.
- Storage, broker, or server-only runtime clients.
- App-shell routing or capability-discovery logic that belongs in `packages/ui-shell` or `apps/web`.
