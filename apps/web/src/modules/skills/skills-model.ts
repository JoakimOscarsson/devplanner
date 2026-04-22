import { toGraphCanvasViewModel } from "@pdp-helper/ui-graph";
import type {
  DuplicateSkillCheckResult,
  PromotionCandidate,
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

export interface PromotionCandidateModel {
  readonly nodeId: string;
  readonly label: string;
  readonly category: string;
  readonly locationSummary: string;
}

export interface DuplicateCandidateModel {
  readonly skillId: string;
  readonly canonicalLabel: string;
  readonly summary: string;
  readonly strategy:
    | "use-existing-canonical"
    | "create-reference-to-existing";
}

export interface SkillsDuplicateSummaryModel {
  readonly queryLabel: string;
  readonly normalizedLabel: string;
  readonly strategyLabel: string;
  readonly guidance: string;
  readonly exactMatch: boolean;
  readonly candidateLabels: readonly string[];
  readonly candidateSummaries: readonly string[];
  readonly candidateModels: readonly DuplicateCandidateModel[];
}

export interface SkillsPanelModel {
  readonly inventorySummary: SkillsInventorySummaryModel;
  readonly inventoryEntries: readonly SkillsInventoryEntryModel[];
  readonly promotionCandidates: readonly PromotionCandidateModel[];
  readonly duplicateSummary: SkillsDuplicateSummaryModel | null;
  readonly skillGraphView: ReturnType<typeof toGraphCanvasViewModel> | null;
}

export const EMPTY_SKILLS_SNAPSHOT: SkillsSnapshot = {
  inventory: [],
  summary: {
    totalCanonicalSkills: 0,
    totalReferenceNodes: 0,
    totalSkillGraphNodes: 0
  },
  promotionCandidates: []
};

function compareInventory(left: SkillInventoryEntry, right: SkillInventoryEntry) {
  return left.canonicalLabel.localeCompare(right.canonicalLabel);
}

function comparePromotionCandidates(left: PromotionCandidate, right: PromotionCandidate) {
  const labelDifference = left.label.localeCompare(right.label);

  if (labelDifference !== 0) {
    return labelDifference;
  }

  return left.canvasName.localeCompare(right.canvasName);
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

  const promotionCandidates = [...(snapshot.promotionCandidates ?? [])]
    .sort(comparePromotionCandidates)
    .map((candidate) => ({
      nodeId: candidate.nodeId,
      label: candidate.label,
      category: candidate.category,
      locationSummary: `${candidate.canvasName} • ${candidate.category}`
    })) satisfies PromotionCandidateModel[];

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
        }),
        candidateModels: snapshot.duplicateCheck.candidates.map((candidate) => ({
          skillId: candidate.skillId,
          canonicalLabel: candidate.canonicalLabel,
          summary: candidate.sourceCanvasName
            ? `${candidate.matchKind === "exact" ? "Exact" : "Related"} match from ${candidate.sourceCanvasName}`
            : `${candidate.matchKind === "exact" ? "Exact" : "Related"} match`,
          strategy:
            candidate.matchKind === "exact"
              ? "create-reference-to-existing"
              : "use-existing-canonical"
        }))
      } satisfies SkillsDuplicateSummaryModel
    : null;

  return {
    inventorySummary: {
      totalCanonicalSkills: snapshot.summary.totalCanonicalSkills,
      totalReferenceNodes: snapshot.summary.totalReferenceNodes,
      totalSkillGraphNodes: snapshot.summary.totalSkillGraphNodes
    },
    inventoryEntries,
    promotionCandidates,
    duplicateSummary,
    skillGraphView: snapshot.skillGraph
      ? toGraphCanvasViewModel({
          mode: snapshot.skillGraph.canvas.mode,
          nodes: snapshot.skillGraph.nodes,
          edges: snapshot.skillGraph.edges
        })
      : null
  };
}
