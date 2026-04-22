# Planner Service Spec

## Purpose
The planner service is the source of truth for goals and goal breakdowns. It owns tasks, milestones, evidence, completion state, and visibility flags that determine whether a planning skill item is shown in the skill graph.

## Responsibilities
- Create and update goals, plan items, and evidence notes.
- Support goal creation from brainstorm nodes or direct planner entry.
- Represent mixed plan-item types such as `skill`, `milestone`, `task`, and `evidence`.
- Emit stable events that tracker and recommendation modules can consume.
- Preserve hide-from-skill-graph state without removing an item from the plan.

## Non-Goals
- Owning brainstorm/skill graph persistence.
- Building read-optimized tracker projections.
- Generating recommendations.

## Owned Data
- `goal`
- `plan_item`
- `evidence_note`
- `plan_visibility_rule`
