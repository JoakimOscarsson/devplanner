import { describe, expect, it } from "vitest";
import {
  API_KEY_PROFILE_VALUES,
  CAPABILITY_NAME_VALUES,
  HTTP_ROUTE_PREFIXES,
  ID_PREFIXES,
  ModuleCapabilitySchema,
  buildModuleCapabilities
} from "@pdp-helper/contracts-core";
import { MCP_TOOL_DEFINITIONS } from "@pdp-helper/contracts-mcp";

describe("contract packages", () => {
  it("exposes the expected API key profiles", () => {
    expect(API_KEY_PROFILE_VALUES).toEqual([
      "read-only",
      "read+recommend",
      "read+edit"
    ]);
  });

  it("defines the core capability names", () => {
    expect(CAPABILITY_NAME_VALUES).toEqual([
      "brainstorm",
      "skill-graph",
      "planner",
      "tracker",
      "recommendations",
      "mcp"
    ]);
  });

  it("keeps stable id prefixes for public ids", () => {
    expect(ID_PREFIXES.workspace).toBe("wrk");
    expect(ID_PREFIXES.goal).toBe("gol");
    expect(ID_PREFIXES.recommendation).toBe("rec");
  });

  it("keeps stable public and internal route prefixes", () => {
    expect(HTTP_ROUTE_PREFIXES.gateway).toBe("/api/v1");
    expect(HTTP_ROUTE_PREFIXES.service).toBe("/v1");
  });

  it("builds default module capabilities from contracts-core", () => {
    const modules = buildModuleCapabilities([]);

    expect(modules.map((module) => module.key)).toEqual([
      "brainstorm",
      "skill-graph",
      "planner",
      "tracker",
      "recommendations",
      "mcp"
    ]);
    expect(ModuleCapabilitySchema.safeParse(modules[0]).success).toBe(true);
  });

  it("exposes MCP tools across read, recommend, and edit scopes", () => {
    const scopes = new Set(MCP_TOOL_DEFINITIONS.map((tool) => tool.minimumScope));
    expect(scopes).toEqual(
      new Set(["read-only", "read+recommend", "read+edit"])
    );
  });
});
