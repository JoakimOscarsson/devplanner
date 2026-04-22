# INTERFACES

Exports:
- Shared scalar and JSON types.
- Branded ids for all first-class entities.
- Command, query, and event envelopes plus shared runtime schemas.
- Common error codes and error payload shapes.
- Workspace, actor, capability, module-capability, pagination, and health interfaces.

Versioning:
- Add new fields additively when possible.
- Treat envelope field removals or semantic changes as breaking changes.
