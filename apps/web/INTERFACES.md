# Web App Interfaces

- Reads capability state from `GET /api/v1/capabilities` on `gateway`.
- Reads service health from `GET /api/v1/services/health` on `gateway`.
- Talks to domain services only through gateway-visible `/api/v1/...` routes.
- Module folders under `src/modules/*` consume shared gateway access through `@pdp-helper/runtime-web`.
