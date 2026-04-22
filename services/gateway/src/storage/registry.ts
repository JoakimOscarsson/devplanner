import type { ServiceCapability, ServiceName } from "@pdp-helper/contracts-core";

export interface RegisteredService {
  service: ServiceName;
  url: string;
  optional: boolean;
  capabilities: readonly Omit<ServiceCapability, "service">[];
  proxyPrefixes: readonly string[];
}

export const registeredServices: readonly RegisteredService[] = [
  {
    service: "graph-service",
    url: process.env.GRAPH_SERVICE_URL ?? "http://localhost:4101",
    optional: false,
    capabilities: [
      {
        capability: "brainstorm",
        title: "Brainstorm",
        route: "/brainstorm",
        version: "v1",
        optional: false
      },
      {
        capability: "skill-graph",
        title: "Skill Graph",
        route: "/skills",
        version: "v1",
        optional: false
      }
    ],
    proxyPrefixes: ["/api/v1/canvases", "/api/v1/skills"]
  },
  {
    service: "planner-service",
    url: process.env.PLANNER_SERVICE_URL ?? "http://localhost:4102",
    optional: false,
    capabilities: [
      {
        capability: "planner",
        title: "Planner",
        route: "/planner",
        version: "v1",
        optional: false
      }
    ],
    proxyPrefixes: ["/api/v1/goals"]
  },
  {
    service: "tracker-service",
    url: process.env.TRACKER_SERVICE_URL ?? "http://localhost:4103",
    optional: true,
    capabilities: [
      {
        capability: "tracker",
        title: "Tracker",
        route: "/tracker",
        version: "v1",
        optional: true
      }
    ],
    proxyPrefixes: ["/api/v1/progress"]
  },
  {
    service: "recommendation-service",
    url: process.env.RECOMMENDATION_SERVICE_URL ?? "http://localhost:4104",
    optional: true,
    capabilities: [
      {
        capability: "recommendations",
        title: "Recommendations",
        route: "/recommendations",
        version: "v1",
        optional: true
      }
    ],
    proxyPrefixes: ["/api/v1/recommendations", "/api/v1/providers"]
  },
  {
    service: "mcp-service",
    url: process.env.MCP_SERVICE_URL ?? "http://localhost:4105",
    optional: true,
    capabilities: [
      {
        capability: "mcp",
        title: "External Tools",
        route: "/external-tools",
        version: "v1",
        optional: true
      }
    ],
    proxyPrefixes: ["/api/v1/tools"]
  }
] as const;
