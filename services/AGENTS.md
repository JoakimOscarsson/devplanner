# Services Folder Guide

- Read the repo root `AGENTS.md` and `docs/agentic-workflow.md` first.
- Each service owns its runtime boundary and must not import another service.
- Shared HTTP/runtime code belongs in `packages/runtime-node`.
