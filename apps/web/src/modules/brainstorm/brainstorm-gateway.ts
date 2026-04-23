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
  BrainstormEdge,
  BrainstormEdgeKind,
  BrainstormNode,
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
  readonly tag?: string;
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

export interface UpdateBrainstormNodeInput {
  readonly canvasId: BrainstormCanvas["id"];
  readonly nodeId: BrainstormNode["id"];
  readonly label?: string;
  readonly tag?: string | null;
  readonly position?: BrainstormPosition;
  readonly parentNodeId?: BrainstormNode["parentNodeId"] | null;
  readonly description?: string | null;
}

export interface DeleteBrainstormNodeInput {
  readonly canvasId: BrainstormCanvas["id"];
  readonly nodeId: BrainstormNode["id"];
}

export interface DeleteBrainstormNodeResponse {
  readonly deletedNodeId: BrainstormNode["id"];
}

export interface CreateBrainstormEdgeInput {
  readonly canvasId: BrainstormCanvas["id"];
  readonly sourceNodeId: BrainstormNode["id"];
  readonly targetNodeId: BrainstormNode["id"];
  readonly kind?: Exclude<BrainstormEdgeKind, "contains">;
}

export interface CreateBrainstormEdgeResponse {
  readonly edge?: BrainstormEdge;
}

export interface DeleteBrainstormEdgeInput {
  readonly canvasId: BrainstormCanvas["id"];
  readonly edgeId: BrainstormEdge["id"];
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
  updateNode(
    input: UpdateBrainstormNodeInput
  ): Promise<CreateBrainstormNodeResponse>;
  deleteNode(
    input: DeleteBrainstormNodeInput
  ): Promise<DeleteBrainstormNodeResponse>;
  createEdge(
    input: CreateBrainstormEdgeInput
  ): Promise<CreateBrainstormEdgeResponse>;
  deleteEdge(
    input: DeleteBrainstormEdgeInput
  ): Promise<{ deletedEdgeId: BrainstormEdge["id"] }>;
}

function createFetchRequest(baseUrl: string, fetcher: typeof fetch) {
  return async function request<TPayload>(path: string, init?: RequestInit) {
    const response = await fetcher(`${baseUrl}${path}`, init);

    if (!response.ok) {
      let message = `Gateway request failed for ${path} with ${response.status}.`;
      try {
        const payload = (await response.json()) as {
          readonly message?: unknown;
          readonly error?: unknown;
        };
        const nestedError =
          typeof payload.error === "object" && payload.error !== null
            ? (payload.error as { readonly message?: unknown })
            : null;
        const payloadMessage =
          typeof payload.message === "string"
            ? payload.message
            : typeof nestedError?.message === "string"
              ? nestedError.message
              : null;
        if (payloadMessage) {
          message = payloadMessage;
        }
      } catch {
        // Keep the status fallback when the response body is not JSON.
      }
      throw new Error(message);
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
            role: input.role ?? "brainstorm",
            source: input.source ?? "user",
            position: input.position ?? {
              x: 0,
              y: 0
            },
            ...(input.tag !== undefined ? { tag: input.tag } : {}),
            ...(input.parentNodeId
              ? { parentNodeId: input.parentNodeId }
              : {}),
            ...(input.description ? { description: input.description } : {}),
            ...(input.metadata ? { metadata: input.metadata } : {})
          })
        }
      );
    },

    updateNode(input) {
      return request<CreateBrainstormNodeResponse>(
        `/api/v1/canvases/${input.canvasId}/nodes/${input.nodeId}`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            ...(input.label === undefined ? {} : { label: input.label }),
            ...(input.tag === undefined ? {} : { tag: input.tag }),
            ...(input.parentNodeId === undefined
              ? {}
              : { parentNodeId: input.parentNodeId }),
            ...(input.position === undefined ? {} : { position: input.position }),
            ...(input.description === undefined
              ? {}
              : { description: input.description })
          })
        }
      );
    },

    deleteNode(input) {
      return request<DeleteBrainstormNodeResponse>(
        `/api/v1/canvases/${input.canvasId}/nodes/${input.nodeId}`,
        {
          method: "DELETE"
        }
      );
    },

    createEdge(input) {
      return request<CreateBrainstormEdgeResponse>(
        `/api/v1/canvases/${input.canvasId}/edges`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sourceNodeId: input.sourceNodeId,
            targetNodeId: input.targetNodeId,
            kind: input.kind ?? "relates-to"
          })
        }
      );
    },

    deleteEdge(input) {
      return request<{ deletedEdgeId: BrainstormEdge["id"] }>(
        `/api/v1/canvases/${input.canvasId}/edges/${input.edgeId}`,
        {
          method: "DELETE"
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
