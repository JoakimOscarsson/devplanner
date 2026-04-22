# Gateway Architecture

## Position in the system
- This service is the only backend entrypoint for `apps/web`.
- It aggregates health and capability state from downstream services.
- It proxies gateway-visible `/api/v1/...` routes to downstream `/v1/...` service routes.

## Inbound and outbound boundaries
- Inbound: HTTP requests from the web app.
- Outbound: HTTP calls to domain services and future subscriptions to platform events.
- Forbidden: imports from sibling services and direct ownership of domain persistence.

## Current responsibilities
- `src/storage/*` owns the registered service table and proxy-prefix mapping.
- `src/domain/*` owns health aggregation and capability shaping.
- `src/routes/*` owns platform routes and thin proxy forwarding.
- `src/events/*` owns platform event subject references.

## Update this file when
- The gateway starts composing additional APIs.
- New downstream services or capability rules are introduced.
- The web-facing contract changes.
