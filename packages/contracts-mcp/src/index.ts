import { z } from "zod";
import {
  ApiKeyProfileSchema,
  IsoDateTimeSchema,
  JsonObjectSchema,
  createDomainEventEnvelopeSchema,
  API_KEY_PROFILE_VALUES,
  makeEventSubject,
  type ApiKeyProfile,
  type DomainError,
  type DomainEventEnvelope,
  type IsoDateTime,
  type JsonObject
} from "@pdp-helper/contracts-core";
import type {
  Canvas,
  CreateGraphNodeCommandPayload,
  GetCanvasQueryParams,
  GetCanvasSubgraphQueryParams,
  GetSkillGraphQueryParams,
  GraphEdge,
  GraphNode,
  ListCanvasesQueryParams,
  SearchDuplicateSkillCandidatesQueryParams,
  Skill
} from "@pdp-helper/contracts-graph";
import type {
  AddEvidenceNoteCommandPayload,
  CreateGoalCommandPayload,
  GetGoalPlanQueryParams,
  GetGoalQueryParams,
  Goal,
  ListGoalsQueryParams,
  PlanItem
} from "@pdp-helper/contracts-planner";
import type {
  AcceptedRecommendationDecision,
  AcceptRecommendationCommandPayload,
  DeniedRecommendationDecision,
  DenyRecommendationCommandPayload,
  GetProviderHealthQueryParams,
  GetRecommendationFeedQueryParams,
  IngestExternalRecommendationCommandPayload,
  ProviderHealth,
  Recommendation
} from "@pdp-helper/contracts-recommendation";

export const MCP_SCOPE_VALUES = API_KEY_PROFILE_VALUES;
export type McpScope = ApiKeyProfile;

export const MCP_TOOL_NAMES = [
  "graph.list_canvases",
  "graph.get_canvas",
  "graph.get_canvas_subgraph",
  "graph.get_skill_graph",
  "graph.search_duplicate_skills",
  "graph.create_node",
  "planner.list_goals",
  "planner.get_goal",
  "planner.get_goal_plan",
  "planner.create_goal",
  "planner.add_evidence_note",
  "recommendation.get_feed",
  "recommendation.get_provider_health",
  "recommendation.submit",
  "recommendation.accept",
  "recommendation.deny"
] as const;
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];

export interface McpToolDefinition<
  TName extends McpToolName = McpToolName,
  TInput extends object = JsonObject,
  TOutput extends object = JsonObject
> {
  name: TName;
  version: "v1";
  minimumScope: McpScope;
  description: string;
  inputExample: TInput;
  outputExample: TOutput;
}

export interface ListCanvasesToolInput extends ListCanvasesQueryParams {}

export interface ListCanvasesToolOutput {
  canvases: Canvas[];
}

export interface GetCanvasToolInput extends GetCanvasQueryParams {}

