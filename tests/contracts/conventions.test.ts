import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVENT_SUBJECT_PATTERN,
  PLATFORM_EVENT_SUBJECTS
} from "@pdp-helper/contracts-core";
import { GRAPH_EVENT_NAMES } from "@pdp-helper/contracts-graph";
import { MCP_EVENT_NAMES } from "@pdp-helper/contracts-mcp";
import { PLANNER_EVENT_NAMES } from "@pdp-helper/contracts-planner";
import { RECOMMENDATION_EVENT_NAMES } from "@pdp-helper/contracts-recommendation";
import { TRACKER_EVENT_NAMES } from "@pdp-helper/contracts-tracker";

const repoRoot = process.cwd();
const ignoredDirectories = new Set([
  ".git",
  ".nx",
  ".turbo",
  "coverage",
  "dist",
  "node_modules"
]);
const markdownRoots = [
  "docs",
  "apps",
  "services",
  "packages",
  "ARCHITECTURE.md",
  "AGENTS.md",
  "README.md",
  "recommendations.md"
].map((entry) => path.join(repoRoot, entry));

function listMarkdownFiles(root: string): string[] {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...listMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("shared conventions", () => {
  it("keeps all exported event subjects in the canonical shape", () => {
    const allSubjects = [
      ...Object.values(PLATFORM_EVENT_SUBJECTS),
      ...GRAPH_EVENT_NAMES,
      ...PLANNER_EVENT_NAMES,
      ...TRACKER_EVENT_NAMES,
      ...RECOMMENDATION_EVENT_NAMES,
      ...MCP_EVENT_NAMES
    ];

    for (const subject of allSubjects) {
      expect(subject).toMatch(EVENT_SUBJECT_PATTERN);
    }
  });

  it("removes known stale convention fragments from shared docs", () => {
    const files = markdownRoots.flatMap((entry) => {
      if (!fs.existsSync(entry)) {
        return [];
      }

      if (fs.statSync(entry).isDirectory()) {
        return listMarkdownFiles(entry);
      }

      return [entry];
    });
    const forbidden = [
      "graph.node.created.v1",
      "recommendation.created.v1",
      "/api/v1/workspaces/:workspaceId",
      "cvs_<ulid>",
      "node_<ulid>",
      "edge_<ulid>",
      "skr_<ulid>",
      "pdp.v1.recommendation.materialize.requested",
      "pdp.v1.recommendation.decision.recorded",
      "pdp.v1.gateway.capabilities.refreshed"
    ];

    for (const file of files) {
      const contents = fs.readFileSync(file, "utf8");

      for (const fragment of forbidden) {
        expect(contents).not.toContain(fragment);
      }
    }
  }, 20000);
});
