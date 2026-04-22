import type { CapabilityName, ModuleCapability } from "@pdp-helper/contracts-core";

export type ShellPageId =
  | "overview"
  | "brainstorm"
  | "skills"
  | "planner"
  | "tracker"
  | "recommendations"
  | "external-tools";

export interface ShellPageDefinition {
  readonly id: ShellPageId;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly path: `/${string}`;
  readonly moduleKey?: CapabilityName;
  readonly primary?: boolean;
}

export interface ShellPageNavItem extends ShellPageDefinition {
  readonly href: string;
  readonly enabled: boolean;
  readonly status: ModuleCapability["status"] | "unknown";
  readonly optional: boolean;
}

export const SHELL_PAGES: readonly ShellPageDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    title: "Your development cockpit",
    description:
      "Start here for the cleanest tour of the current product state and the quickest path into the main workspaces.",
    path: "/",
    primary: true
  },
  {
    id: "brainstorm",
    label: "Brainstorm",
    title: "Brainstorm workspace",
    description:
      "Capture ideas on the mind-map canvas, explore canvases, and create early node structure without leaving the workspace.",
    path: "/brainstorm",
    moduleKey: "brainstorm",
    primary: true
  },
  {
    id: "skills",
    label: "Skill tree",
    title: "Skill tree",
    description:
      "Review canonical skill inventory and duplicate guidance before growing the long-term skill graph.",
    path: "/skills",
    moduleKey: "skill-graph",
    primary: true
  },
  {
    id: "planner",
    label: "Planner",
    title: "Planner workspace",
    description:
      "Turn goals into concrete tasks, milestones, and evidence without mixing planning controls into the graph views.",
    path: "/planner",
    moduleKey: "planner"
  },
  {
    id: "tracker",
    label: "Tracking",
    title: "Tracker workspace",
    description:
      "Monitor projection lag and progress summaries in a read-only surface built for quick health checks.",
    path: "/tracker",
    moduleKey: "tracker",
    primary: true
  },
  {
    id: "recommendations",
    label: "Recommendations",
    title: "Recommendation review",
    description:
      "Inspect provider health, trigger runs, and review accept or deny decisions without burying them in the core workflow.",
    path: "/recommendations",
    moduleKey: "recommendations"
  },
  {
    id: "external-tools",
    label: "External tools",
    title: "External tools",
    description:
      "See the MCP surface and external tooling access in one place when you need integrations or agent hand-offs.",
    path: "/external-tools",
    moduleKey: "mcp"
  }
] as const;

function normalizePath(path: string | undefined) {
  if (!path) {
    return "/";
  }

  const withoutOrigin = path.replace(/^[a-z]+:\/\/[^/]+/i, "");
  const hashPath = withoutOrigin.startsWith("#")
    ? withoutOrigin.slice(1)
    : withoutOrigin;
  const trimmed = hashPath.split("?")[0]?.trim() || "/";

  if (trimmed === "" || trimmed === "#") {
    return "/";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function resolveShellPage(path: string | undefined): ShellPageId {
  const normalizedPath = normalizePath(path);
  const directMatch = SHELL_PAGES.find((page) => page.path === normalizedPath);

  if (directMatch) {
    return directMatch.id;
  }

  return "overview";
}

export function createShellPageHref(pageId: ShellPageId) {
  const page = SHELL_PAGES.find((entry) => entry.id === pageId) ?? SHELL_PAGES[0]!;
  return `#${page.path}`;
}

export function getShellPage(pageId: ShellPageId): ShellPageDefinition {
  return SHELL_PAGES.find((page) => page.id === pageId) ?? SHELL_PAGES[0]!;
}

export function buildShellPageNavigation(
  modules: readonly ModuleCapability[]
): ShellPageNavItem[] {
  return SHELL_PAGES.map((page) => {
    const module = page.moduleKey
      ? modules.find((entry) => entry.key === page.moduleKey)
      : undefined;

    return {
      ...page,
      href: createShellPageHref(page.id),
      enabled: module?.enabled ?? true,
      status: module?.status ?? "unknown",
      optional: module?.optional ?? false
    };
  });
}
