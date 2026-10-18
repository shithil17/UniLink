import { z } from "zod";
import { apiError } from "../../shared/schemas/common";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }

  /** The stable error code the server sent, if any. */
  get code(): string | undefined {
    const parsed = apiError.safeParse(this.body);
    return parsed.success ? parsed.data.error : undefined;
  }
}

/** A message that is safe to show: the server's `message`, else a generic fallback. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const parsed = apiError.safeParse(err.body);
    if (parsed.success && parsed.data.message) return parsed.data.message;
    if (err.status === 429) return "Too many attempts. Try again later.";
  }
  return "Something went wrong. Try again.";
}

async function request<T extends z.ZodType>(
  method: "GET" | "POST",
  path: `/api/${string}`,
  schema: T,
  body?: unknown,
): Promise<z.infer<T>> {
  const res = await fetch(path, {
    method,
    headers: {
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json);
  return schema.parse(json);
}

// Fetches a same-origin /api path and validates the response against its shared schema.
export function apiGet<T extends z.ZodType>(
  path: `/api/${string}`,
  schema: T,
): Promise<z.infer<T>> {
  return request("GET", path, schema);
}

export function apiPost<T extends z.ZodType>(
  path: `/api/${string}`,
  schema: T,
  body?: unknown,
): Promise<z.infer<T>> {
  return request("POST", path, schema, body);
}
