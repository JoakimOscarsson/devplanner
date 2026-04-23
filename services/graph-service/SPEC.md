# Graph Service Spec

## Purpose
The graph service is the source of truth for brainstorm canvases and the skill graph. It owns graph mutation rules, duplicate-skill checks, canonical skills, skill references, and storage of recommendation-type graph nodes.

## Responsibilities
- Persist canvases, nodes, edges, canonical skills, and skill references.
- Support multiple brainstorm tabs/canvases per workspace.
- Provide explicit promotion flows from brainstorm items into canonical skills.
- Enforce duplicate-skill resolution before canonical skill creation.
- Materialize and update recommendation nodes in response to recommendation-service requests and decisions.
- Support skill-tree CRUD and ordering behavior while keeping the backend graph model as the source of truth.
- Reject brainstorm reparent operations that would create parent-child cycles.

## Non-Goals
- Generating recommendations.
- Owning goals, plan items, or tracker projections.
- Exposing raw database access to other services.

## Owned Data
- `canvas`
- `graph_node`
- `graph_edge`
- `skill`
- `skill_reference`
- `recommendation_node_view`
