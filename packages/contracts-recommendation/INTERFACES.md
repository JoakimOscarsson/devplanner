# INTERFACES

Exports:
- Recommendation, recommendation-run, recommendation-decision, and provider-health types.
- Recommendation command and query envelopes for request, ingest, accept, deny, and health updates.
- Recommendation event names and typed payloads.
- Recommendation error codes and schema constants.

Versioning:
- Preserve decision and provenance fields.
- Treat changes to provider-health meaning or recommendation status transitions as breaking.
