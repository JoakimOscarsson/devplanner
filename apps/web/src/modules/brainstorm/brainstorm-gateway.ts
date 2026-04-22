import { GatewayClient } from "@pdp-helper/runtime-web";
import {
  type BrainstormCanvasGraph,
  type BrainstormSnapshot,
  compareCanvases,
  getBrainstormCanvases
} from "./brainstorm-model";
import type {
  BrainstormCanvas,
  BrainstormCanvasMode,
  BrainstormNode,
  BrainstormNodeCategory,
  BrainstormNodeRole,
  BrainstormNodeSource,
  BrainstormPosition
} from "./brainstorm-types";

export interface BrainstormCanvasesResponse {
  readonly canvases: readonly BrainstormCanvas[];
  readonly workspaceId?: string;
}

export interface CreateBrainstormCanvasInput {
  readonly name: string;
  readonly mode?: BrainstormCanvasMode;
  readonly sortOrder?: number;
}

export interface CreateBrainstormCanvasResponse {
  readonly canvas?: BrainstormCanvas;
}

export interface CreateBrainstormNodeInput {
  readonly canvasId: BrainstormCanvas["id"];
  readonly label: string;
  readonly category: BrainstormNodeCategory;
  readonly role?: BrainstormNodeRole;
  readonly position?: BrainstormPosition;
  readonly source?: BrainstormNodeSource;
  readonly parentNodeId?: BrainstormNode["parentNodeId"];
  readonly description?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface CreateBrainstormNodeResponse {
  readonly node?: BrainstormNode;
}

export interface BrainstormGatewayPort {
  listCanvases(): Promise<BrainstormCanvasesResponse>;
  getCanvasGraph(canvasId: BrainstormCanvas["id"]): Promise<BrainstormCanvasGraph>;
  createCanvas(
    input: CreateBrainstormCanvasInput
  ): Promise<CreateBrainstormCanvasResponse>;
  createNode(
    input: CreateBrainstormNodeInput
  ): Promise<CreateBrainstormNodeResponse>;
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

export function createBrainstormGatewayPort(
  baseUrl: string,
  fetcher: typeof fetch = fetch
): BrainstormGatewayPort {
  const client = fetcher === fetch ? new GatewayClient(baseUrl) : null;
  const request =
    client
      ? client.request.bind(client)
      : createFetchRequest(baseUrl, fetcher);

  return {
    listCanvases() {
      return request<BrainstormCanvasesResponse>("/api/v1/canvases");
    },

    getCanvasGraph(canvasId) {
      return request<BrainstormCanvasGraph>(`/api/v1/canvases/${canvasId}/graph`);
    },

    createCanvas(input) {
      return request<CreateBrainstormCanvasResponse>("/api/v1/canvases", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          name: input.name,
          mode: input.mode ?? "brainstorm",
          ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder })
        })
      });
    },

    createNode(input) {
      return request<CreateBrainstormNodeResponse>(
        `/api/v1/canvases/${input.canvasId}/nodes`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            label: input.label,
            category: input.category,
            role: input.role ?? "brainstorm",
            source: input.source ?? "user",
            position: input.position ?? {
              x: 0,
              y: 0
            },
            ...(input.parentNodeId
              ? { parentNodeId: input.parentNodeId }
              : {}),
            ...(input.description ? { description: input.description } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {})
          })
        }
      );
    }
  };
}

export async function loadBrainstormSnapshot(
  gateway: Pick<BrainstormGatewayPort, "listCanvases" | "getCanvasGraph">,
  options: {
    readonly selectedCanvasId?: BrainstormCanvas["id"];
  } = {}
): Promise<BrainstormSnapshot> {
  const response = await gateway.listCanvases();
  const canvases = [...response.canvases].sort(compareCanvases);
  const brainstormCanvases = getBrainstormCanvases(canvases);
  const preferredSelectedCanvasId = options.selectedCanvasId;
  const selectedCanvasId = brainstormCanvases.some(
    (canvas: BrainstormCanvas) => canvas.id === preferredSelectedCanvasId
  )
    ? preferredSelectedCanvasId
    : brainstormCanvases[0]?.id;

  if (!selectedCanvasId) {
    return {
      canvases,
      graphsByCanvasId: {}
    };
  }

  const selectedGraph = await gateway.getCanvasGraph(selectedCanvasId);

  return {
    canvases,
    graphsByCanvasId: {
      [selectedCanvasId]: selectedGraph
    },
    selectedCanvasId
  };
}
