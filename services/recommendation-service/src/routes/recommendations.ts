import type { RouteDefinition } from "@pdp-helper/runtime-node";
import {
  createDomainError,
  errorResponse,
  json,
  readBody
} from "@pdp-helper/runtime-node";
import {
  createRecommendationRun,
  decisions,
  getRecommendationSummary,
  listRecommendations,
  providerHealth,
  recordRecommendationDecision,
  recommendations,
  runs
} from "../storage/in-memory.js";

export const recommendationRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) =>
      pathname === "/v1/recommendations" ? {} : null,
    handle: ({ response, correlation, url }) => {
      const status = url.searchParams.get("status") ?? undefined;
      const targetKind = url.searchParams.get("targetKind") ?? undefined;

      json(
        response,
        200,
        {
          recommendations: listRecommendations({
            ...(status ? { status: status as (typeof recommendations)[number]["status"] } : {}),
            ...(targetKind
              ? {
                  targetKind: targetKind as (typeof recommendations)[number]["target"]["targetKind"]
                }
              : {})
          }),
          decisions,
          providers: [providerHealth],
          runs,
          summary: getRecommendationSummary()
        },
        correlation
      );
    }
  },
  {
    method: "POST",
    match: (pathname) =>
      pathname === "/v1/recommendations/runs" ? {} : null,
    handle: async ({ request, response, correlation }) => {
      const body = await readBody(request);
      const payload = createRecommendationRun({
        providerId:
          typeof body.providerId === "string"
            ? (body.providerId as typeof providerHealth.providerId)
            : undefined,
        trigger:
          typeof body.trigger === "string"
            ? (body.trigger as (typeof runs)[number]["trigger"])
            : undefined,
        target:
          typeof body.target === "object" && body.target
            ? (body.target as (typeof recommendations)[number]["target"])
            : undefined
      });

      json(response, 202, payload, correlation);
    }
  },
  {
    method: "POST",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/recommendations\/([^/]+)\/(accept|deny)$/);
      const recommendationId = match?.[1];
      const action = match?.[2];
      return recommendationId && action
        ? {
            recommendationId,
            action
          }
        : null;
    },
    handle: async ({ request, response, params, correlation }) => {
      const existingRecommendation = recommendations.find(
        (entry) => entry.id === params.recommendationId
      );

      if (!existingRecommendation) {
        errorResponse(
          response,
          createDomainError(
            "NOT_FOUND",
            `Recommendation ${params.recommendationId} was not found.`,
            404
          ),
          correlation
        );
        return;
      }

      const body = await readBody(request);
      const recorded = recordRecommendationDecision({
        recommendationId: existingRecommendation.id,
        decision: params.action === "accept" ? "accepted" : "denied",
        reason: typeof body.reason === "string" ? body.reason : undefined
      });

      if (!recorded) {
        errorResponse(
          response,
          createDomainError(
            "NOT_FOUND",
            `Recommendation ${params.recommendationId} was not found.`,
            404
          ),
          correlation
        );
        return;
      }

      json(
        response,
        200,
        {
          accepted: true,
          recommendation: recorded.recommendation,
          decision: recorded.decision
        },
        correlation
      );
    }
  }
] as const;
