# Gateway Service Spec

## Purpose
The gateway is the single backend entrypoint for the web application. It fronts domain services, exposes capability discovery to the shell, and provides a stable HTTP surface that can degrade gracefully when optional modules are unavailable.

## Responsibilities
- Terminate client authentication and API-key validation for first-party web requests.
- Route or aggregate requests to graph, planner, tracker, recommendation, and MCP services through documented APIs.
- Expose module capability and service health snapshots to support UI feature gating.
- Normalize cross-service errors into a stable client-facing error model.

## Non-Goals
- Owning business-domain persistence.
- Reading or writing another service's database tables.
- Implementing recommendation generation, graph mutation rules, or tracker projection logic locally.

## Integration Model
- Synchronous integration: documented internal APIs exposed by domain services.
- Asynchronous integration: NATS subjects for service health and capability refresh signals.
