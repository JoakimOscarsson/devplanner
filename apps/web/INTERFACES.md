# Web App Interfaces

- Reads capability state from `GET /api/v1/capabilities` on `gateway`.
- Reads service health from `GET /api/v1/services/health` on `gateway`.
- Talks to domain services only through gateway-visible `/api/v1/...` routes, using same-origin browser requests and a local dev proxy to the gateway.
- Module folders under `src/modules/*` consume shared gateway access through `@pdp-helper/runtime-web`.
- The skill-tree page currently exposes a compact tree UI with search, tag/color filters, keyboard navigation, drag reorder, multi-select, bulk edit/delete, and modal editing for label, description, tags, and color.
- Skill-tag inputs accept comma- or semicolon-separated values and preserve multiple tags across edit flows.
- Clearing a skill color in the modal sends an explicit `null` update so the backend removes the stored color.
- The skill-tree surface autofocuses on page load so arrow keys and create/edit shortcuts work without an initial click.
- Entering multi-select mode starts with an empty selection, and bulk actions automatically return the page to single-select mode after they complete.
