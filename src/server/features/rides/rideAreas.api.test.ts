import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { daysToMask } from "../../../shared/rides";
import type { RideAreaCounts } from "../../../shared/schemas/rides";
import { dhakaDate, formatDhakaDate, startOfDhakaDay } from "../../../shared/time";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { areaIdBySlug, createTestSession, createTestUser, resetAreas } from "../../test/factories";

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const PHONE = "+8801712345678";

const A = { bashundhara: 0, mirpur: 0, uttara: 0, outside: 0 };

type Person = { id: number; token: string };

async function person(role: "student" | "mod" | "admin" = "student"): Promise<Person> {
  const user = await createTestUser(db(), { role, createdAt: Date.now() - 2 * DAY });
  return { id: user.id, token: await createTestSession(db(), user.id) };
}

async function counts(token: string | null, query = "") {
  return app.request(
    `/api/rides/areas${query}`,
    { headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} },
    env,
  );
}

/** The counts as `{ areaId: count }`. */
async function countMap(who: Person, query = "") {
  const res = await counts(who.token, query);
  expect(res.status).toBe(200);
  const body = await res.json<RideAreaCounts>();
  return Object.fromEntries(body.areas.map((a) => [a.areaId, a.count]));
}

type Insert = {
  authorId: number;
  kind?: "one_off" | "recurring";
  status?: string;
  pickupAreaId?: number;
  destinationAreaId?: number;
  vehicle?: string;
  departsAt?: number;
  days?: number;
  expiresAt?: number;
  deletedAt?: number | null;
};

/** Inserts a ride directly, so a test can set its status, expiry and removal. Exact points are filled in to prove they never leak. */
async function insertRide(f: Insert): Promise<number> {
  const now = Date.now();
  const kind = f.kind ?? "one_off";
  const departsAt = kind === "one_off" ? (f.departsAt ?? now + DAY) : null;
  const row = await env.DB.prepare(
    `INSERT INTO rides (author_id, pickup_area_id, destination_area_id, pickup_landmark,
       destination_landmark, vehicle, total_seats, seats_remaining, price_per_seat_taka, notes,
       contact_phone, kind, departs_at, days, departure_minutes, ends_on, status, expires_at,
       created_at, updated_at, deleted_at, pickup_lat, pickup_lng, destination_lat, destination_lng)
     VALUES (?, ?, ?, 'NSU gate', 'Mirpur 10', ?, 4, 4, 100, 'a note', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       23.8, 90.4, 23.81, 90.41) RETURNING id`,
  )
    .bind(
      f.authorId,
      f.pickupAreaId ?? A.bashundhara,
      f.destinationAreaId ?? A.mirpur,
      f.vehicle ?? "car",
      PHONE,
      kind,
      departsAt,
      kind === "recurring" ? (f.days ?? daysToMask(["mon"])) : null,
      kind === "recurring" ? 450 : null,
      kind === "recurring" ? formatDhakaDate(dhakaDate(now + 30 * DAY)) : null,
      f.status ?? "published",
      f.expiresAt ?? (kind === "one_off" ? (departsAt as number) : now + 30 * DAY),
      now,
      now,
      f.deletedAt ?? null,
    )
    .first<{ id: number }>();
  return row!.id;
}

