# Web App Architecture

## Position in the system
- This module is the user-facing shell for the product.
- It reads runtime state from `gateway` only.
- It composes shared UI from `packages/ui-shell` and `packages/ui-graph`.
- It uses `packages/runtime-web` for shared gateway access.

## Inbound and outbound boundaries
- Inbound: browser navigation, user interaction, and gateway responses.
- Outbound: HTTP requests to `gateway`.
- Forbidden: direct imports from `services/*` or direct database or message-bus clients.

## Current responsibilities
- `src/shell/*` owns app-level layout and platform-state composition.
- `src/modules/*` owns feature-isolated UI surfaces for brainstorm, skills, planner, tracker, recommendations, and external tools.
- `src/lib/*` owns thin app-local helpers only.
- The brainstorm module owns canvas interaction state locally, including React Flow viewport framing, ELK tidy-layout orchestration, subtree drag previews, modal dirty-state tracking, request-order guards that prevent stale canvas loads from yanking the selected tab backward, background revalidation when switching back to a cached canvas, mutation locks around drag persistence, and temporary reparent-target state for keyboard-completable `Move under` mode.
- The brainstorm surface also owns canvas-node focus restoration so keyboard traversal can move real DOM focus onto the selected React Flow node instead of only changing visual selection state.
- Brainstorm feedback is delivered through lightweight browser-edge toasts so mutation status does not shift the canvas layout.

## Update this file when
- The UI starts talking to a new boundary.
- A module moves from shell-only orchestration into owning domain behavior.
- Feature routing, degraded-state behavior, or composition responsibilities change.
