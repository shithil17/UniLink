import type { Context, MiddlewareHandler } from "hono";
import { getDb, type Db } from "../db/client";
import { rateLimitsRepo } from "../repos/rateLimits";
import type { AppEnv } from "./types";

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  /** Milliseconds until the current window ends. */
  retryAfterMs: number;
};

/**
 * Counts one hit for `key` in the current fixed window and says whether it is within `limit`.
 * The hit is a single atomic upsert, so concurrent requests cannot slip past the limit.
 * Every hit counts, including refused ones. Check it before the action it guards.
 */
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const count = await rateLimitsRepo(db).hit(key, windowStart);
  return { allowed: count <= limit, count, retryAfterMs: windowStart + windowMs - now };
}

/** The 429 answer for a key that is over its limit. */
export function rateLimitedResponse(c: Context, result: RateLimitResult) {
  c.header("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
  return c.json({ error: "rate_limited", message: "Too many attempts. Try again later." }, 429);
}

/** Route middleware around `rateLimit()`: answers 429 with Retry-After when the key is over its limit. */
export function rateLimitBy(
  key: (c: Context<AppEnv>) => string,
  limit: number,
  windowMs: number,
): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const result = await rateLimit(getDb(c.env.DB), key(c), limit, windowMs);
    if (!result.allowed) return rateLimitedResponse(c, result);
    await next();
  };
}
