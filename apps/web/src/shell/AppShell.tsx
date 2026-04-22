import { useEffect, useMemo, useRef, useState } from "react";
import type { ModuleCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";
import { useGatewayState, type GatewayState } from "@pdp-helper/runtime-web";
import { gatewayUrl } from "../lib/gateway";
import {
  buildShellPageNavigation,
  createShellPageHref,
  getShellPage,
  resolveShellPage,
  type ShellPageId,
  type ShellPageNavItem
} from "../lib/shell-pages";
import { BrainstormSpotlight } from "../modules/brainstorm/BrainstormSpotlight";
import { ExternalToolsSpotlight } from "../modules/external-tools/ExternalToolsSpotlight";
import { PlannerSpotlight } from "../modules/planner/PlannerSpotlight";
import { RecommendationsSpotlight } from "../modules/recommendations/RecommendationsSpotlight";
import { SkillsSpotlight } from "../modules/skills/SkillsSpotlight";
import { TrackerSpotlight } from "../modules/tracker/TrackerSpotlight";

export interface AppShellProps {
  readonly gatewayState?: GatewayState;
  readonly initialPath?: string;
}

function getModule(
  modules: readonly ModuleCapability[],
  key: ModuleCapability["key"]
) {
  return modules.find((module) => module.key === key);
}

function formatStatusLabel(status: ModuleCapability["status"] | "unknown") {
  switch (status) {
    case "up":
      return "Ready";
    case "degraded":
      return "Degraded";
    case "down":
      return "Offline";
    default:
      return "Unknown";
  }
}

function readBrowserPath() {
  if (typeof window === "undefined") {
    return "/";
  }

  return window.location.hash || "/";
}

function useShellPage(initialPath?: string) {
  const [pageId, setPageId] = useState<ShellPageId>(() =>
    resolveShellPage(initialPath ?? readBrowserPath())
  );

  useEffect(() => {
    if (initialPath !== undefined) {
      setPageId(resolveShellPage(initialPath));
      return;
    }

    function syncPageFromHash() {
      setPageId(resolveShellPage(readBrowserPath()));
    }

    syncPageFromHash();
    window.addEventListener("hashchange", syncPageFromHash);

    return () => {
      window.removeEventListener("hashchange", syncPageFromHash);
    };
  }, [initialPath]);

  function navigate(nextPageId: ShellPageId) {
    setPageId(nextPageId);

    if (initialPath !== undefined || typeof window === "undefined") {
      return;
    }

    window.location.hash = createShellPageHref(nextPageId).slice(1);
  }

  return {
    pageId,
    navigate
  };
}

function OverviewPage({
  navigation,
  services,
  gatewayError
}: {
  readonly navigation: readonly ShellPageNavItem[];
  readonly services: readonly ServiceHealthSnapshot[];
  readonly gatewayError: string | null;
}) {
  const primaryPages = navigation.filter((item) => item.primary && item.id !== "overview");
  const optionalPages = navigation.filter((item) => !item.primary && item.id !== "overview");
  const readyCount = Math.max(
    0,
    navigation.filter((item) => item.enabled).length - 1
  );

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div className="hero-card__copy">
          <p className="eyebrow">Guided demo</p>
          <h1>Your development cockpit</h1>
          <p className="hero-card__body">
            Keep the demo simple: sketch ideas, review the skill tree, and then
            check tracking. The supporting modules stay one click away.
          </p>
        </div>
        <div className="hero-card__summary">
          <div className="metric-card">
            <span className="metric-card__label">Ready workspaces</span>
            <strong>{readyCount}</strong>
            <p>Pages with live module capability data.</p>
          </div>
          <div className="metric-card">
            <span className="metric-card__label">Service snapshots</span>
            <strong>{services.length}</strong>
            <p>Health records reported through the gateway.</p>
          </div>
        </div>
      </section>

      {gatewayError ? <p className="callout callout--error">{gatewayError}</p> : null}

      <section className="content-section">
        <header className="section-heading">
          <p className="section-kicker">Primary workspaces</p>
          <h2>Separate pages for the core flow</h2>
          <p>These are the cleanest entry points for day-to-day demo use.</p>
        </header>
        <div className="workspace-grid">
          {primaryPages.map((page) => (
            <a key={page.id} href={page.href} className="workspace-card">
              <div className="workspace-card__topline">
                <strong>{page.label}</strong>
                <span className={`status-badge status-badge--${page.status}`}>
                  {formatStatusLabel(page.status)}
                </span>
              </div>
              <p>{page.description}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="content-section">
        <header className="section-heading">
          <p className="section-kicker">System view</p>
          <h2>Services and optional tools</h2>
          <p>Keep the supporting surfaces visible without crowding the main work.</p>
        </header>
        <div className="status-layout">
          <article className="panel panel--soft">
            <header className="panel-header">
              <h3>Service health</h3>
              <p>These statuses come directly from the gateway health surface.</p>
            </header>
            <div className="status-stack">
              {services.map((service) => (
                <div key={service.service} className="status-row">
                  <div>
                    <strong>{service.service}</strong>
                    <p>{service.message ?? "Healthy and ready."}</p>
                  </div>
                  <span className={`status-badge status-badge--${service.status}`}>
                    {formatStatusLabel(service.status)}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel panel--soft">
            <header className="panel-header">
              <h3>Supporting pages</h3>
              <p>Optional or downstream capabilities stay available from here.</p>
            </header>
            <div className="supporting-list">
              {optionalPages.map((page) => (
                <a key={page.id} href={page.href} className="supporting-link">
                  <span>{page.label}</span>
                  <span className={`status-badge status-badge--${page.status}`}>
                    {formatStatusLabel(page.status)}
                  </span>
                </a>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function ShellPageContent({
  pageId,
  modules,
  services,
  error
}: {
  readonly pageId: ShellPageId;
  readonly modules: readonly ModuleCapability[];
  readonly services: readonly ServiceHealthSnapshot[];
  readonly error: string | null;
}) {
  const brainstormModule = getModule(modules, "brainstorm");
  const plannerModule = getModule(modules, "planner");
  const trackerModule = getModule(modules, "tracker");
  const recommendationsModule = getModule(modules, "recommendations");
  const externalToolsModule = getModule(modules, "mcp");
  const navigation = buildShellPageNavigation(modules);

  switch (pageId) {
    case "brainstorm":
      return <BrainstormSpotlight module={brainstormModule} gatewayBaseUrl={gatewayUrl} />;
    case "skills":
      return <SkillsSpotlight gatewayBaseUrl={gatewayUrl} />;
    case "planner":
      return <PlannerSpotlight module={plannerModule} />;
    case "tracker":
      return <TrackerSpotlight module={trackerModule} gatewayBaseUrl={gatewayUrl} />;
    case "recommendations":
      return (
        <RecommendationsSpotlight
          module={recommendationsModule}
          gatewayBaseUrl={gatewayUrl}
        />
      );
    case "external-tools":
      return <ExternalToolsSpotlight module={externalToolsModule} />;
    case "overview":
    default:
      return (
        <OverviewPage
          navigation={navigation}
          services={services}
          gatewayError={error}
        />
      );
  }
}

export function AppShell({ gatewayState, initialPath }: AppShellProps) {
  const liveGatewayState = useGatewayState(gatewayUrl);
  const { modules, services, error, loading } = gatewayState ?? liveGatewayState;
  const { pageId, navigate } = useShellPage(initialPath);
  const navigation = useMemo(() => buildShellPageNavigation(modules), [modules]);
  const activePage = getShellPage(pageId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const showStageActions = pageId !== "skills";
  const useMinimalShell = pageId === "skills";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pageId]);

  useEffect(() => {
    if (!sidebarOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      setSidebarOpen(false);
      menuButtonRef.current?.focus();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarOpen]);

  function closeSidebar() {
    setSidebarOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <main
      className={
        useMinimalShell ? "app-shell app-shell--minimal-route" : "app-shell"
      }
    >
      {!useMinimalShell ? (
        <header className="app-shell__topbar">
          <div>
            <p className="eyebrow">PDP Helper</p>
            <h1 className="app-shell__title">Professional development planner</h1>
          </div>
          <div className="topbar-status">
            <span className={`status-badge status-badge--${loading ? "unknown" : "up"}`}>
              {loading ? "Loading" : "Live"}
            </span>
            <p className="topbar-status__copy">
              Separate workspaces for mind-mapping, skill structure, planning, and
              tracking.
            </p>
          </div>
        </header>
      ) : null}

      <button
        ref={menuButtonRef}
        type="button"
        className={
          sidebarOpen
            ? "app-shell__menu-button app-shell__menu-button--open"
            : "app-shell__menu-button"
        }
        onClick={() => setSidebarOpen((current) => !current)}
        aria-expanded={sidebarOpen}
        aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
      >
        <span />
        <span />
        <span />
      </button>

      {sidebarOpen ? (
        <button
          type="button"
          className="shell-sidebar__scrim"
          aria-label="Close navigation"
          onClick={closeSidebar}
        />
      ) : null}

      <div className="app-shell__layout">
        {sidebarOpen ? (
          <aside className="shell-sidebar panel shell-sidebar--drawer shell-sidebar--open">
            <nav className="shell-nav" aria-label="Primary">
              {navigation.map((item) => (
                <a
                  key={item.id}
                  href={item.href}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(item.id);
                    closeSidebar();
                  }}
                  className={
                    item.id === pageId
                      ? "shell-nav__link shell-nav__link--active"
                      : "shell-nav__link"
                  }
                  aria-current={item.id === pageId ? "page" : undefined}
                  title={item.label}
                >
                  <span className="shell-nav__label">{item.label}</span>
                  <span className={`status-dot status-dot--${item.status}`} />
                </a>
              ))}
            </nav>
          </aside>
        ) : null}

        <section className="page-stage">
          {!useMinimalShell ? (
            <header className="page-stage__header panel">
              <div>
                <p className="section-kicker">Workspace</p>
                <h2>{activePage.title}</h2>
                <p>{activePage.description}</p>
              </div>
              {showStageActions ? (
                <div className="page-stage__actions">
                  {navigation
                    .filter((item) => item.primary && item.id !== pageId)
                    .slice(0, 3)
                    .map((item) => (
                      <a
                        key={item.id}
                        href={item.href}
                        className="page-chip"
                        onClick={(event) => {
                          event.preventDefault();
                          navigate(item.id);
                        }}
                      >
                        {item.label}
                      </a>
                    ))}
                </div>
              ) : null}
            </header>
          ) : null}

          <div className="page-stage__content">
            <ShellPageContent
              pageId={pageId}
              modules={modules}
              services={services}
              error={error}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
