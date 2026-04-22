# Graph Service Tests Guide

- Keep tests focused on graph-service-owned HTTP behavior and storage invariants.
- Prefer real in-process route tests over mocks for canvas and node workflows.
- Reset shared in-memory state between tests so each case is isolated.
