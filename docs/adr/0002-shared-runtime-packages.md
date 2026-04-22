# ADR 0002: Shared Runtime Packages

## Status
Accepted

## Decision
- Node service scaffolding lives in `@pdp-helper/runtime-node`.
- Shared gateway/web fetch logic lives in `@pdp-helper/runtime-web`.

## Consequences
- Services and web modules avoid reimplementing routing, parsing, proxying, and platform-state fetches.
- Shared runtime APIs are coordination surfaces and should change conservatively.
