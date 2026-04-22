import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
import { GraphCanvasSurface } from "../../lib/GraphCanvasSurface";
import { gatewayUrl } from "../../lib/gateway";
import {
  createSkillsGatewayPort,
  loadSkillsSnapshot,
  type CheckDuplicateInput,
  type SkillsSnapshot
} from "./skills-gateway";
import {
  buildSkillsPanelModel,
  EMPTY_SKILLS_SNAPSHOT
} from "./skills-model";

export interface SkillsSpotlightProps {
  readonly module?: ModuleCapability;
  readonly gatewayBaseUrl?: string;
  readonly snapshot?: SkillsSnapshot;
  readonly feedback?: string | null;
  readonly onCheckDuplicate?: (
    input: CheckDuplicateInput
  ) => Promise<unknown> | unknown;
}

const STATUS_STYLES = {
  up: {
    background: "#ecfdf5",
    borderColor: "#86efac",
    color: "#166534"
  },
  degraded: {
    background: "#fff7ed",
    borderColor: "#fdba74",
    color: "#9a3412"
  },
  down: {
    background: "#fef2f2",
    borderColor: "#fca5a5",
    color: "#991b1b"
  },
  unknown: {
    background: "#f5f5f4",
    borderColor: "#d6d3d1",
    color: "#44403c"
  }
} as const;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unable to load skill graph data.";
}

