import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from "node:http";
import {
  COMMON_ERROR_CODE_VALUES,
  type CommonErrorCode,
  type DomainError,
  type JsonObject
} from "@pdp-helper/contracts-core";
import { ZodError, type ZodTypeAny } from "zod";

export interface CorrelationContext {
  correlationId: string;
  causationId: string;
}

export interface ServiceRequestContext<TParams extends object = Record<string, string>> {
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
  url: URL;
  params: TParams;
  correlation: CorrelationContext;
}

export interface RouteDefinition<TParams extends object = Record<string, string>> {
  method: string | readonly string[];
  match: (pathname: string) => TParams | null;
  handle: (context: ServiceRequestContext<TParams>) => Promise<void> | void;
}

export interface CreateServiceOptions {
  name: string;
  port: number;
  routes: readonly RouteDefinition[];
}

export interface EventPublisher {
  publish: (subject: string, payload: string) => Promise<void> | void;
}

export type EventPublishHandler = (
  subject: string,
  payload: string
) => Promise<void> | void;

function applyCommonHeaders(
  response: ServerResponse<IncomingMessage>,
  correlation?: CorrelationContext
) {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("access-control-allow-origin", "*");
  response.setHeader("access-control-allow-methods", "GET,POST,PATCH,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,x-correlation-id,x-causation-id");

  if (correlation) {
    response.setHeader("x-correlation-id", correlation.correlationId);
    response.setHeader("x-causation-id", correlation.causationId);
  }
}

export function json(
  response: ServerResponse<IncomingMessage>,
  statusCode: number,
  payload: unknown,
  correlation?: CorrelationContext
) {
  response.statusCode = statusCode;
  applyCommonHeaders(response, correlation);
  response.end(JSON.stringify(payload, null, 2));
}

export function withCorrelation(
  request: IncomingMessage
): CorrelationContext {
  const correlationId =
    request.headers["x-correlation-id"]?.toString() ??
    `cor_${crypto.randomUUID().replaceAll("-", "")}`;
  const causationId =
    request.headers["x-causation-id"]?.toString() ??
    `cmd_${crypto.randomUUID().replaceAll("-", "")}`;

  return {
    correlationId,
    causationId
  };
}

export function createDomainError<TCode extends string = CommonErrorCode>(
  code: TCode,
  message: string,
  status: number,
  retryable = false,
  details?: JsonObject
): DomainError<TCode> {
  return {
    code,
    message,
    status,
    retryable,
    ...(details ? { details } : {})
  };
}

export function errorResponse(
  response: ServerResponse<IncomingMessage>,
  error: DomainError | Error,
  correlation?: CorrelationContext
) {
  const payload =
    error instanceof ZodError
      ? createDomainError(
          "VALIDATION_FAILED",
          "Request validation failed.",
          422,
          false,
          {
            issues: error.issues.map((issue) => ({
              path: issue.path.length > 0 ? issue.path.join(".") : "$",
              rule: issue.code,
              message: issue.message
            }))
          }
        )
      : error instanceof Error
        ? createDomainError(
            "INTERNAL_ERROR",
            error.message || "Unexpected error.",
            500,
            false
          )
        : error;

  json(response, payload.status, { error: payload }, correlation);
}

export function notFound(
  response: ServerResponse<IncomingMessage>,
  method: string,
  pathname: string,
  correlation?: CorrelationContext
) {
  errorResponse(
    response,
    createDomainError(
      "NOT_FOUND",
      `No route matches ${method} ${pathname}`,
      404,
      false
    ),
    correlation
  );
}

export async function readBody(
  request: IncomingMessage
): Promise<Record<string, unknown>>;
export async function readBody<TSchema extends ZodTypeAny>(
  request: IncomingMessage,
  schema: TSchema
): Promise<ReturnType<TSchema["parse"]>>;
export async function readBody<TSchema extends ZodTypeAny>(
  request: IncomingMessage,
  schema?: TSchema
) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  const parsed = text.length === 0 ? {} : (JSON.parse(text) as Record<string, unknown>);

  if (!schema) {
    return parsed;
  }

  return schema.parse(parsed);
}

function normalizeMethods(method: string | readonly string[]) {
  return new Set(Array.isArray(method) ? method : [method]);
}

export function createService({ name, port, routes }: CreateServiceOptions): Server {
  const normalizedRoutes = routes.map((route) => ({
    ...route,
    methods: normalizeMethods(route.method)
  }));

  const server = createServer(async (request, response) => {
    const correlation = withCorrelation(request);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      applyCommonHeaders(response, correlation);
      response.end();
      return;
    }

    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`
    );
    const method = request.method ?? "GET";

    try {
      for (const route of normalizedRoutes) {
        if (!route.methods.has(method)) {
          continue;
        }

        const params = route.match(url.pathname);

        if (!params) {
          continue;
        }

        await route.handle({
          request,
          response,
          url,
          params,
          correlation
        });
        return;
      }

      notFound(response, method, url.pathname, correlation);
    } catch (error) {
      errorResponse(response, error as DomainError | Error, correlation);
    }
  });

  server.listen(port, () => {
    console.log(`${name} listening on http://localhost:${port}`);
  });

  return server;
}

export interface ProxyRequestOptions {
  request: IncomingMessage;
  response: ServerResponse<IncomingMessage>;
  targetUrl: string;
  correlation: CorrelationContext;
}

export async function proxyRequest({
  request,
  response,
  targetUrl,
  correlation
}: ProxyRequestOptions) {
  const method = request.method ?? "GET";
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "undefined" || key === "host") {
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        headers.append(key, entry);
      }
      continue;
    }

    headers.set(key, value);
  }

  headers.set("x-correlation-id", correlation.correlationId);
  headers.set("x-causation-id", correlation.causationId);

  const shouldSendBody = !["GET", "HEAD"].includes(method);
  const body = shouldSendBody ? Buffer.from(await readBodyBuffer(request)) : undefined;

  const proxied = await fetch(targetUrl, {
    method,
    headers,
    ...(body ? { body } : {})
  });

  response.statusCode = proxied.status;

  proxied.headers.forEach((value, key) => {
    if (key.toLowerCase() === "content-length") {
      return;
    }

    response.setHeader(key, value);
  });

  response.setHeader("x-correlation-id", correlation.correlationId);
  response.setHeader("x-causation-id", correlation.causationId);

  const arrayBuffer = await proxied.arrayBuffer();
  response.end(Buffer.from(arrayBuffer));
}

async function readBodyBuffer(request: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export function assertKnownErrorCode(code: string): code is CommonErrorCode {
  return COMMON_ERROR_CODE_VALUES.includes(code as CommonErrorCode);
}

export async function publishEvent<TEvent>(
  publisher: EventPublisher | EventPublishHandler,
  subject: string,
  schema: ZodTypeAny,
  event: unknown
): Promise<TEvent> {
  const parsed = schema.parse(event) as TEvent;
  const payload = JSON.stringify(parsed);

  if (typeof publisher === "function") {
    await publisher(subject, payload);
    return parsed;
  }

  await publisher.publish(subject, payload);
  return parsed;
}
