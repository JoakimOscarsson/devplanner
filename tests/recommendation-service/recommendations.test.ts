import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  ProviderHealth,
  Recommendation,
  RecommendationDecision,
  RecommendationRun
} from "@pdp-helper/contracts-recommendation";
import { createService } from "@pdp-helper/runtime-node";
import { recommendationHealthRoutes } from "../../services/recommendation-service/src/routes/health";
import { recommendationRoutes } from "../../services/recommendation-service/src/routes/recommendations";
import { resetRecommendationStore } from "../../services/recommendation-service/src/storage/in-memory";

async function waitForListening(server: ReturnType<typeof createService>) {
  await new Promise<void>((resolve) => {
    server.on("listening", resolve);
  });
}

async function readJson<TPayload>(response: Response) {
  return (await response.json()) as TPayload;
}

describe("recommendation-service routes", () => {
  const servers: Array<ReturnType<typeof createService>> = [];

  beforeEach(() => {
    resetRecommendationStore();
  });

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          })
      )
    );
  });

  async function startServer() {
    const server = createService({
      name: "recommendation-service-test",
      port: 0,
      routes: [...recommendationHealthRoutes, ...recommendationRoutes]
    });
    servers.push(server);
    await waitForListening(server);

    return {
      baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    };
  }

  it("returns a filtered recommendation feed with providers, runs, and summary data", async () => {
    const { baseUrl } = await startServer();

    const response = await fetch(
      `${baseUrl}/v1/recommendations?status=pending&targetKind=goal`
    );
    const payload = await readJson<{
      recommendations: Recommendation[];
      decisions: RecommendationDecision[];
      providers: ProviderHealth[];
      runs: RecommendationRun[];
      summary: {
        pending: number;
        accepted: number;
        denied: number;
        deferredRuns: number;
      };
    }>(response);

    expect(response.status).toBe(200);
    expect(payload.recommendations).toHaveLength(1);
    expect(payload.recommendations[0]?.id).toBe("rec_event_driven");
    expect(payload.providers[0]?.providerId).toBe("prv_remote_ollama");
    expect(payload.runs[0]?.id).toBe("rrn_bootstrap");
    expect(payload.summary).toEqual({
      pending: 2,
      accepted: 0,
      denied: 0,
      queuedRuns: 0,
      deferredRuns: 1
    });
  });

  it("accepts one recommendation and denies another while preserving decision state in the feed", async () => {
    const { baseUrl } = await startServer();

    const acceptResponse = await fetch(
      `${baseUrl}/v1/recommendations/rec_event_driven/accept`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: "This is the strongest next demo step."
        })
      }
    );
    const acceptPayload = await readJson<{
      accepted: true;
      recommendation: Recommendation;
      decision: RecommendationDecision;
    }>(acceptResponse);

    expect(acceptResponse.status).toBe(200);
    expect(acceptPayload.recommendation.status).toBe("accepted");
    expect(acceptPayload.decision.decision).toBe("accepted");
    expect(acceptPayload.decision.reason).toBe(
      "This is the strongest next demo step."
    );

    const denyResponse = await fetch(
      `${baseUrl}/v1/recommendations/rec_visibility/deny`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          reason: "Keep the current slice focused."
        })
      }
    );
    const denyPayload = await readJson<{
      accepted: true;
      recommendation: Recommendation;
      decision: RecommendationDecision;
    }>(denyResponse);

    expect(denyResponse.status).toBe(200);
    expect(denyPayload.recommendation.status).toBe("denied");
    expect(denyPayload.decision.decision).toBe("denied");

    const feedResponse = await fetch(`${baseUrl}/v1/recommendations`);
    const feedPayload = await readJson<{
      recommendations: Recommendation[];
      decisions: RecommendationDecision[];
      summary: {
        pending: number;
        accepted: number;
        denied: number;
      };
    }>(feedResponse);

    expect(feedPayload.decisions).toHaveLength(2);
    expect(feedPayload.summary).toMatchObject({
      pending: 0,
      accepted: 1,
      denied: 1
    });
  });

  it("records queued and deferred manual runs based on provider health", async () => {
    const { baseUrl } = await startServer();

    const degradedRunResponse = await fetch(`${baseUrl}/v1/recommendations/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        providerId: "prv_remote_ollama",
        trigger: "manual",
        target: {
          targetKind: "goal",
          goalId: "gol_aws_cert"
        }
      })
    });
    const degradedRunPayload = await readJson<{
      run: RecommendationRun;
      reason: string;
    }>(degradedRunResponse);

    expect(degradedRunResponse.status).toBe(202);
    expect(degradedRunPayload.run.status).toBe("deferred");
    expect(degradedRunPayload.reason).toContain("not healthy enough");

    const healthUpdateResponse = await fetch(`${baseUrl}/v1/providers/health`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        status: "up",
        message: "Cloudflare access tunnel is healthy."
      })
    });

    expect(healthUpdateResponse.status).toBe(200);

    const healthyRunResponse = await fetch(`${baseUrl}/v1/recommendations/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        providerId: "prv_remote_ollama",
        trigger: "manual"
      })
    });
    const healthyRunPayload = await readJson<{
      run: RecommendationRun;
      reason: string;
    }>(healthyRunResponse);

    expect(healthyRunPayload.run.status).toBe("queued");

    const feedResponse = await fetch(`${baseUrl}/v1/recommendations`);
    const feedPayload = await readJson<{
      providers: ProviderHealth[];
      runs: RecommendationRun[];
      summary: {
        deferredRuns: number;
        queuedRuns: number;
      };
    }>(feedResponse);

    expect(feedPayload.providers[0]?.status).toBe("up");
    expect(feedPayload.runs.filter((run) => run.status === "deferred")).toHaveLength(2);
    expect(feedPayload.runs.filter((run) => run.status === "queued")).toHaveLength(1);
    expect(feedPayload.summary).toMatchObject({
      deferredRuns: 2,
      queuedRuns: 1
    });
  });
});
