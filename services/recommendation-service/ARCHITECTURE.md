# Recommendation Service Architecture

## Position in the system
- This service owns recommendation records, provider health, run scheduling, and accept/deny lifecycle.
- It integrates with remote Ollama through configured environment variables.

## Inbound and outbound boundaries
- Inbound: manual run requests, proactive triggers, external recommendation submissions, and decision commands.
- Outbound: recommendation and provider-health events. Downstream application is modeled as event-driven follow-on work.
- Forbidden: direct graph or planner table access.

## Current responsibilities
- `src/storage/*` currently holds the in-memory bootstrap store and will later own persistence adapters.
- `src/routes/*` owns recommendation HTTP surfaces.
- `src/domain/*` owns provider health and service metadata.
- `src/events/*` owns recommendation event subject references.

## Update this file when
- Provider strategy changes.
- Recommendation materialization ownership changes.
- New triggers or consumers alter the service role.
