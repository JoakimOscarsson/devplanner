# Runtime Web Architecture

- `@pdp-helper/runtime-web` owns typed access to the gateway and shared capability-aware hooks for the web app.
- It translates gateway payloads into UI-safe shapes while keeping domain modules free from ad hoc fetch logic.
- It depends on contracts and UI-shell metadata, never on services directly.
