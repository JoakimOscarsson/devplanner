import { useEffect, useState, type FormEvent } from "react";
import type { ModuleCapability } from "@pdp-helper/ui-shell";
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
  const [localSnapshot, setLocalSnapshot] = useState<SkillsSnapshot | null>(
    snapshot ?? null
  );
  const [loading, setLoading] = useState(snapshot ? false : true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(feedback ?? null);
  const [queryLabel, setQueryLabel] = useState("TypeScript");

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
        const nextSnapshot = await loadSkillsSnapshot(
          createSkillsGatewayPort(gatewayBaseUrl),
          {
            initialLabelCheck: "TypeScript"
          }
        );

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
  }, [gatewayBaseUrl, snapshot]);

  const activeSnapshot = localSnapshot ?? EMPTY_SKILLS_SNAPSHOT;
  const model = buildSkillsPanelModel(activeSnapshot);
  const moduleStatus = module?.status ?? "unknown";
  const statusStyle =
    STATUS_STYLES[moduleStatus as keyof typeof STATUS_STYLES] ??
    STATUS_STYLES.unknown;

  async function handleDuplicateCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const label = queryLabel.trim();

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
        const duplicateCheck = await createSkillsGatewayPort(
          gatewayBaseUrl
        ).checkDuplicate({
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

  return (
    <article className="panel">
      <header className="panel-header">
        <h2>Skill graph module</h2>
        <p>
          Review canonical skills, then test whether a new label should become a
          new canonical node or a reference to an existing one.
        </p>
      </header>

      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          border: `1px solid ${statusStyle.borderColor}`,
          background: statusStyle.background,
          color: statusStyle.color,
          borderRadius: "999px",
          padding: "0.35rem 0.8rem",
          fontSize: "0.9rem",
          marginBottom: "1rem"
        }}
      >
        <strong>Status</strong>
        <span>{moduleStatus}</span>
      </div>

      <section style={{ display: "grid", gap: "0.75rem", marginBottom: "1rem" }}>
        <header>
          <h3 style={{ marginBottom: "0.25rem" }}>Canonical skill inventory</h3>
          <p style={{ margin: 0, color: "#57534e" }}>
            {model.inventorySummary.totalCanonicalSkills} canonical skills,{" "}
            {model.inventorySummary.totalReferenceNodes} reference nodes,{" "}
            {model.inventorySummary.totalSkillGraphNodes} skill-graph nodes in
            the current demo snapshot.
          </p>
        </header>

        {loading ? <p>Loading skill graph snapshot…</p> : null}

        <div style={{ display: "grid", gap: "0.75rem" }}>
          {model.inventoryEntries.map((entry) => (
            <article
              key={entry.skillId}
              style={{
                border: "1px solid #e7e5e4",
                borderRadius: "1rem",
                padding: "0.9rem 1rem",
                background: "#fafaf9"
              }}
            >
              <strong>{entry.canonicalLabel}</strong>
              <p style={{ margin: "0.35rem 0", color: "#57534e" }}>
                {entry.sourceSummary}
              </p>
              <p style={{ margin: 0, fontSize: "0.92rem", color: "#44403c" }}>
                {entry.referenceSummary}
              </p>
            </article>
          ))}

          {!loading && model.inventoryEntries.length === 0 ? (
            <p>No canonical skills are available yet.</p>
          ) : null}
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <header>
          <h3 style={{ marginBottom: "0.25rem" }}>Duplicate guidance</h3>
          <p style={{ margin: 0, color: "#57534e" }}>
            Use this check before creating a new skill node so the demo can show
            canonical-versus-reference decisions.
          </p>
        </header>

        <form
          onSubmit={handleDuplicateCheck}
          style={{ display: "grid", gap: "0.75rem" }}
        >
          <label style={{ display: "grid", gap: "0.35rem" }}>
            <span>Skill label to check</span>
            <input
              value={queryLabel}
              onChange={(event) => setQueryLabel(event.target.value)}
              placeholder="TypeScript"
              style={{
                borderRadius: "0.8rem",
                border: "1px solid #d6d3d1",
                padding: "0.7rem 0.85rem"
              }}
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            style={{
              justifySelf: "start",
              border: "none",
              borderRadius: "999px",
              padding: "0.7rem 1rem",
              background: "#0f766e",
              color: "white",
              fontWeight: 600,
              cursor: pending ? "wait" : "pointer"
            }}
          >
            {pending ? "Checking…" : "Check duplicate guidance"}
          </button>
        </form>

        {model.duplicateSummary ? (
          <article
            style={{
              border: "1px solid #d6d3d1",
              borderRadius: "1rem",
              padding: "1rem",
              background: "#ffffff"
            }}
          >
            <p style={{ marginTop: 0 }}>
              <strong>{model.duplicateSummary.strategyLabel}</strong>
            </p>
            <p>{model.duplicateSummary.guidance}</p>
            <p style={{ color: "#57534e", fontSize: "0.92rem" }}>
              Normalized label: {model.duplicateSummary.normalizedLabel}
              {model.duplicateSummary.exactMatch ? " · Exact match found" : ""}
            </p>
            <ul style={{ marginBottom: 0 }}>
              {model.duplicateSummary.candidateSummaries.map((candidateSummary) => (
                <li key={candidateSummary}>{candidateSummary}</li>
              ))}
            </ul>
          </article>
        ) : null}

        {error ? <p className="callout callout--error">{error}</p> : null}
        {localFeedback ? <p className="callout">{localFeedback}</p> : null}
      </section>
    </article>
  );
}
