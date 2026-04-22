# ADR 0003: Capabilities Stay Closed In V1

## Status
Accepted

## Decision
- `CapabilityName` remains a closed union in `contracts-core` for v1.
- Services report capability metadata, but capability names themselves remain centrally declared.

## Consequences
- Adding a new capability requires coordinated edits to contracts and service registration.
- The web app keeps strong exhaustiveness and predictable module ownership while the product surface is still small.
