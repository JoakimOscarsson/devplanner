import type {
  Canvas,
  GraphEdge,
  GraphNode,
  GraphNodeCategory,
  Skill
} from "@pdp-helper/contracts-graph";
import { ID_PREFIXES } from "@pdp-helper/contracts-core";
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

export interface SkillGraphSnapshot {
  readonly canvas: Canvas;
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
}

export interface SkillsInventoryResponse {
  readonly inventory: readonly SkillInventoryEntry[];
  readonly summary: {
    readonly totalCanonicalSkills: number;
    readonly totalReferenceNodes: number;
    readonly totalSkillGraphNodes: number;
  };
  readonly skillGraph?: SkillGraphSnapshot;
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

export interface PromoteSkillInput {
  readonly nodeId: GraphNode["id"];
  readonly preferredSkillId?: Skill["id"];
}

export interface ResolveDuplicateInput {
  readonly nodeId: GraphNode["id"];
  readonly canonicalSkillId: Skill["id"];
  readonly strategy: "use-existing-canonical" | "create-reference-to-existing";
}

export interface CreateSkillReferenceInput {
  readonly skillId: Skill["id"];
  readonly canvasId: Canvas["id"];
  readonly label: string;
  readonly position?: GraphNode["position"];
}

export interface PromotionCandidate {
  readonly nodeId: GraphNode["id"];
  readonly canvasId: Canvas["id"];
  readonly canvasName: string;
  readonly label: string;
  readonly category: GraphNodeCategory;
  readonly parentNodeId?: GraphNode["parentNodeId"];
}

export interface CheckDuplicateInput {
  readonly label: string;
}

export interface SkillsGatewayPort {
  getInventory(): Promise<SkillsInventoryResponse>;
  getSkillGraph(): Promise<SkillGraphSnapshot>;
  listPromotionCandidates(): Promise<readonly PromotionCandidate[]>;
  checkDuplicate(input: CheckDuplicateInput): Promise<DuplicateSkillCheckResult>;
  promote(input: PromoteSkillInput): Promise<unknown>;
  resolveDuplicate(input: ResolveDuplicateInput): Promise<unknown>;
  createReference(input: CreateSkillReferenceInput): Promise<unknown>;
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

function buildPreferredSkillId() {
  return `${ID_PREFIXES.skill}_${crypto.randomUUID().replaceAll("-", "")}` as Skill["id"];
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

    getSkillGraph() {
      return request<SkillGraphSnapshot>("/api/v1/canvases/can_skill_graph/graph");
    },

    async listPromotionCandidates() {
      const canvasesResponse = await request<{ canvases: readonly Canvas[] }>("/api/v1/canvases");
      const brainstormCanvases = canvasesResponse.canvases.filter(
        (canvas) => canvas.mode === "brainstorm"
      );
      const graphs = await Promise.all(
        brainstormCanvases.map(async (canvas) => ({
          canvas,
          graph: await request<SkillGraphSnapshot>(`/api/v1/canvases/${canvas.id}/graph`)
        }))
      );

      return graphs.flatMap(({ canvas, graph }) =>
        graph.nodes
          .filter((node) => node.role === "brainstorm" && node.category !== "recommendation")
          .map(
            (node) =>
              ({
                nodeId: node.id,
                canvasId: canvas.id,
                canvasName: canvas.name,
                label: node.label,
                category: node.category,
                parentNodeId: node.parentNodeId
              }) satisfies PromotionCandidate
          )
      );
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
    },

    promote(input) {
      return request("/api/v1/skills/promote", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          nodeId: input.nodeId,
          preferredSkillId: input.preferredSkillId ?? buildPreferredSkillId()
        })
      });
    },

    resolveDuplicate(input) {
      return request("/api/v1/skills/resolve-duplicate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(input)
      });
    },

    createReference(input) {
      return request(`/api/v1/skills/${input.skillId}/references`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          canvasId: input.canvasId,
          label: input.label,
          ...(input.position ? { position: input.position } : {})
        })
      });
    }
  };
}

export interface SkillsSnapshot {
  readonly inventory: readonly SkillInventoryEntry[];
  readonly summary: SkillsInventoryResponse["summary"];
  readonly promotionCandidates?: readonly PromotionCandidate[];
  readonly duplicateCheck?: DuplicateSkillCheckResult;
  readonly skillGraph?: SkillGraphSnapshot;
}

export async function loadSkillsSnapshot(
  gateway: Pick<
    SkillsGatewayPort,
    "getInventory" | "checkDuplicate"
  > &
    Partial<
      Pick<SkillsGatewayPort, "getSkillGraph" | "listPromotionCandidates">
    >,
  options: {
    readonly initialLabelCheck?: string;
  } = {}
): Promise<SkillsSnapshot> {
  const inventoryResponse = await gateway.getInventory();
  const skillGraph =
    inventoryResponse.skillGraph ??
    (typeof gateway.getSkillGraph === "function"
      ? await gateway.getSkillGraph()
      : undefined);
  const promotionCandidates =
    typeof gateway.listPromotionCandidates === "function"
      ? await gateway.listPromotionCandidates()
      : [];

  const duplicateCheck = options.initialLabelCheck?.trim()
    ? await gateway.checkDuplicate({
        label: options.initialLabelCheck
      })
    : undefined;

  return {
    inventory: inventoryResponse.inventory,
    summary: inventoryResponse.summary,
    skillGraph,
    promotionCandidates,
    ...(duplicateCheck ? { duplicateCheck } : {})
  };
}
