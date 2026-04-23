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
- The brainstorm module owns canvas interaction state locally, including viewport offset, subtree drag/pan thresholds, modal dirty-state tracking, request-order guards that prevent stale canvas loads from yanking the selected tab backward, and temporary reparent-target state for keyboard-completable `Move under` mode.

## Update this file when
- The UI starts talking to a new boundary.
- A module moves from shell-only orchestration into owning domain behavior.
- Feature routing, degraded-state behavior, or composition responsibilities change.
