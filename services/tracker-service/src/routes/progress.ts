import { PROJECTION_STATUS_VALUES, type ProjectionStatus } from "@pdp-helper/contracts-tracker";
import type { RouteDefinition } from "@pdp-helper/runtime-node";
import { createDomainError, errorResponse, json } from "@pdp-helper/runtime-node";
import {
  getGoalProjection,
  listGoalSummaries,
  listLagSnapshots,
  overallLagStatus,
  summarizeLag,
  trackerStore
} from "../storage/in-memory.js";

const projectionStatuses = new Set<string>(PROJECTION_STATUS_VALUES);

export const trackerProgressRoutes: readonly RouteDefinition[] = [
  {
    method: "GET",
    match: (pathname) =>
      pathname === "/v1/progress/overview" ? {} : null,
    handle: ({ response, correlation }) => {
      const lagSummary = summarizeLag(trackerStore.lagSnapshot);

      json(
        response,
        200,
        {
          overview: trackerStore.overview,
          goalSummaries: listGoalSummaries(),
          lagSummary: {
            status: overallLagStatus(trackerStore.lagSnapshot),
            staleProjectionCount: lagSummary.staleCount,
            maxLagSeconds: lagSummary.maxLagSeconds
          }
        },
        correlation
      );
    }
  },
  {
    method: "GET",
    match: (pathname) => (pathname === "/v1/progress/lag" ? {} : null),
    handle: ({ response, url, correlation }) => {
      const requestedStatus = url.searchParams.get("status");

      if (requestedStatus && !projectionStatuses.has(requestedStatus)) {
        errorResponse(
          response,
          createDomainError(
            "VALIDATION_FAILED",
            "status must be a supported projection status.",
            422,
            false,
            {
              issues: [
                {
                  path: "status",
                  rule: "enum",
                  message: "status must be one of the supported projection statuses."
                }
              ]
            }
          ),
          correlation
        );
        return;
      }

      const lag = listLagSnapshots(requestedStatus as ProjectionStatus | undefined);

      json(
        response,
        200,
        {
          lag,
          summary: summarizeLag(lag)
        },
        correlation
      );
    }
  },
  {
    method: "GET",
    match: (pathname) => {
      const match = pathname.match(/^\/v1\/progress\/goals\/([^/]+)$/);
      const goalId = match?.[1];
      return goalId ? { goalId } : null;
    },
    handle: ({ response, params, correlation }) => {
      const goalId = params.goalId;

      if (!goalId) {
        errorResponse(
          response,
          createDomainError(
            "VALIDATION_FAILED",
            "goalId is required.",
            422,
            false,
            {
              issues: [
                {
                  path: "goalId",
                  rule: "required",
                  message: "goalId is required."
                }
              ]
            }
          ),
          correlation
        );
        return;
      }

      const goalProjection = getGoalProjection(goalId);

      if (!goalProjection) {
        json(
          response,
          404,
          {
            error: {
              code: "PROJECTION_NOT_FOUND",
              message: `Goal projection ${goalId} was not found.`,
              status: 404,
              retryable: false
            }
          },
          correlation
        );
        return;
      }

      json(response, 200, goalProjection, correlation);
    }
  }
] as const;
