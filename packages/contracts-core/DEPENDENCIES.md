# DEPENDENCIES

Allowed dependencies:
- `typescript` for local build/typecheck only.
- `zod` for shared runtime schemas and envelope validation.

Forbidden dependencies:
- Domain contract packages.
- Service implementations, UI packages, ORMs, or transport clients.

Consumers:
- All domain contract packages may depend on this package.
