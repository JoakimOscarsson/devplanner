import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ModuleCapability, ServiceHealthSnapshot } from "@pdp-helper/contracts-core";
import type { GatewayState } from "@pdp-helper/runtime-web";
import {
  createShellPageHref,
  resolveShellPage,
  type ShellPageId
} from "../../apps/web/src/lib/shell-pages";

vi.mock("../../apps/web/src/modules/brainstorm/BrainstormSpotlight", () => ({
  BrainstormSpotlight: () => createElement("section", null, "Brainstorm module")
}));

vi.mock("../../apps/web/src/modules/skills/SkillsSpotlight", () => ({
  SkillsSpotlight: () => createElement("section", null, "Skill tree")
}));

vi.mock("../../apps/web/src/modules/planner/PlannerSpotlight", () => ({
  PlannerSpotlight: () => createElement("section", null, "Planner module")
}));

vi.mock("../../apps/web/src/modules/tracker/TrackerSpotlight", () => ({
  TrackerSpotlight: () => createElement("section", null, "Tracking")
}));

vi.mock(
  "../../apps/web/src/modules/recommendations/RecommendationsSpotlight",
  () => ({
    RecommendationsSpotlight: () =>
      createElement("section", null, "Recommendations module")
  })
);

vi.mock("../../apps/web/src/modules/external-tools/ExternalToolsSpotlight", () => ({
  ExternalToolsSpotlight: () => createElement("section", null, "External tools module")
}));

const { AppShell } = await import("../../apps/web/src/shell/AppShell");

function createModule(
  key: ModuleCapability["key"],
  title: string,
  route: string,
  optional = false
): ModuleCapability {
  return {
    key,
    title,
    description: `${title} capability`,
    route,
    service: key === "planner" ? "planner-service" : "graph-service",
    version: "v1",
    optional,
    enabled: true,
    status: "up"
  };
}

function createGatewayState(): GatewayState {
  return {
    modules: [
      createModule("brainstorm", "Brainstorm", "/brainstorm"),
      createModule("skill-graph", "Skill Graph", "/skills"),
      createModule("planner", "Planner", "/planner"),
      createModule("tracker", "Tracker", "/tracker", true),
      createModule("recommendations", "Recommendations", "/recommendations", true),
      createModule("mcp", "External Tools", "/external-tools", true)
    ],
    services: [
      {
        service: "graph-service",
        status: "up",
        message: "Healthy."
      } as ServiceHealthSnapshot
    ],
    error: null,
    loading: false
  };
}

describe("shell pages", () => {
  it("resolves supported shell pages and falls back unknown routes to overview", () => {
    expect(resolveShellPage("/brainstorm")).toBe("brainstorm");
    expect(resolveShellPage("#/skills")).toBe("skills");
    expect(resolveShellPage("/tracker?focus=lag")).toBe("tracker");
    expect(resolveShellPage("#/unknown")).toBe("overview");
    expect(createShellPageHref("brainstorm")).toBe("#/brainstorm");
  });

  it.each([
    ["brainstorm", "Brainstorm workspace", "Brainstorm module"],
    ["skills", "Skill tree", "Skill tree"],
    ["tracker", "Tracker workspace", "Tracking"]
  ] satisfies Array<[ShellPageId, string, string]>)(
    "renders %s as a separate page",
    (pageId, expectedHeading, expectedModuleCopy) => {
      const markup = renderToStaticMarkup(
        createElement(AppShell, {
          gatewayState: createGatewayState(),
          initialPath: createShellPageHref(pageId)
        })
      );

      expect(markup).toContain(expectedHeading);
      expect(markup).toContain(expectedModuleCopy);
      expect(markup).toContain("#/brainstorm");
      expect(markup).toContain("#/skills");
      expect(markup).toContain("#/tracker");

      if (pageId === "skills") {
        expect(markup).not.toContain("PDP Helper");
        expect(markup).not.toContain("Separate workspaces for mind-mapping");
        expect(markup).not.toContain("Workspace");
      } else {
        expect(markup).toContain("PDP Helper");
      }
    }
  );
});
