import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { MAP_BOUNDS } from "../../../shared/geo";
import type { Place } from "../../../shared/schemas/places";
import { FakeGeocoder } from "../../adapters/geocoder";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import type { AppEnv } from "../../middleware/types";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);

const KURIL: Place = {
  name: "Kuril Flyover",
  detail: "Badda, Dhaka",
  lat: 23.81877,
  lng: 90.42123,
};
const FAR: Place = { name: "Kuril, Chattogram", detail: "Chattogram", lat: 22.35, lng: 91.8 };

/** The real app with a fake geocoder put in place, so the whole stack runs but nothing leaves the machine. */
function appWith(geocoder: FakeGeocoder) {
  return new Hono<AppEnv>()
    .use(async (c, next) => {
      c.set("geocoder", geocoder);
      await next();
    })
    .route("/", app);
}

async function search(geocoder: FakeGeocoder, q: string, token: string | null) {
  return appWith(geocoder).request(
    `/api/places/search?q=${encodeURIComponent(q)}`,
    { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} },
    env,
  );
}

async function signedIn() {
  const user = await createTestUser(db());
  return createTestSession(db(), user.id);
}

beforeEach(async () => {
  for (const table of ["sessions", "users", "rate_limits"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("GET /api/places/search", () => {
  it("needs a login", async () => {
    const fake = new FakeGeocoder(() => [KURIL]);
    const res = await search(fake, "kuril", null);
    expect(res.status).toBe(401);
    expect(fake.calls).toHaveLength(0);
  });

  it("refuses a short or empty query without calling the geocoder", async () => {
    const token = await signedIn();
    const fake = new FakeGeocoder(() => [KURIL]);
    for (const q of ["ku", "  ku ", ""]) {
      expect((await search(fake, q, token)).status).toBe(400);
    }
    expect(fake.calls).toHaveLength(0);
  });

  it("returns the places the geocoder found", async () => {
    const token = await signedIn();
    const res = await search(new FakeGeocoder(() => [KURIL]), "kuril", token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ places: [KURIL] });
  });

  it("is rate limited per user, before the geocoder is called", async () => {
    const token = await signedIn();
    const other = await signedIn();
    const fake = new FakeGeocoder(() => [KURIL]);
    for (let i = 0; i < limits.placeSearch.rateLimit.limit; i++) {
      expect((await search(fake, "kuril", token)).status).toBe(200);
    }
    const refused = await search(fake, "kuril", token);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBeTruthy();
    expect(fake.calls).toHaveLength(limits.placeSearch.rateLimit.limit);
    // Another student has their own allowance.
    expect((await search(fake, "kuril", other)).status).toBe(200);
  });

  it("drops results outside the bounds and caps the list", async () => {
    const token = await signedIn();
    const many = Array.from({ length: limits.placeSearch.maxResults + 3 }, (_, i) => ({
      ...KURIL,
      name: `Place ${i}`,
    }));
    const res = await search(new FakeGeocoder(() => [FAR, ...many]), "kuril", token);
    const { places } = await res.json<{ places: Place[] }>();
    expect(places).toHaveLength(limits.placeSearch.maxResults);
    expect(places.map((p) => p.name)).not.toContain(FAR.name);
  });

  it("sends the geocoder only the query and the bounds", async () => {
    const token = await signedIn();
    const fake = new FakeGeocoder(() => [KURIL]);
    await search(fake, "  kuril  ", token);
    expect(fake.calls).toEqual([{ query: "kuril", bounds: MAP_BOUNDS }]);
    expect(Object.keys(fake.calls[0]!).sort()).toEqual(["bounds", "query"]);
  });

  it("answers 502 search_unavailable when the geocoder fails", async () => {
    const token = await signedIn();
    const failing = new FakeGeocoder(() => {
      throw new Error("photon is down");
    });
    const res = await search(failing, "kuril", token);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "search_unavailable" });
  });
});
