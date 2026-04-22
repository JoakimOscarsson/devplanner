import type { ModuleCapability } from "@pdp-helper/ui-shell";

export function ExternalToolsSpotlight({
  module
}: {
  module?: ModuleCapability;
}) {
  return (
    <article className="panel">
      <header className="panel-header">
        <h2>External tools module</h2>
        <p>MCP setup, API-key visibility, and tool-oriented recommendations live behind this boundary.</p>
      </header>
      <p>
        Status: <strong>{module?.status ?? "unknown"}</strong>
      </p>
    </article>
  );
}
