# PDP Helper Dependency Map

## Purpose
This document defines allowed dependency directions across apps, services, packages, docs, and shared runtime scaffolds.

The code-enforced mirrors of this document are:
- `tools/check-dependencies.mjs`
- root ESLint configuration

## Ownership Rules
- `apps/web` owns UI composition only.
- `services/*` own runtime behavior for their domain.
- `packages/contracts-*` own shared public types, event names, runtime schemas, and error shapes.
- `packages/runtime-*` own shared execution scaffolding for services and web modules.
- `packages/ui-*` own reusable presentation and interaction primitives.
- `docs/*` own the human-readable system contract.

## Allowed Dependency Directions
| From | Allowed imports |
| --- | --- |
| `apps/web` | `packages/contracts-*`, `packages/runtime-web`, `packages/ui-*` |
| `services/gateway` | `packages/contracts-*`, `packages/runtime-node` |
| `services/graph-service` | `packages/contracts-core`, `packages/contracts-graph`, `packages/runtime-node` |
| `services/planner-service` | `packages/contracts-core`, `packages/contracts-planner`, `packages/runtime-node` |
| `services/tracker-service` | `packages/contracts-core`, `packages/contracts-tracker`, `packages/runtime-node` |
| `services/recommendation-service` | `packages/contracts-core`, `packages/contracts-recommendation`, `packages/runtime-node` |
| `services/mcp-service` | `packages/contracts-*`, `packages/runtime-node` |
| `packages/ui-shell` | `packages/contracts-core` |
| `packages/ui-graph` | `packages/contracts-core`, `packages/contracts-graph` |
| `packages/runtime-node` | `packages/contracts-core` |
| `packages/runtime-web` | `packages/contracts-core` |
| `packages/contracts-core` | local files only plus low-level runtime libraries |
| `packages/contracts-graph` | `packages/contracts-core` |
| `packages/contracts-planner` | `packages/contracts-core` |
| `packages/contracts-tracker` | `packages/contracts-core` |
| `packages/contracts-recommendation` | `packages/contracts-core` |
| `packages/contracts-mcp` | `packages/contracts-core`, `packages/contracts-graph`, `packages/contracts-planner`, `packages/contracts-recommendation` |

## Banned Dependency Directions
- No service may import another service.
- No UI package may import a service.
- No contract package may import a service or UI package.
- `apps/web` must not import from `services/*`.
- `services/gateway` must not import from `packages/ui-*`.
- `services/mcp-service` must not import `apps/web` or any service internals.
- No code may import from `docs/*`.

## Storage And Runtime Boundaries
- Services never read each other’s database tables directly.
- Cross-service coordination happens through HTTP or NATS events only.
- Shared ids across services are stored as opaque references, not relational foreign keys.
- Tracker is projection-only and never becomes the source of truth for planner writes.
- Recommendation acceptance is modeled as recommendation-domain state first; downstream domains apply idempotently from recommendation events.

## Event Boundaries
- Event subject naming comes from `@pdp-helper/contracts-core.makeEventSubject`.
- Event payload ownership stays in the producing domain’s contract package.
- Consumers may subscribe to versioned subjects but may not rely on producer-internal tables or implementation details.
- New cross-service event consumption requires updates to this document and the relevant module `INTERFACES.md`.

## Review Checklist
- Does the change stay within the folder’s allowed imports?
- Does it avoid cross-service storage access?
- Does it keep UI packages free from backend runtime logic?
- Does it update contract docs when introducing a new public interface?
- Does it preserve graceful degradation for optional modules?