export interface GetCanvasToolOutput {
  canvas: Canvas;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GetCanvasSubgraphToolInput
  extends GetCanvasSubgraphQueryParams {}

export interface GetCanvasSubgraphToolOutput {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GetSkillGraphToolInput extends GetSkillGraphQueryParams {}

export interface GetSkillGraphToolOutput {
  skills: Skill[];
  referenceNodes: GraphNode[];
}

export interface SearchDuplicateSkillsToolInput
  extends SearchDuplicateSkillCandidatesQueryParams {}

export interface SearchDuplicateSkillsToolOutput {
  candidates: {
    skillId: string;
    canonicalLabel: string;
    similarityScore: number;
  }[];
}

export interface CreateNodeToolInput extends CreateGraphNodeCommandPayload {}

export interface CreateNodeToolOutput {
  accepted: true;
  nodeId: string;
}

export interface ListGoalsToolInput extends ListGoalsQueryParams {}

export interface ListGoalsToolOutput {
  goals: Goal[];
}

export interface GetGoalToolInput extends GetGoalQueryParams {}

export interface GetGoalToolOutput {
  goal: Goal;
}

export interface GetGoalPlanToolInput extends GetGoalPlanQueryParams {}

export interface GetGoalPlanToolOutput {
  goal: Goal;
  planItems: PlanItem[];
}

export interface CreateGoalToolInput extends CreateGoalCommandPayload {}

export interface CreateGoalToolOutput {
  accepted: true;
  goalId: string;
}

export interface AddEvidenceNoteToolInput extends AddEvidenceNoteCommandPayload {}

export interface AddEvidenceNoteToolOutput {
  accepted: true;
  evidenceNoteId: string;
}

export interface GetRecommendationFeedToolInput
  extends GetRecommendationFeedQueryParams {}

export interface GetRecommendationFeedToolOutput {
  recommendations: Recommendation[];
}

export interface GetProviderHealthToolInput extends GetProviderHealthQueryParams {}

export interface GetProviderHealthToolOutput {
  providers: ProviderHealth[];
}

export interface SubmitRecommendationToolInput
  extends IngestExternalRecommendationCommandPayload {}

export interface SubmitRecommendationToolOutput {
  accepted: true;
  recommendationId: string;
}

export interface AcceptRecommendationToolInput
  extends AcceptRecommendationCommandPayload {}

export interface AcceptRecommendationToolOutput {
  accepted: true;
  decision: AcceptedRecommendationDecision;
}

export interface DenyRecommendationToolInput
  extends DenyRecommendationCommandPayload {}

export interface DenyRecommendationToolOutput {
  accepted: true;
  decision: DeniedRecommendationDecision;
}

export const MCP_TOOL_DEFINITIONS: readonly McpToolDefinition[] = [
  {
    name: "graph.list_canvases",
    version: "v1",
    minimumScope: "read-only",
    description: "List brainstorm or skill-graph canvases.",
    inputExample: {},
    outputExample: {
      canvases: []
    }
  },
  {
    name: "graph.get_canvas",
    version: "v1",
    minimumScope: "read-only",
    description: "Fetch a full canvas with nodes and edges.",
    inputExample: {
      canvasId: "can_example"
    },
    outputExample: {
      canvas: {
        id: "can_example",
        name: "My brainstorm",
        mode: "brainstorm",
        sortOrder: 0
      },
      nodes: [],
      edges: []
    }
  },
  {
    name: "graph.get_canvas_subgraph",
    version: "v1",
    minimumScope: "read-only",
    description: "Fetch a bounded subgraph for a root node.",
    inputExample: {
      canvasId: "can_example",
      depth: 2
    },
    outputExample: {
      nodes: [],
      edges: []
    }
  },
  {
    name: "graph.get_skill_graph",
    version: "v1",
    minimumScope: "read-only",
    description: "Fetch canonical skills plus optional references.",
    inputExample: {
      canvasId: "can_skills",
      includeReferences: true
    },
    outputExample: {
      skills: [],
      referenceNodes: []
    }
  },
  {
    name: "graph.search_duplicate_skills",
    version: "v1",
    minimumScope: "read-only",
    description: "Search for duplicate canonical skill candidates.",
    inputExample: {
      normalizedLabel: "typescript",
      limit: 5
    },
    outputExample: {
      candidates: []
    }
  },
  {
    name: "graph.create_node",
    version: "v1",
    minimumScope: "read+edit",
    description: "Create a graph node directly.",
    inputExample: {
      nodeId: "nod_example",
      canvasId: "can_example",
      role: "brainstorm",
      category: "project",
      label: "Build PDP Helper",
      position: {
        x: 0,
        y: 0
      },
      source: "external-tool"
    },
    outputExample: {
      accepted: true,
      nodeId: "nod_example"
    }
  },
  {
    name: "planner.list_goals",
    version: "v1",
    minimumScope: "read-only",
    description: "List goals visible to the calling workspace.",
    inputExample: {},
    outputExample: {
      goals: []
    }
  },
  {
    name: "planner.get_goal",
    version: "v1",
    minimumScope: "read-only",
    description: "Fetch a single goal.",
    inputExample: {
      goalId: "gol_example"
    },
    outputExample: {
      goal: {
        id: "gol_example",
        title: "Become more effective",
        status: "active"
      }
    }
  },
  {
    name: "planner.get_goal_plan",
    version: "v1",
    minimumScope: "read-only",
    description: "Fetch a goal with its plan items.",
    inputExample: {
      goalId: "gol_example",
      includeEvidence: true
    },
    outputExample: {
      goal: {
        id: "gol_example",
        title: "Become more effective",
        status: "active"
      },
      planItems: []
    }
  },
  {
    name: "planner.create_goal",
    version: "v1",
    minimumScope: "read+edit",
    description: "Create a goal directly from an MCP client.",
    inputExample: {
      goalId: "gol_example",
      title: "Improve system design"
    },
    outputExample: {
      accepted: true,
      goalId: "gol_example"
    }
  },
  {
    name: "planner.add_evidence_note",
    version: "v1",
    minimumScope: "read+edit",
    description: "Attach an evidence note to a goal or plan item.",
    inputExample: {
      evidenceNoteId: "env_example",
      goalId: "gol_example",
      body: "Completed the architecture review."
    },
    outputExample: {
      accepted: true,
      evidenceNoteId: "env_example"
    }
  },
  {
    name: "recommendation.get_feed",
    version: "v1",
    minimumScope: "read-only",
    description: "Read pending or historical recommendations.",
    inputExample: {
      status: "pending"
    },
    outputExample: {
      recommendations: []
    }
  },
  {
    name: "recommendation.get_provider_health",
    version: "v1",
    minimumScope: "read-only",
    description: "Inspect provider health for built-in or external recommenders.",
    inputExample: {},
    outputExample: {
      providers: []
    }
  },
  {
    name: "recommendation.submit",
    version: "v1",
    minimumScope: "read+recommend",
    description: "Submit a recommendation without directly mutating core entities.",
    inputExample: {
      recommendationId: "rec_example",
      runId: "rrn_example",
      origin: "external-tool",
      action: "create-node",
      title: "Consider a leadership course",
      target: {
        targetKind: "goal",
        goalId: "gol_example"
      },
      payload: {}
    },
    outputExample: {
      accepted: true,
      recommendationId: "rec_example"
    }
  },
  {
    name: "recommendation.accept",
    version: "v1",
    minimumScope: "read+recommend",
    description: "Accept an existing recommendation through the adapter.",
    inputExample: {
      recommendationId: "rec_example"
    },
    outputExample: {
      accepted: true,
      decision: {
        recommendationId: "rec_example",
        decision: "accepted"
      }
    }
  },
  {
    name: "recommendation.deny",
    version: "v1",
    minimumScope: "read+recommend",
    description: "Deny an existing recommendation through the adapter.",
    inputExample: {
      recommendationId: "rec_example"
    },
    outputExample: {
      accepted: true,
      decision: {
        recommendationId: "rec_example",
        decision: "denied"
      }
    }
  }
] as const;

export interface McpAuditEntry {
  id: string;
  toolName: McpToolName;
  scope: McpScope;
  status: "accepted" | "denied" | "completed";
  requestedAt: IsoDateTime;
  completedAt?: IsoDateTime;
  reason?: string;
  inputSummary?: JsonObject;
}

export const McpScopeSchema = ApiKeyProfileSchema;
export const McpToolNameSchema = z.enum(MCP_TOOL_NAMES);

export const McpAuditEntrySchema = z.object({
  id: z.string().min(1),
  toolName: McpToolNameSchema,
  scope: McpScopeSchema,
  status: z.enum(["accepted", "denied", "completed"]),
  requestedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.optional(),
  reason: z.string().min(1).optional(),
  inputSummary: JsonObjectSchema.optional()
});

export const MCP_EVENT_SUBJECTS = {
  toolInvoked: makeEventSubject("mcp", "tool", "invoked"),
  policyDenied: makeEventSubject("mcp", "policy", "denied"),
  toolCompleted: makeEventSubject("mcp", "tool", "completed")
} as const;

export const MCP_EVENT_NAMES = [
  MCP_EVENT_SUBJECTS.toolInvoked,
  MCP_EVENT_SUBJECTS.policyDenied,
  MCP_EVENT_SUBJECTS.toolCompleted
] as const;
export type McpEventName = (typeof MCP_EVENT_NAMES)[number];

export type McpToolInvokedEvent = DomainEventEnvelope<
  (typeof MCP_EVENT_SUBJECTS)["toolInvoked"],
  {
    toolName: McpToolName;
    scope: McpScope;
  }
>;

export type McpPolicyDeniedEvent = DomainEventEnvelope<
  (typeof MCP_EVENT_SUBJECTS)["policyDenied"],
  {
    toolName: McpToolName;
    scope: McpScope;
    reason: string;
  }
>;

export type McpToolCompletedEvent = DomainEventEnvelope<
  (typeof MCP_EVENT_SUBJECTS)["toolCompleted"],
  {
    toolName: McpToolName;
    scope: McpScope;
    success: boolean;
  }
>;

export const McpToolInvokedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(MCP_EVENT_SUBJECTS.toolInvoked),
  z.object({
    toolName: McpToolNameSchema,
    scope: McpScopeSchema
  })
);

export const McpPolicyDeniedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(MCP_EVENT_SUBJECTS.policyDenied),
  z.object({
    toolName: McpToolNameSchema,
    scope: McpScopeSchema,
    reason: z.string().min(1)
  })
);

export const McpToolCompletedEventSchema = createDomainEventEnvelopeSchema(
  z.literal(MCP_EVENT_SUBJECTS.toolCompleted),
  z.object({
    toolName: McpToolNameSchema,
    scope: McpScopeSchema,
    success: z.boolean()
  })
);

export const McpEventSchema = z.discriminatedUnion("eventName", [
  McpToolInvokedEventSchema,
  McpPolicyDeniedEventSchema,
  McpToolCompletedEventSchema
]);

export type McpEvent =
  | McpPolicyDeniedEvent
  | McpToolCompletedEvent
  | McpToolInvokedEvent;

export const MCP_ERROR_CODE_VALUES = [
  "MCP_TOOL_NOT_FOUND",
  "MCP_SCOPE_DENIED",
  "MCP_INVALID_ARGUMENTS",
  "MCP_UNSUPPORTED_VERSION"
] as const;
export type McpErrorCode = (typeof MCP_ERROR_CODE_VALUES)[number];

export interface McpScopeDeniedDetails {
  toolName: McpToolName;
  requiredScope: McpScope;
  actualScope: McpScope;
}

export type McpError = DomainError<McpErrorCode, McpScopeDeniedDetails>;
