# Planner Service Tests Guide

- Keep tests focused on planner-service-owned HTTP behavior and in-memory storage invariants.
- Prefer real in-process route tests over mocks for goal, plan item, and evidence-note workflows.
- Reset shared in-memory state between tests so each case is isolated.
