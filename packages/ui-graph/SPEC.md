# UI Graph Package Spec

## Purpose
`ui-graph` provides reusable graph-editor primitives for brainstorm and skill-graph canvases. It should stay focused on view models, interaction ports, and layout integration points instead of app routing or backend calls.

## Responsibilities
- Define graph-editor view-model types shared by brainstorm and skill-graph screens.
- Expose command ports for node/edge creation, deletion, movement, and duplicate-resolution prompts.
- Define layout adapter boundaries for overlap-safe automatic placement.
- Keep recommendation-node and reference-node rendering concerns explicit in exported types.

## Non-Goals
- Fetching data directly from backend services.
- Owning app-shell navigation or global capability discovery.
- Embedding framework-specific provider trees in the package contract.
