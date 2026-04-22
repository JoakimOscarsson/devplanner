# UI Graph Architecture

## Position in the system
- This package owns reusable graph-editor primitives and graph view-model helpers shared by brainstorm and skill-graph experiences.

## Boundaries
- Inbound: consumed by `apps/web`.
- Outbound: depends on graph and core contracts only.
- Forbidden: backend transports, service imports, or app-shell orchestration.

## Current responsibilities
- Graph view-model shaping
- Visual kind and color token helpers
- Shared graph preview and bootstrap helpers

## Update this file when
- The graph UI surface grows into new subdomains.
- New shared editor primitives are introduced.
- This package takes on or sheds responsibilities relative to the web app.

