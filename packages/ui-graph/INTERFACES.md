# UI Graph Package Interfaces

## Public Exports
- `CanvasMode`
- `NodeVisualKind`
- `GraphNodeViewModel`
- `GraphEdgeViewModel`
- `GraphSelection`
- `GraphCommandPort`
- `AutoLayoutPort`
- `GraphCanvasModule`

## Integration Rules
- Consumers supply graph data through view models rather than raw service DTOs.
- Mutation actions are issued through `GraphCommandPort`; the package does not call HTTP/NATS directly.
- Layout concerns are delegated to `AutoLayoutPort` so implementations can swap ELK, Dagre, or another layout engine later.

## Recommendation Handling
- Recommendation nodes must remain visually distinct through `NodeVisualKind = "recommendation"`.
- Accept and deny actions flow through command ports rather than embedded side effects.
