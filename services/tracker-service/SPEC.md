# Tracker Service Spec

## Purpose
The tracker service is the read-focused progress module. It owns denormalized progress views and summaries derived from planner, graph, and recommendation events.

## Responsibilities
- Build and serve progress projections for goals, plan items, skill development, and recommendation outcomes.
- Rebuild projections from the event stream when needed.
- Expose read-only summaries to the gateway and shell.
- Degrade safely without blocking graph or planner writes.

## Non-Goals
- Owning canonical goal, plan item, canvas, or recommendation writes.
- Mutating graph or planner data directly.
- Becoming the source of truth for completion state.

## Owned Data
- `progress_projection`
- `goal_summary_projection`
- `recommendation_outcome_projection`