export function SkillsSpotlight({
  module,
  gatewayBaseUrl = gatewayUrl,
  snapshot,
  feedback,
  onCheckDuplicate
}: SkillsSpotlightProps) {
  const gateway = useMemo(
    () => createSkillsGatewayPort(gatewayBaseUrl),
    [gatewayBaseUrl]
  );
  const [localSnapshot, setLocalSnapshot] = useState<SkillsSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(feedback ?? null);
  const [queryLabel, setQueryLabel] = useState("TypeScript");
  const [selectedCandidateNodeId, setSelectedCandidateNodeId] = useState<string | null>(null);
  const [referenceSkillId, setReferenceSkillId] = useState<string>("");
  const [referenceLabel, setReferenceLabel] = useState("Practice TypeScript in project work");

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    setLocalSnapshot(snapshot);
    setLoading(false);
    setError(null);
  }, [snapshot]);

  useEffect(() => {
    setLocalFeedback(feedback ?? null);
  }, [feedback]);

  useEffect(() => {
    if (snapshot) {
      return;
    }

    let active = true;

    async function load() {
      setLoading(true);

      try {
        const nextSnapshot = await loadSkillsSnapshot(gateway, {
          initialLabelCheck: "TypeScript"
        });

        if (!active) {
          return;
        }

        setLocalSnapshot(nextSnapshot);
        setError(null);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(getErrorMessage(requestError));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [gateway, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_SKILLS_SNAPSHOT;
  const model = buildSkillsPanelModel(activeSnapshot);
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ??
    STATUS_STYLES.unknown;
  const selectedPromotionCandidate =
    activeSnapshot.promotionCandidates?.find(
      (candidate) => candidate.nodeId === selectedCandidateNodeId
    ) ?? activeSnapshot.promotionCandidates?.[0];

  useEffect(() => {
    if (!activeSnapshot.inventory[0]?.skillId) {
      return;
    }

    setReferenceSkillId((current) => current || activeSnapshot.inventory[0]!.skillId);
  }, [activeSnapshot.inventory]);

  async function refreshSnapshot(initialLabelCheck?: string) {
    const nextSnapshot = await loadSkillsSnapshot(gateway, {
      ...(initialLabelCheck ? { initialLabelCheck } : {})
    });
    setLocalSnapshot(nextSnapshot);
  }

  async function handleDuplicateCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runDuplicateCheck(queryLabel);
  }

  async function runDuplicateCheck(rawLabel: string) {
    const label = rawLabel.trim();

    if (!label) {
      return;
    }

    setPending(true);
    setError(null);
    setLocalFeedback(null);

    try {
      if (onCheckDuplicate) {
        await onCheckDuplicate({ label });
      } else {
        const duplicateCheck = await gateway.checkDuplicate({
          label
        });

        setLocalSnapshot((current) => ({
          ...(current ?? EMPTY_SKILLS_SNAPSHOT),
          duplicateCheck
        }));
      }

      setLocalFeedback(`Duplicate guidance loaded for "${label}".`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  async function runPromotionWorkflow(action: "promote" | "resolve", skillId?: string) {
    if (!selectedPromotionCandidate) {
      setLocalFeedback("Choose a brainstorm node first.");
      return;
    }

    setPending(true);
    setError(null);

    try {
      if (action === "promote") {
        await gateway.promote({
          nodeId: selectedPromotionCandidate.nodeId
        });
        await refreshSnapshot(selectedPromotionCandidate.label);
        setLocalFeedback(`Promoted "${selectedPromotionCandidate.label}" into the skill tree.`);
      } else if (skillId && activeSnapshot.duplicateCheck) {
        const matchingCandidate = activeSnapshot.duplicateCheck.candidates.find(
          (candidate) => candidate.skillId === skillId
        );

        await gateway.resolveDuplicate({
          nodeId: selectedPromotionCandidate.nodeId,
          canonicalSkillId: skillId as never,
          strategy:
            matchingCandidate?.matchKind === "exact"
              ? "create-reference-to-existing"
              : "use-existing-canonical"
        });
        await refreshSnapshot(selectedPromotionCandidate.label);
        setLocalFeedback(`Resolved "${selectedPromotionCandidate.label}" against the existing skill.`);
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  async function handleCreateReference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = referenceLabel.trim();

    if (!label || !referenceSkillId) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      await gateway.createReference({
        skillId: referenceSkillId as never,
        canvasId: "can_skill_graph" as never,
        label
      });
      await refreshSnapshot(activeSnapshot.duplicateCheck?.queryLabel);
      setLocalFeedback(`Added a new reference node for "${label}".`);
      setReferenceLabel("");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="panel">
      <header className="panel-header">
        <div className="module-header">
          <div>
            <h2>Skill tree</h2>
            <p>
              Review the live skill graph, choose brainstorm nodes to promote, and resolve
              duplicate skills before they fragment the tree.
            </p>
          </div>
          <div
            style={{
              border: `1px solid ${statusStyle.borderColor}`,
              background: statusStyle.background,
              color: statusStyle.color
            }}
            className="status-pill"
          >
            {moduleStatus}
          </div>
        </div>
      </header>

      <div className="workspace-layout">
        <aside className="workspace-sidebar">
          <section className="workspace-card workspace-card--sidebar">
            <div className="workspace-card__header">
              <strong>Canonical skill inventory</strong>
              <p>
                {model.inventorySummary.totalCanonicalSkills} canonical skills,{" "}
                {model.inventorySummary.totalReferenceNodes} references,{" "}
                {model.inventorySummary.totalSkillGraphNodes} visible graph nodes.
              </p>
            </div>
            {loading ? <p className="callout">Loading skill graph snapshot…</p> : null}
            {error ? <p className="callout callout--error">{error}</p> : null}
            {localFeedback ? <p className="callout">{localFeedback}</p> : null}

            <div className="stack-list">
              {model.inventoryEntries.map((entry) => (
                <div key={entry.skillId} className="stack-list__card">
                  <strong>{entry.canonicalLabel}</strong>
                  <span>{entry.sourceSummary}</span>
                  <span>{entry.referenceSummary}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-card workspace-card--sidebar">
            <div className="workspace-card__header">
              <strong>Promotion candidates</strong>
              <p>These brainstorm nodes can become canonical skills or references.</p>
            </div>

            <div className="stack-list">
              {model.promotionCandidates.map((candidate) => (
                <button
                  key={candidate.nodeId}
                  type="button"
                  className={
                    selectedPromotionCandidate?.nodeId === candidate.nodeId
                      ? "stack-list__item stack-list__item--active"
                      : "stack-list__item"
                  }
                  onClick={() => {
                    setSelectedCandidateNodeId(candidate.nodeId);
                    setQueryLabel(candidate.label);
                    void runDuplicateCheck(candidate.label);
                  }}
                >
                  <span>{candidate.label}</span>
                  <span>{candidate.locationSummary}</span>
                </button>
              ))}
            </div>

            <div className="segmented-actions">
              <button
                type="button"
                onClick={() => void runPromotionWorkflow("promote")}
                disabled={pending || !selectedPromotionCandidate}
              >
                Promote to canonical
              </button>
            </div>
          </section>
        </aside>

        <section className="workspace-main">
          <div className="workspace-summary">
            <div className="summary-chip">
              <strong>Skill graph preview</strong>
              <span>The current canonical tree and references.</span>
            </div>
            <div className="summary-chip">
              <strong>
                {selectedPromotionCandidate?.label ?? "No brainstorm node selected"}
              </strong>
              <span>
                {selectedPromotionCandidate
                  ? `Source: ${selectedPromotionCandidate.canvasName}`
                  : "Choose a node to run duplicate checks."}
              </span>
            </div>
          </div>

          <GraphCanvasSurface
            title="Skill tree"
            nodes={model.skillGraphView?.nodes ?? []}
            edges={model.skillGraphView?.edges ?? []}
            emptyMessage="Promote a brainstorm node to start building the skill tree."
            readOnly
          />

          <div className="workspace-grid workspace-grid--two-up">
            <section className="workspace-card">
              <div className="workspace-card__header">
                <strong>Duplicate guidance</strong>
                <p>Check the selected brainstorm node before creating a new canonical skill.</p>
              </div>
              <form className="stack-form" onSubmit={(event) => void handleDuplicateCheck(event)}>
                <label className="stack-form__field">
                  <span>Skill label to check</span>
                  <input
                    value={queryLabel}
                    onChange={(event) => setQueryLabel(event.target.value)}
                    placeholder="TypeScript"
                  />
                </label>
                <button type="submit" disabled={pending}>
                  {pending ? "Checking..." : "Check duplicate guidance"}
                </button>
              </form>

              {model.duplicateSummary ? (
                <div className="decision-panel">
                  <strong>{model.duplicateSummary.strategyLabel}</strong>
                  <p>{model.duplicateSummary.guidance}</p>
                  <p className="section-kicker">Decision checklist</p>
                  <div className="stack-list">
                    {model.duplicateSummary.candidateModels.map((candidate) => (
                      <button
                        key={candidate.skillId}
                        type="button"
                        className="stack-list__item"
                        onClick={() => void runPromotionWorkflow("resolve", candidate.skillId)}
                        disabled={pending || !selectedPromotionCandidate}
                      >
                        <span>{candidate.canonicalLabel}</span>
                        <span>{candidate.summary}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="muted-copy">Run a duplicate check to see candidate strategies.</p>
              )}
            </section>

            <section className="workspace-card">
              <div className="workspace-card__header">
                <strong>Add reference node</strong>
                <p>Create an explicit reference node in the skill graph.</p>
              </div>

              <form className="stack-form" onSubmit={(event) => void handleCreateReference(event)}>
                <label className="stack-form__field">
                  <span>Canonical skill</span>
                  <select
                    value={referenceSkillId}
                    onChange={(event) => setReferenceSkillId(event.target.value)}
                  >
                    {activeSnapshot.inventory.map((entry) => (
                      <option key={entry.skillId} value={entry.skillId}>
                        {entry.canonicalLabel}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="stack-form__field">
                  <span>Reference label</span>
                  <input
                    value={referenceLabel}
                    onChange={(event) => setReferenceLabel(event.target.value)}
                    placeholder="Practice TypeScript in project work"
                  />
                </label>
                <button type="submit" disabled={pending || !referenceSkillId}>
                  Create reference node
                </button>
              </form>
            </section>
          </div>
        </section>
      </div>
    </article>
  );
}
