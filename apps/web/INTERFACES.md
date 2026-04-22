# Web App Interfaces

- Reads capability state from `GET /api/v1/capabilities` on `gateway`.
- Reads service health from `GET /api/v1/services/health` on `gateway`.
- Talks to domain services only through gateway-visible `/api/v1/...` routes, using same-origin browser requests and a local dev proxy to the gateway.
- Module folders under `src/modules/*` consume shared gateway access through `@pdp-helper/runtime-web`.
- The skill-tree page currently exposes a compact tree UI with search, keyboard navigation, drag reorder, multi-select, bulk edit/delete, and modal editing for label, description, tags, and color.
- Skill-tag inputs accept comma- or semicolon-separated values and preserve multiple tags across edit flows.
- Clearing a skill color in the modal sends an explicit `null` update so the backend removes the stored color.
