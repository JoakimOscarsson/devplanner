import { GatewayClient } from "@pdp-helper/runtime-web";

export interface SkillInventoryEntry {
  readonly skillId: string;
  readonly canonicalLabel: string;
  readonly normalizedLabel: string;
  readonly sourceNodeId?: string;
  readonly sourceNodeLabel?: string;
  readonly sourceCanvasId?: string;
  readonly sourceCanvasName?: string;
  readonly referenceCount: number;
}

export interface SkillsInventoryResponse {
  readonly inventory: readonly SkillInventoryEntry[];
  readonly summary: {
    readonly totalCanonicalSkills: number;
    readonly totalReferenceNodes: number;
    readonly totalSkillGraphNodes: number;
  };
}

export interface DuplicateSkillCandidate {
  readonly skillId: string;
  readonly canonicalLabel: string;
  readonly normalizedLabel: string;
  readonly sourceNodeId?: string;
  readonly sourceNodeLabel?: string;
  readonly sourceCanvasName?: string;
  readonly similarityScore: number;
  readonly referenceCount: number;
  readonly matchKind: "exact" | "related";
}

export interface DuplicateSkillCheckResult {
  readonly queryLabel: string;
  readonly normalizedLabel: string;
  readonly exactMatch: boolean;
  readonly suggestedStrategy:
    | "use-existing-canonical"
    | "create-reference-to-existing"
    | "create-new-canonical";
  readonly guidance: string;
  readonly candidates: readonly DuplicateSkillCandidate[];
  readonly summary: {
    readonly totalCanonicalSkills: number;
    readonly totalReferenceNodes: number;
    readonly totalCandidates: number;
    readonly exactMatchCount: number;
  };
}

export interface CheckDuplicateInput {
  readonly label: string;
}

export interface SkillsGatewayPort {
  getInventory(): Promise<SkillsInventoryResponse>;
  checkDuplicate(input: CheckDuplicateInput): Promise<DuplicateSkillCheckResult>;
}

function createFetchRequest(baseUrl: string, fetcher: typeof fetch) {
  return async function request<TPayload>(path: string, init?: RequestInit) {
    const response = await fetcher(`${baseUrl}${path}`, init);

    if (!response.ok) {
      throw new Error(`Gateway request failed for ${path} with ${response.status}.`);
    }

    return (await response.json()) as TPayload;
  };
}

export function createSkillsGatewayPort(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): SkillsGatewayPort {
  const client = fetcher === fetch ? new GatewayClient(baseUrl) : null;
  const request =
    client
      ? client.request.bind(client)
      : createFetchRequest(baseUrl, fetcher);

  return {
    getInventory() {
      return request<SkillsInventoryResponse>("/api/v1/skills");
    },

    checkDuplicate(input) {
      return request<DuplicateSkillCheckResult>("/api/v1/skills/check-duplicate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          label: input.label
        })
      });
    }
  };
}

export interface SkillsSnapshot {
  readonly inventory: readonly SkillInventoryEntry[];
  readonly summary: SkillsInventoryResponse["summary"];
  readonly duplicateCheck?: DuplicateSkillCheckResult;
}

export async function loadSkillsSnapshot(
  gateway: SkillsGatewayPort,
  options: {
    readonly initialLabelCheck?: string;
  } = {}
): Promise<SkillsSnapshot> {
  const inventoryResponse = await gateway.getInventory();

  const duplicateCheck = options.initialLabelCheck?.trim()
    ? await gateway.checkDuplicate({
        label: options.initialLabelCheck
      })
    : undefined;

  return {
    inventory: inventoryResponse.inventory,
    summary: inventoryResponse.summary,
    ...(duplicateCheck ? { duplicateCheck } : {})
  };
}
