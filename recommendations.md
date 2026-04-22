# Recommendations Review Status

This file is a review log, not an active specification.

The authoritative sources for current conventions and architecture are:
- [ARCHITECTURE.md](/Users/joakim/Documents/codex/PDP-helper/ARCHITECTURE.md)
- [docs/interface-catalog.md](/Users/joakim/Documents/codex/PDP-helper/docs/interface-catalog.md)
- [docs/dependency-map.md](/Users/joakim/Documents/codex/PDP-helper/docs/dependency-map.md)
- [docs/milestones.md](/Users/joakim/Documents/codex/PDP-helper/docs/milestones.md)
- `@pdp-helper/contracts-core` for route prefixes, id prefixes, event subjects, shared runtime schemas, and module capability metadata

Applied from review passes:
- Shared conventions now live in `contracts-core` and are covered by contract tests.
- Shared Node and web runtime scaffolds exist for service and gateway/web code.
- Gateway forwards API traffic and consumes service-reported capability metadata.
- Agent guidance is TDD-first and layered through root and module `AGENTS.md` files.
- Domain event contracts now expose runtime schemas, and `runtime-node` validates request bodies and published events.

Deferred or intentionally skipped review items belong in chat history, not this file, so this document does not become a second spec surface.
