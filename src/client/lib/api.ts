import type { z } from "zod";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`API request failed with status ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Fetches a same-origin /api path and validates the response against its shared schema.
export async function apiGet<T extends z.ZodType>(
  path: `/api/${string}`,
  schema: T,
): Promise<z.infer<T>> {
  const res = await fetch(path, { headers: { accept: "application/json" } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return schema.parse(body);
}
