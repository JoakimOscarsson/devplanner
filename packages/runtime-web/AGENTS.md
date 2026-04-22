# Runtime Web Agent Guide

## Read this first
- Read `/Users/joakim/Documents/codex/PDP-helper/AGENTS.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/docs/agentic-workflow.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-web/ARCHITECTURE.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-web/SPEC.md`.
- Read `/Users/joakim/Documents/codex/PDP-helper/packages/runtime-web/DEPENDENCIES.md`.

## Local rules
- Keep fetch logic and capability discovery hooks here instead of duplicating them inside web modules.
- Stay UI-framework-light; this package should be reusable by multiple web modules.
