# Runtime Node Agent Guide

## Read this first
- Read `/Users/joakim/Documents/codex/PDP-helper/AGENTS.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/docs/agentic-workflow.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-node/ARCHITECTURE.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-node/SPEC.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-node/DEPENDENCIES.md`.

## Local rules
- Keep this package generic and reusable across services.
- Prefer adding typed helpers here before duplicating HTTP or error handling in a service.
- Work TDD-style and keep the API small.