async function addArea(slug: string, name: string, parentId: number, point: boolean) {
  const now = Date.now();
  const row = await env.DB.prepare(
    "INSERT INTO areas (slug, name, parent_id, lat, lng, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(slug, name, parentId, point ? 23.82 : null, point ? 90.36 : null, now, now)
    .first<{ id: number }>();
  return row!.id;
}

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rides").run();
  await resetAreas(env.DB);
  for (const [key, slug] of [
    ["bashundhara", "bashundhara-r-a"],
    ["mirpur", "mirpur"],
    ["uttara", "uttara"],
    ["outside", "outside-dhaka"],
  ] as const) {
    A[key] = await areaIdBySlug(env.DB, slug);
  }
  for (const table of ["sessions", "users", "rate_limits"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("GET /api/rides/areas", () => {
  it("needs a login", async () => {
    expect((await counts(null)).status).toBe(401);
  });

  it("counts live rides per pickup area by default and per destination area with by=destination", async () => {
    const who = await person();
    await insertRide({
      authorId: who.id,
      pickupAreaId: A.bashundhara,
      destinationAreaId: A.mirpur,
    });
    await insertRide({
      authorId: who.id,
      pickupAreaId: A.bashundhara,
      destinationAreaId: A.uttara,
    });
    await insertRide({ authorId: who.id, pickupAreaId: A.uttara, destinationAreaId: A.mirpur });

    const res = await counts(who.token);
    expect(await res.json()).toEqual({
      by: "pickup",
      areas: [
        { areaId: A.bashundhara, count: 2 },
        { areaId: A.uttara, count: 1 },
      ].sort((a, b) => a.areaId - b.areaId),
    });
    expect(await countMap(who)).toEqual({ [A.bashundhara]: 2, [A.uttara]: 1 });

    const dest = await counts(who.token, "?by=destination");
    const body = await dest.json<RideAreaCounts>();
    expect(body.by).toBe("destination");
    expect(Object.fromEntries(body.areas.map((a) => [a.areaId, a.count]))).toEqual({
      [A.mirpur]: 2,
      [A.uttara]: 1,
    });
    expect((await counts(who.token, "?by=sideways")).status).toBe(400);
  });

  it("leaves out expired, held, rejected and deleted rides", async () => {
    const who = await person();
    const other = await person();
    await insertRide({ authorId: other.id });
    await insertRide({
      authorId: other.id,
      expiresAt: Date.now() - HOUR,
      departsAt: Date.now() - HOUR,
    });
    await insertRide({ authorId: other.id, status: "pending_review" });
    await insertRide({ authorId: other.id, status: "rejected" });
    await insertRide({ authorId: other.id, deletedAt: Date.now() });
    expect(await countMap(who)).toEqual({ [A.bashundhara]: 1 });
  });

  it("does not count a viewer's own held ride, like the feed, but counts it for nobody else either, mods included", async () => {
    const mod = await person("mod");
    const author = await person();
    await insertRide({ authorId: author.id, status: "pending_review" });
    expect(await countMap(author)).toEqual({});
    expect(await countMap(mod)).toEqual({});
  });

  it("respects the vehicle filter", async () => {
    const who = await person();
    await insertRide({ authorId: who.id, vehicle: "car" });
    await insertRide({ authorId: who.id, vehicle: "bike", pickupAreaId: A.uttara });
    expect(await countMap(who, "?vehicle=bike")).toEqual({ [A.uttara]: 1 });
    expect(await countMap(who, "?vehicle=bus")).toEqual({});
  });

  it("respects the date filter, one-off and recurring rides alike", async () => {
    const who = await person();
    const day = formatDhakaDate(dhakaDate(Date.now() + 3 * DAY));
    const start = startOfDhakaDay(dhakaDate(Date.now() + 3 * DAY));
    const weekday = new Date(start + 6 * HOUR).getUTCDay();
    await insertRide({ authorId: who.id, departsAt: start + 9 * HOUR });
    await insertRide({ authorId: who.id, departsAt: start + 2 * DAY, pickupAreaId: A.uttara });
    await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: 1 << weekday,
      pickupAreaId: A.mirpur,
    });
    expect(await countMap(who, `?date=${day}`)).toEqual({ [A.bashundhara]: 1, [A.mirpur]: 1 });
  });

  it("respects the weekday filter", async () => {
    const who = await person();
    const start = startOfDhakaDay(dhakaDate(Date.now() + 3 * DAY));
    const departs = start + 9 * HOUR;
    const weekday = new Date(departs + 6 * HOUR).getUTCDay();
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    await insertRide({ authorId: who.id, departsAt: departs });
    await insertRide({ authorId: who.id, departsAt: departs + DAY, pickupAreaId: A.uttara });
    expect(await countMap(who, `?day=${names[weekday]}`)).toEqual({ [A.bashundhara]: 1 });
  });

  it("ignores the text search and the area filters", async () => {
    const who = await person();
    await insertRide({ authorId: who.id });
    await insertRide({ authorId: who.id, pickupAreaId: A.uttara });
    expect(await countMap(who, `?q=nothing-matches&from=${A.uttara}&to=${A.uttara}`)).toEqual({
      [A.bashundhara]: 1,
      [A.uttara]: 1,
    });
  });

  it("rolls a sub-area with no point of its own up into its parent, and keeps one with a point apart", async () => {
    const who = await person();
    const bare = await addArea("mirpur-bare", "Mirpur Bare", A.mirpur, false);
    const pinned = await addArea("mirpur-pinned", "Mirpur Pinned", A.mirpur, true);
    await insertRide({ authorId: who.id, pickupAreaId: A.mirpur });
    await insertRide({ authorId: who.id, pickupAreaId: bare });
    await insertRide({ authorId: who.id, pickupAreaId: bare });
    await insertRide({ authorId: who.id, pickupAreaId: pinned });
    expect(await countMap(who)).toEqual({ [A.mirpur]: 3, [pinned]: 1 });
    // The destination end rolls up the same way (the four rides above all go to Mirpur itself).
    await insertRide({ authorId: who.id, destinationAreaId: bare });
    await insertRide({ authorId: who.id, destinationAreaId: pinned });
    expect(await countMap(who, "?by=destination")).toEqual({ [A.mirpur]: 5, [pinned]: 1 });
  });

  it("counts an area with no point as itself, for the client's Not on the map chip", async () => {
    const who = await person();
    await insertRide({ authorId: who.id, pickupAreaId: A.outside });
    expect(await countMap(who)).toEqual({ [A.outside]: 1 });
  });

  it("is rate limited per user", async () => {
    const who = await person();
    const other = await person();
    const { limit } = limits.rideAreaCounts;
    for (let i = 0; i < limit; i++) expect((await counts(who.token)).status).toBe(200);
    const refused = await counts(who.token);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBeTruthy();
    expect((await counts(other.token)).status).toBe(200);
  });

  it("carries only area ids and counts: no ride details, points, contacts or authors", async () => {
    const who = await person();
    await insertRide({ authorId: who.id });
    const raw = await (await counts(who.token)).text();
    const body = JSON.parse(raw) as RideAreaCounts;
    expect(Object.keys(body).sort()).toEqual(["areas", "by"]);
    for (const area of body.areas) expect(Object.keys(area).sort()).toEqual(["areaId", "count"]);
    for (const secret of [PHONE, "NSU gate", "a note", "23.8", "90.4", "authorId", "username"]) {
      expect(raw).not.toContain(secret);
    }
  });
});
