import {
  buildNavigation,
  summarizeUnavailableModules
} from "@pdp-helper/ui-shell";
import { useGatewayState } from "@pdp-helper/runtime-web";
import { gatewayUrl } from "../lib/gateway";
import { BrainstormSpotlight } from "../modules/brainstorm/BrainstormSpotlight";
import { ExternalToolsSpotlight } from "../modules/external-tools/ExternalToolsSpotlight";
import { PlannerSpotlight } from "../modules/planner/PlannerSpotlight";
import { RecommendationsSpotlight } from "../modules/recommendations/RecommendationsSpotlight";
import { SkillsSpotlight } from "../modules/skills/SkillsSpotlight";
import { TrackerSpotlight } from "../modules/tracker/TrackerSpotlight";

export function AppShell() {
  const { modules, services, error } = useGatewayState(gatewayUrl);
  const navigation = buildNavigation(modules);
  const unavailableMessages = summarizeUnavailableModules(modules);
  const brainstormModule = modules.find((module) => module.key === "brainstorm");
  const plannerModule = modules.find((module) => module.key === "planner");
  const skillsModule = modules.find((module) => module.key === "skill-graph");
  const trackerModule = modules.find((module) => module.key === "tracker");
  const recommendationsModule = modules.find(
    (module) => module.key === "recommendations"
  );
  const externalToolsModule = modules.find((module) => module.key === "mcp");

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <p className="eyebrow">PDP Helper</p>
          <h1>A guided demo path for the stabilization pass.</h1>
          <p className="hero-body">
            Start with the two active workflows, check the shared platform state,
            then browse the supporting modules that round out the shell.
          </p>
          <div className="hero-actions">
            {navigation.map((item) => (
              <span
                key={item.key}
                className={item.enabled ? "nav-chip" : "nav-chip nav-chip--muted"}
              >
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <aside className="hero-summary panel">
          <p className="section-kicker">What works now</p>
          <ul className="summary-list">
            <li>
              <strong>Brainstorm</strong>
              <span>Explore canvases and create new idea nodes.</span>
            </li>
            <li>
              <strong>Planner</strong>
              <span>Turn a goal into plan items and evidence.</span>
            </li>
            <li>
              <strong>Shell status</strong>
              <span>Read the capability and service snapshots from the gateway.</span>
            </li>
          </ul>
        </aside>
      </section>

      <section className="section-block">
        <header className="section-header">
          <p className="section-kicker">Primary demo modules</p>
          <h2>Brainstorm and planner lead the experience.</h2>
          <p>
            These are the first things to evaluate in the stabilization pass, so
            they stay at the top of the page.
          </p>
        </header>
        <div className="primary-grid">
          <BrainstormSpotlight
            module={brainstormModule}
            gatewayBaseUrl={gatewayUrl}
          />
          <PlannerSpotlight module={plannerModule} />
        </div>
      </section>

      <section className="section-block">
        <header className="section-header">
          <p className="section-kicker">Supporting system status</p>
          <h2>Capability and health checks sit after the main demo path.</h2>
          <p>
            This keeps the shell readable while still surfacing the fallback and
            degradation signals that matter during evaluation.
          </p>
        </header>
        <div className="content-grid">
          <article className="panel">
            <header className="panel-header">
              <h3>Module capability state</h3>
              <p>
                Derived from the Gateway so the UI can degrade cleanly when
                optional services are unavailable.
              </p>
            </header>
            <div className="module-grid">
              {modules.map((module) => (
                <article key={module.key} className="module-card">
                  <div className="module-card__topline">
                    <span>{module.title}</span>
                    <span className={`status-pill status-pill--${module.status}`}>
                      {module.status}
                    </span>
                  </div>
                  <p>{module.description}</p>
                  <div className="module-card__footer">
                    <span>{module.route}</span>
                    <span>{module.optional ? "optional" : "core"}</span>
                  </div>
                </article>
              ))}
            </div>
            {error ? <p className="callout callout--error">{error}</p> : null}
            {unavailableMessages.length > 0 ? (
              <div className="callout">
                {unavailableMessages.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : null}
          </article>

          <article className="panel">
            <header className="panel-header">
              <h3>Service health</h3>
              <p>
                These snapshots come from the same gateway health surface that
                the shell uses.
              </p>
            </header>
            <div className="health-list">
              {services.length === 0 ? (
                <p className="health-empty">
                  No downstream snapshots are available yet.
                </p>
              ) : (
                services.map((service) => (
                  <article key={service.service} className="health-row">
                    <div>
                      <strong>{service.service}</strong>
                      <p>{service.message ?? "Healthy and ready."}</p>
                    </div>
                    <span className={`status-pill status-pill--${service.status}`}>
                      {service.status}
                    </span>
                  </article>
                ))
              )}
            </div>
          </article>
        </div>
      </section>

      <section className="section-block">
        <header className="section-header">
          <p className="section-kicker">Secondary modules</p>
          <h2>Everything else stays available, but visually downstream.</h2>
          <p>
            Skills, tracker, recommendations, and external tools are still part
            of the shell, just no longer competing with the main demo entry
            points.
          </p>
        </header>
        <div className="secondary-grid">
          <SkillsSpotlight module={skillsModule} />
          <TrackerSpotlight module={trackerModule} />
          <RecommendationsSpotlight module={recommendationsModule} />
          <ExternalToolsSpotlight module={externalToolsModule} />
        </div>
      </section>
    </main>
  );
}
