import type {
  DuplicateSkillCheckResult,
  SkillInventoryEntry,
  SkillsSnapshot
} from "./skills-gateway";

export type { SkillsSnapshot } from "./skills-gateway";

export interface SkillsInventorySummaryModel {
  readonly totalCanonicalSkills: number;
  readonly totalReferenceNodes: number;
  readonly totalSkillGraphNodes: number;
}

export interface SkillsInventoryEntryModel {
  readonly skillId: string;
  readonly canonicalLabel: string;
  readonly sourceSummary: string;
  readonly referenceSummary: string;
}

export interface SkillsDuplicateSummaryModel {
  readonly queryLabel: string;
  readonly normalizedLabel: string;
  readonly strategyLabel: string;
  readonly guidance: string;
  readonly exactMatch: boolean;
  readonly candidateLabels: readonly string[];
  readonly candidateSummaries: readonly string[];
}

export interface SkillsPanelModel {
  readonly inventorySummary: SkillsInventorySummaryModel;
  readonly inventoryEntries: readonly SkillsInventoryEntryModel[];
  readonly duplicateSummary: SkillsDuplicateSummaryModel | null;
}

export const EMPTY_SKILLS_SNAPSHOT: SkillsSnapshot = {
  inventory: [],
  summary: {
    totalCanonicalSkills: 0,
    totalReferenceNodes: 0,
    totalSkillGraphNodes: 0
  }
};

function compareInventory(left: SkillInventoryEntry, right: SkillInventoryEntry) {
  return left.canonicalLabel.localeCompare(right.canonicalLabel);
}

function getStrategyLabel(result: DuplicateSkillCheckResult) {
  switch (result.suggestedStrategy) {
    case "create-reference-to-existing":
      return "Use the existing canonical skill and create a reference node.";
    case "use-existing-canonical":
      return "Review the existing canonical skill before creating anything new.";
    default:
      return "Create a new canonical skill.";
  }
}

export function buildSkillsPanelModel(snapshot: SkillsSnapshot): SkillsPanelModel {
  const inventoryEntries = [...snapshot.inventory]
    .sort(compareInventory)
    .map((entry) => ({
      skillId: entry.skillId,
      canonicalLabel: entry.canonicalLabel,
      sourceSummary: entry.sourceCanvasName
        ? `${entry.sourceCanvasName}${entry.sourceNodeLabel ? ` via ${entry.sourceNodeLabel}` : ""}`
        : "No source node recorded",
      referenceSummary:
        entry.referenceCount === 1
          ? "1 reference node"
          : `${entry.referenceCount} reference nodes`
    })) satisfies SkillsInventoryEntryModel[];

  const duplicateSummary = snapshot.duplicateCheck
    ? {
        queryLabel: snapshot.duplicateCheck.queryLabel,
        normalizedLabel: snapshot.duplicateCheck.normalizedLabel,
        strategyLabel: getStrategyLabel(snapshot.duplicateCheck),
        guidance: snapshot.duplicateCheck.guidance,
        exactMatch: snapshot.duplicateCheck.exactMatch,
        candidateLabels: snapshot.duplicateCheck.candidates.map(
          (candidate) => candidate.canonicalLabel
        ),
        candidateSummaries: snapshot.duplicateCheck.candidates.map((candidate) => {
          const matchTone =
            candidate.matchKind === "exact" ? "Exact match" : "Related match";
          const sourceTone = candidate.sourceCanvasName
            ? `from ${candidate.sourceCanvasName}`
            : "without a recorded source canvas";
          const referenceTone =
            candidate.referenceCount === 1
              ? "1 reference node"
              : `${candidate.referenceCount} reference nodes`;

          return `${matchTone}: ${candidate.canonicalLabel} ${sourceTone}, ${referenceTone}.`;
        })
      } satisfies SkillsDuplicateSummaryModel
    : null;

  return {
    inventorySummary: {
      totalCanonicalSkills: snapshot.summary.totalCanonicalSkills,
      totalReferenceNodes: snapshot.summary.totalReferenceNodes,
      totalSkillGraphNodes: snapshot.summary.totalSkillGraphNodes
    },
    inventoryEntries,
    duplicateSummary
  };
}
