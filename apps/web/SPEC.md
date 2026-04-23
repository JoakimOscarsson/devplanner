# Web App Spec

- Provide a clean module shell for Brainstorm, Skill Graph, Planner, Tracker, Recommendations, and External Tools.
- Surface capability discovery and service health clearly.
- Keep the first implementation lightweight while preserving room for the richer graph editors described in the docs.
- The skill-tree page should favor a compact, keyboard-first tree UI over graph chrome, including multi-select, bulk actions, and modal editing for skill metadata.
- The brainstorm page should favor a calm, canvas-first mind-map editor with direct manipulation, automatic spacing, subtree movement, and a small command set that stays usable with both mouse and keyboard.
- The brainstorm page should preserve deliberate manual arrangement: child/sibling/reparent commands may seed sensible positions, but only the explicit tidy action should re-run the whole-graph layout engine.
- The brainstorm page should preserve viewport intent too: switching or mutating a canvas must not unexpectedly re-fit the viewport unless the user explicitly asks for `Reset view` or `Tidy layout`.
- Brainstorm canvases should behave as stable workspaces: pan and zoom should be remembered per canvas during the active session.
- Brainstorm node typing should stay lightweight: use flexible tags instead of a fixed category picker, and treat the `skill` tag as the signal for skill-tree promotion suggestions.
- The brainstorm canvas should stay usable on touch devices too: panning empty space and dragging nodes must not silently collapse into a desktop-only interaction model.
- On touch-oriented devices, safe viewport navigation should take precedence over accidental node mutation.
- Brainstorm destructive actions should bias toward trust over speed: branch deletes confirm first, and failed optimistic moves should reconcile with persisted state rather than leaving the canvas in a fake saved state.
- Brainstorm write flows should distinguish completed writes from follow-up refresh failures so the user is not encouraged to retry successful mutations.
- Brainstorm confirmation and dirty-dismiss flows should stay inside the app UI rather than using browser-native dialogs, so focus, testing, and mobile behavior remain predictable.
- Brainstorm modal editing should protect user input by trapping focus, blocking dismissal while requests are pending, and confirming before dirty drafts are discarded.
- Brainstorm destructive confirms should meet the same keyboard and focus standards as the editor modal.
- Brainstorm command handling should serialize writes to the active selection so repeat keys or double-clicks cannot queue contradictory mutations against the same branch.
