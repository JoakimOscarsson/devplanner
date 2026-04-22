import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  GRAPH_EVENT_SUBJECTS,
  GraphNodeCreatedEventSchema
} from "@pdp-helper/contracts-graph";
import { ServiceCapabilitySchema } from "@pdp-helper/contracts-core";
import {
  createService,
  json,
  publishEvent,
  readBody,
  type EventPublishHandler
} from "@pdp-helper/runtime-node";

describe("runtime-node", () => {
  const servers: Array<ReturnType<typeof createService>> = [];

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

  it("maps request-schema failures to VALIDATION_FAILED 422", async () => {
    const server = createService({
      name: "runtime-node-test",
      port: 0,
      routes: [
        {
          method: "POST",
          match: (pathname) => (pathname === "/v1/test" ? {} : null),
          async handle({ request, response, correlation }) {
            const payload = await readBody(request, ServiceCapabilitySchema);
            json(response, 200, payload, correlation);
          }
        }
      ]
    });
    servers.push(server);

    await new Promise<void>((resolve) => {
      server.on("listening", resolve);
    });

    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/v1/test`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const payload = (await response.json()) as {
      error: {
        code: string;
        details?: {
          issues?: Array<{
            path: string;
          }>;
        };
      };
    };

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("VALIDATION_FAILED");
    expect(payload.error.details?.issues?.length).toBeGreaterThan(0);
  });

  it("validates events before publishing them", async () => {
    const published: Array<{ subject: string; payload: string }> = [];
    const publisher: EventPublishHandler = async (subject, payload) => {
      published.push({ subject, payload });
    };

    const validEvent = {
      eventId: "evt_example",
      eventName: GRAPH_EVENT_SUBJECTS.nodeCreated,
      schemaVersion: "v1",
      workspaceId: "wrk_example",
      occurredAt: "2026-04-22T00:00:00Z",
      actor: {
        actorId: "act_example",
        actorKind: "system",
        displayName: "System"
      },
      correlationId: "cor_example",
      sourceService: "graph-service",
      payload: {
        node: {
          id: "nod_example",
          canvasId: "can_example",
          role: "brainstorm",
          category: "skill",
          label: "TypeScript",
          normalizedLabel: "typescript",
          position: {
            x: 0,
            y: 0
          },
          source: "user",
          workspaceId: "wrk_example",
          createdBy: "act_example",
          createdAt: "2026-04-22T00:00:00Z",
          updatedAt: "2026-04-22T00:00:00Z"
        }
      }
    };

    await publishEvent(
      publisher,
      GRAPH_EVENT_SUBJECTS.nodeCreated,
      GraphNodeCreatedEventSchema,
      validEvent
    );

    expect(published).toHaveLength(1);
    expect(published[0]?.subject).toBe(GRAPH_EVENT_SUBJECTS.nodeCreated);
    expect(JSON.parse(published[0]?.payload ?? "{}")).toMatchObject(validEvent);

    await expect(
      publishEvent(
        publisher,
        GRAPH_EVENT_SUBJECTS.nodeCreated,
        GraphNodeCreatedEventSchema,
        {
          ...validEvent,
          payload: {
            node: {
              ...validEvent.payload.node,
              label: ""
            }
          }
        }
      )
    ).rejects.toThrow();
  });
});
