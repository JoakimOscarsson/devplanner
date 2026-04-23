# Web App Spec

- Provide a clean module shell for Brainstorm, Skill Graph, Planner, Tracker, Recommendations, and External Tools.
- Surface capability discovery and service health clearly.
- Keep the first implementation lightweight while preserving room for the richer graph editors described in the docs.
- The skill-tree page should favor a compact, keyboard-first tree UI over graph chrome, including multi-select, bulk actions, and modal editing for skill metadata.
- The brainstorm page should favor a calm, canvas-first mind-map editor with direct manipulation, automatic spacing, subtree movement, and a small command set that stays usable with both mouse and keyboard.
- The brainstorm canvas should stay usable on touch devices too: panning empty space and dragging nodes must not silently collapse into a desktop-only interaction model.
- Brainstorm destructive actions should bias toward trust over speed: branch deletes confirm first, and failed optimistic moves should reconcile with persisted state rather than leaving the canvas in a fake saved state.
- Brainstorm modal editing should protect user input by trapping focus, blocking dismissal while requests are pending, and confirming before dirty drafts are discarded.
- Brainstorm command handling should serialize writes to the active selection so repeat keys or double-clicks cannot queue contradictory mutations against the same branch.
