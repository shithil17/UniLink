import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "../db/client";
import { rateLimit, rateLimitBy } from "./rateLimit";
import type { AppEnv } from "./types";

const db = () => getDb(env.DB);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rate_limits").run();
});

describe("rateLimit()", () => {
  it("counts within a window and refuses past the limit", async () => {
    const now = 10 * 60_000;
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await rateLimit(db(), "k", 3, 60_000, now));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.count)).toEqual([1, 2, 3, 4]);
  });

  it("resets in a new window", async () => {
    const now = 10 * 60_000;
    for (let i = 0; i < 4; i++) await rateLimit(db(), "k", 3, 60_000, now);
    const next = await rateLimit(db(), "k", 3, 60_000, now + 60_000);
    expect(next).toMatchObject({ allowed: true, count: 1 });
  });

  it("keeps separate counts per key and reports time left in the window", async () => {
    const now = 10 * 60_000 + 15_000;
    await rateLimit(db(), "a", 1, 60_000, now);
    const b = await rateLimit(db(), "b", 1, 60_000, now);
    expect(b).toMatchObject({ allowed: true, count: 1, retryAfterMs: 45_000 });
  });

  it("is one atomic upsert: concurrent hits never lose a count", async () => {
    const now = 10 * 60_000;
    const results = await Promise.all(
      Array.from({ length: 20 }, () => rateLimit(db(), "race", 5, 60_000, now)),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
    expect(results.map((r) => r.count).sort((x, y) => x - y)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    const row = await env.DB.prepare("SELECT count FROM rate_limits WHERE key = 'race'").first<{
      count: number;
    }>();
    expect(row?.count).toBe(20);
  });
});

describe("rateLimitBy()", () => {
  it("answers 429 with Retry-After once over the limit", async () => {
    const app = new Hono<AppEnv>().get(
      "/x",
      rateLimitBy(() => "ip:1.2.3.4", 2, 60 * 60_000),
      (c) => c.json({ ok: true }),
    );
    const statuses = [];
    let last: Response | undefined;
    for (let i = 0; i < 3; i++) {
      last = await app.request("/x", {}, env);
      statuses.push(last.status);
    }
    expect(statuses).toEqual([200, 200, 429]);
    expect(Number(last?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });
});
