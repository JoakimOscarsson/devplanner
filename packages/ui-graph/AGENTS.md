# AGENTS

## Read this first
- `./ARCHITECTURE.md`
- `./SPEC.md`
- `./INTERFACES.md`
- `./DEPENDENCIES.md`
- `../../ARCHITECTURE.md`
- `../../AGENTS.md`
- `../../docs/agentic-workflow.md`

## Scope
- This package owns reusable graph-editor primitives shared by brainstorm and skill-graph experiences.
- Stay framework- and service-boundary aware so the web app can compose this package without importing backend internals.

## Default workflow
- Work TDD-style with view-model or package-export tests first.
- Update local docs before or with changes to public exports and package responsibilities.
- New code-bearing subfolders created later must receive their own `AGENTS.md`.

## Guardrails
- Do not import service source directly.

