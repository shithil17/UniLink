import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { daysToMask } from "../../../shared/rides";
import type { RideFeedPage, RideSummary } from "../../../shared/schemas/rides";
import { dhakaDate, endOfDhakaDay, formatDhakaDate, startOfDhakaDay } from "../../../shared/time";
import { app } from "../../app";
import { runCronJobs } from "../../cron";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { areaIdBySlug, createTestSession, createTestUser, resetAreas } from "../../test/factories";

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  return app.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

type Person = { id: number; token: string; username: string };

/** A student whose account is old enough to post. */
async function person(
  opts: { role?: "student" | "mod" | "admin"; fresh?: boolean } = {},
): Promise<Person> {
  const user = await createTestUser(db(), {
    role: opts.role ?? "student",
    createdAt: opts.fresh ? Date.now() : Date.now() - 2 * DAY,
  });
  return { id: user.id, token: await createTestSession(db(), user.id), username: user.username };
}

/** Ids of a few seeded areas (migration 0020), looked up by slug before each test. */
const A = { bashundhara: 0, mirpur: 0, uttara: 0, gulshan: 0, banani: 0 };

const PHONE = "+8801712345678";
const WHATSAPP = "https://wa.me/8801712345678";

const oneOff = (extra: Record<string, unknown> = {}) => ({
  kind: "one_off",
  pickupAreaId: A.bashundhara,
  pickupLandmark: "NSU gate",
  destinationAreaId: A.mirpur,
  destinationLandmark: "Mirpur 10",
  vehicle: "car",
  totalSeats: 4,
  pricePerSeatTaka: 150,
  contacts: { phone: PHONE },
  departsAt: Date.now() + 2 * DAY,
  ...extra,
});

const recurring = (extra: Record<string, unknown> = {}) => ({
  kind: "recurring",
  pickupAreaId: A.uttara,
  destinationAreaId: A.bashundhara,
  destinationLandmark: "NSU gate",
  vehicle: "bus",
  totalSeats: 30,
  pricePerSeatTaka: 60,
  contacts: { whatsapp: WHATSAPP },
  days: ["mon", "wed"],
  departureTime: "07:30",
  ...extra,
});

async function post(who: Person, body: unknown) {
  const res = await call("POST", "/api/rides", who.token, body);
  expect(res.status).toBe(201);
  return res.json<RideSummary>();
}

type Insert = {
  authorId: number;
  kind?: "one_off" | "recurring";
  status?: string;
  pickupAreaId?: number;
  destinationAreaId?: number;
  pickupLandmark?: string | null;
  destinationLandmark?: string | null;
  vehicle?: string;
  totalSeats?: number;
  seatsRemaining?: number;
  departsAt?: number;
  days?: number;
  endsOn?: string;
  expiresAt?: number;
  deletedAt?: number | null;
  deletedBy?: number | null;
  notes?: string | null;
};

/** Inserts a ride directly, so a test can set its status, expiry and removal. */
async function insertRide(f: Insert): Promise<number> {
  const now = Date.now();
  const kind = f.kind ?? "one_off";
  const departsAt = kind === "one_off" ? (f.departsAt ?? now + DAY) : null;
  const total = f.totalSeats ?? 4;
  const row = await env.DB.prepare(
    `INSERT INTO rides (author_id, pickup_area_id, destination_area_id, pickup_landmark,
       destination_landmark, vehicle, total_seats, seats_remaining,
       price_per_seat_taka, notes, contact_phone, kind, departs_at, days, departure_minutes, ends_on,
       status, expires_at, created_at, updated_at, deleted_at, deleted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(
      f.authorId,
      f.pickupAreaId ?? A.bashundhara,
      f.destinationAreaId ?? A.mirpur,
      f.pickupLandmark === undefined ? "NSU gate" : f.pickupLandmark,
      f.destinationLandmark === undefined ? "Mirpur 10" : f.destinationLandmark,
      f.vehicle ?? "car",
      total,
      f.seatsRemaining ?? total,
      f.notes ?? null,
      PHONE,
      kind,
      departsAt,
      kind === "recurring" ? (f.days ?? daysToMask(["mon"])) : null,
      kind === "recurring" ? 450 : null,
      kind === "recurring" ? (f.endsOn ?? formatDhakaDate(dhakaDate(now + 30 * DAY))) : null,
      f.status ?? "published",
      f.expiresAt ?? (kind === "one_off" ? (departsAt as number) : now + 30 * DAY),
      now,
      now,
      f.deletedAt ?? null,
      f.deletedBy ?? null,
    )
    .first<{ id: number }>();
  return row!.id;
}

const rideRow = (id: number) =>
  env.DB.prepare("SELECT * FROM rides WHERE id = ?").bind(id).first<Record<string, unknown>>();

const feed = async (who: Person, query = "") => {
  const res = await call("GET", `/api/rides${query}`, who.token);
  expect(res.status).toBe(200);
  return res.json<RideFeedPage>();
};

const feedIds = async (who: Person, query = "") => (await feed(who, query)).items.map((r) => r.id);

const inbox = async (userId: number) =>
  (
    await env.DB.prepare("SELECT type, payload FROM notifications WHERE user_id = ? ORDER BY id")
      .bind(userId)
      .all<{ type: string; payload: string }>()
  ).results;

const dhakaDay = (ms: number) => formatDhakaDate(dhakaDate(ms));
const weekdayOf = (ms: number) => new Date(ms + 6 * HOUR).getUTCDay();

beforeEach(async () => {
  // Areas an earlier test added or hid go back to the seed, after the rides that use them.
  await env.DB.prepare("DELETE FROM rides").run();
  await resetAreas(env.DB);
  for (const [key, slug] of [
    ["bashundhara", "bashundhara-r-a"],
    ["mirpur", "mirpur"],
    ["uttara", "uttara"],
    ["gulshan", "gulshan"],
    ["banani", "banani"],
  ] as const) {
    A[key] = await areaIdBySlug(env.DB, slug);
  }
  for (const table of [
    "rides",
    "notifications",
    "reports",
    "sessions",
    "users",
    "rate_limits",
    "audit_log",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("creating a ride", () => {
  it("creates a one-off ride that expires at departure, starts with every seat free and shows no contact", async () => {
    const who = await person();
    const departsAt = Date.now() + 2 * DAY;
    const ride = await post(who, oneOff({ departsAt, notes: "Back seat is free" }));

    expect(ride).toMatchObject({
      kind: "one_off",
      pickupArea: { id: A.bashundhara, name: "Bashundhara R/A" },
      destinationArea: { id: A.mirpur, name: "Mirpur" },
      pickupLandmark: "NSU gate",
      destinationLandmark: "Mirpur 10",
      totalSeats: 4,
      seatsRemaining: 4,
      state: "open",
      status: "published",
      departsAt,
      expiresAt: departsAt,
      days: null,
      departureTime: null,
      endsOn: null,
      notes: "Back seat is free",
      mine: true,
    });
    expect(JSON.stringify(ride)).not.toContain(PHONE);
  });

  it("creates a recurring ride that defaults to ending 60 days out, through the whole of that Dhaka day", async () => {
    const who = await person();
    const before = Date.now();
    const ride = await post(who, recurring());
    const expected = dhakaDay(before + limits.postExpiry.defaultMs);

    expect(ride).toMatchObject({
      kind: "recurring",
      days: ["mon", "wed"],
      departureTime: "07:30",
      departsAt: null,
      endsOn: expected,
    });
    const [y, m, d] = expected.split("-").map(Number);
    expect(ride.expiresAt).toBe(endOfDhakaDay({ year: y, month: m, day: d }));
  });

  it("keeps an end date the poster picks", async () => {
    const who = await person();
    const endsOn = dhakaDay(Date.now() + 10 * DAY);
    const ride = await post(who, recurring({ endsOn }));
    expect(ride.endsOn).toBe(endsOn);
  });

  it("refuses a one-off without a departure and a recurring ride without days, a time or valid dates", async () => {
    const who = await person();
    const bad = async (body: unknown) => (await call("POST", "/api/rides", who.token, body)).status;
    const { departsAt: _departsAt, ...noDeparture } = oneOff();
    expect(await bad(noDeparture)).toBe(400);
    expect(await bad(recurring({ days: [] }))).toBe(400);
    expect(await bad(recurring({ departureTime: "7:30" }))).toBe(400);
    expect(await bad(recurring({ endsOn: "2026-02-30" }))).toBe(400);
    // A recurring ride takes no single departure.
    const { days: _days, departureTime: _time, ...noSchedule } = recurring();
    expect(await bad({ ...noSchedule, departsAt: Date.now() + DAY })).toBe(400);
    expect(await bad(oneOff({ kind: "weekly" }))).toBe(400);
  });

  it("refuses a departure in the past, one too far ahead, and an end date in the past", async () => {
    const who = await person();
    const code = async (body: unknown) => {
      const res = await call("POST", "/api/rides", who.token, body);
      expect(res.status).toBe(400);
      return (await res.json<{ error: string }>()).error;
    };
    expect(await code(oneOff({ departsAt: Date.now() - HOUR }))).toBe("invalid_departure");
    expect(await code(oneOff({ departsAt: Date.now() + limits.postExpiry.maxMs + DAY }))).toBe(
      "invalid_departure",
    );
    expect(await code(recurring({ endsOn: dhakaDay(Date.now() - 2 * DAY) }))).toBe(
      "invalid_end_date",
    );
    expect(await code(recurring({ endsOn: dhakaDay(Date.now() + 400 * DAY) }))).toBe(
      "invalid_end_date",
    );
  });

  it("refuses bad seats, a negative price, a missing contact and a badly formed one", async () => {
    const who = await person();
    const status = async (extra: Record<string, unknown>) =>
      (await call("POST", "/api/rides", who.token, oneOff(extra))).status;
    expect(await status({ totalSeats: 0 })).toBe(400);
    expect(await status({ totalSeats: limits.rideField.seatsMax + 1 })).toBe(400);
    expect(await status({ pricePerSeatTaka: -1 })).toBe(400);
    expect(await status({ pricePerSeatTaka: 1.5 })).toBe(400);
    expect(await status({ contacts: {} })).toBe(400);
    expect(await status({ contacts: { phone: "01712345678" } })).toBe(400);
    expect(await status({ vehicle: "boat" })).toBe(400);
    expect(await status({ pickupLandmark: "x".repeat(limits.rideField.landmarkMax + 1) })).toBe(
      400,
    );
    expect(
      await status({ destinationLandmark: "x".repeat(limits.rideField.landmarkMax + 1) }),
    ).toBe(400);
  });

  it("blocks a new account until the cooldown has passed, and needs a signed-in user", async () => {
    const fresh = await person({ fresh: true });
    const res = await call("POST", "/api/rides", fresh.token, oneOff());
    expect(res.status).toBe(429);
    expect((await res.json<{ error: string }>()).error).toBe("new_account");
    expect((await call("POST", "/api/rides", null, oneOff())).status).toBe(401);
  });

  it("holds back a ride the screen rejects", async () => {
    const who = await person();
    const res = await call(
      "POST",
      "/api/rides",
      who.token,
      oneOff({ notes: "call 01712345678 or visit https://bit.ly/buy" }),
    );
    expect(res.status).toBe(201);
    expect((await res.json<RideSummary>()).status).toBe("rejected");
  });

  it("caps open rides per poster and applies the creation rate limit", async () => {
    const who = await person();
    for (let i = 0; i < limits.rideOpenMax; i++) await insertRide({ authorId: who.id });
    const capped = await call("POST", "/api/rides", who.token, oneOff());
    expect(capped.status).toBe(409);
    expect((await capped.json<{ error: string }>()).error).toBe("too_many_open");

    const other = await person();
    for (let i = 0; i < limits.rideCreate.limit; i++) {
      const res = await call("POST", "/api/rides", other.token, oneOff());
      expect(res.status).toBe(201);
      // Keep the poster under the open-ride cap, so the rate limit is what is tested.
      await call("DELETE", `/api/rides/${(await res.json<RideSummary>()).id}`, other.token);
    }
    expect((await call("POST", "/api/rides", other.token, oneOff())).status).toBe(429);
  });
});

describe("seats", () => {
  async function setSeats(who: Person, id: number, seatsRemaining: number) {
    return call("POST", `/api/rides/${id}/seats`, who.token, { seatsRemaining });
  }

  it("never goes below 0 or above the total, and leaves the count alone when refused", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 4 }));

    const over = await setSeats(who, ride.id, 5);
    expect(over.status).toBe(409);
    expect(await over.json<{ error: string; message: string }>()).toEqual({
      error: "invalid_seats",
      message: "Seat count must be between 0 and 4.",
    });
    // Below 0 is refused by the shared schema before it gets to the database.
    expect((await setSeats(who, ride.id, -1)).status).toBe(400);
    expect((await setSeats(who, ride.id, 1.5)).status).toBe(400);
    expect((await rideRow(ride.id))?.seats_remaining).toBe(4);

    expect((await setSeats(who, ride.id, 2)).status).toBe(200);
    expect((await rideRow(ride.id))?.seats_remaining).toBe(2);
  });

  it("is a database CHECK as well: a write outside 0..total is refused whatever the route does", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 4 }));
    await expect(
      env.DB.prepare("UPDATE rides SET seats_remaining = 5 WHERE id = ?").bind(ride.id).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE rides SET seats_remaining = -1 WHERE id = ?").bind(ride.id).run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE rides SET total_seats = 1 WHERE id = ?").bind(ride.id).run(),
    ).rejects.toThrow();
  });

  it("is full at 0 seats left and open again when seats are raised", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 3 }));

    const full = await (await setSeats(who, ride.id, 0)).json<RideSummary>();
    expect(full).toMatchObject({ seatsRemaining: 0, state: "full" });
    // A full ride still shows in the feed, marked full.
    const items = (await feed(who)).items;
    expect(items.map((r) => [r.id, r.state])).toEqual([[ride.id, "full"]]);

    const open = await (await setSeats(who, ride.id, 1)).json<RideSummary>();
    expect(open).toMatchObject({ seatsRemaining: 1, state: "open" });
  });

  it("empties a full ride again: a new ride has 0 taken, Mark as full stores 0 left, and saving all seats left reopens it", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 3 }));
    expect(await rideRow(ride.id)).toMatchObject({ total_seats: 3, seats_remaining: 3 });

    await call("POST", `/api/rides/${ride.id}/full`, who.token);
    expect((await rideRow(ride.id))?.seats_remaining).toBe(0);

    const reset = await (await setSeats(who, ride.id, 3)).json<RideSummary>();
    expect(reset).toMatchObject({ totalSeats: 3, seatsRemaining: 3, state: "open" });
    expect((await rideRow(ride.id))?.seats_remaining).toBe(3);
  });

  it("marks a ride fully booked in one call", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 3 }));
    const res = await call("POST", `/api/rides/${ride.id}/full`, who.token);
    expect(res.status).toBe(200);
    expect(await res.json<RideSummary>()).toMatchObject({ seatsRemaining: 0, state: "full" });
  });

  it("keeps the seats already taken when the total changes, in one update", async () => {
    const who = await person();
    const ride = await post(who, oneOff({ totalSeats: 4 }));
    await setSeats(who, ride.id, 1); // 3 taken

    const patch = async (totalSeats: number) =>
      (await call("PATCH", `/api/rides/${ride.id}`, who.token, { totalSeats })).json<RideSummary>();

    // 6 seats with 3 taken leaves 3.
    expect(await patch(6)).toMatchObject({ totalSeats: 6, seatsRemaining: 3 });
    // 5 seats with 3 taken leaves 2.
    expect(await patch(5)).toMatchObject({ totalSeats: 5, seatsRemaining: 2 });
    // 2 seats with 3 taken cannot go below 0: it is full.
    expect(await patch(2)).toMatchObject({ totalSeats: 2, seatsRemaining: 0, state: "full" });
  });

  it("lets only the poster change seats, and answers 404 for anyone else", async () => {
    const who = await person();
    const stranger = await person();
    const ride = await post(who, oneOff());
    expect((await setSeats(stranger, ride.id, 1)).status).toBe(404);
    expect((await call("POST", `/api/rides/${ride.id}/full`, stranger.token)).status).toBe(404);
    expect((await setSeats(who, 99999, 1)).status).toBe(404);
    expect((await rideRow(ride.id))?.seats_remaining).toBe(4);
  });
});

describe("editing a ride", () => {
  it("changes price, vehicle and the schedule without screening again", async () => {
    const who = await person();
    const ride = await post(who, recurring());
    const auditRows = async () =>
      (
        await env.DB.prepare(
          "SELECT count(*) AS n FROM audit_log WHERE target_type = 'ride'",
        ).first<{ n: number }>()
      )?.n;
    const before = await auditRows();
    const res = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      pricePerSeatTaka: 80,
      vehicle: "car",
      days: ["fri"],
      departureTime: "08:15",
    });
    expect(res.status).toBe(200);
    expect(await res.json<RideSummary>()).toMatchObject({
      pricePerSeatTaka: 80,
      vehicle: "car",
      days: ["fri"],
      departureTime: "08:15",
      status: "published",
    });
    // Nothing was screened, so nothing new on the audit log.
    expect(await auditRows()).toBe(before);
  });

  it("screens the text again when the landmarks or notes change", async () => {
    const who = await person();
    const ride = await post(who, oneOff());
    expect(ride.status).toBe("published");

    const res = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      notes: "call 01712345678 or visit https://bit.ly/buy",
    });
    expect(res.status).toBe(200);
    const edited = await res.json<RideSummary>();
    expect(edited.status).toBe("rejected");
    expect(edited.rejectionCategory).toBeTruthy();
    // The rejected text was written, and the automatic decision is on the audit log.
    const audit = await env.DB.prepare(
      "SELECT action FROM audit_log WHERE target_type = 'ride' AND target_id = ?",
    )
      .bind(String(ride.id))
      .all<{ action: string }>();
    expect(audit.results.map((r) => r.action)).toContain("automod_reject");

    // A clean edit doesn't publish it again: it goes to a moderator.
    const fixed = await call("PATCH", `/api/rides/${ride.id}`, who.token, { notes: null });
    expect((await fixed.json<RideSummary>()).status).toBe("pending_review");
  });

  it("keeps a moderator-rejected ride in the queue after a clean edit, not published", async () => {
    const who = await person();
    const mod = await person({ role: "mod" });
    const ride = { id: await insertRide({ authorId: who.id, status: "pending_review" }) };
    const rejected = await call("POST", `/api/mod/posts/ride/${ride.id}/reject`, mod.token, {
      reason: "Not a ride share",
      category: "off_topic",
    });
    expect(rejected.status).toBe(200);
    expect((await rideRow(ride.id))?.status).toBe("rejected");

    const res = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      notes: "Back seat free",
    });
    expect(res.status).toBe(200);
    expect((await res.json<RideSummary>()).status).toBe("pending_review");
    expect((await rideRow(ride.id))?.status).toBe("pending_review");
    expect(await feedIds(who)).toEqual([]);

    // The held audit row matches what was saved, and the queue lists the ride again.
    const audit = await env.DB.prepare(
      "SELECT action FROM audit_log WHERE target_type = 'ride' AND target_id = ? ORDER BY id DESC LIMIT 1",
    )
      .bind(String(ride.id))
      .first<{ action: string }>();
    expect(audit?.action).toBe("automod_hold");
    const queue = await (
      await call("GET", "/api/mod/queue", mod.token)
    ).json<{ items: { targetType: string; id: number }[] }>();
    expect(queue.items.some((i) => i.targetType === "ride" && i.id === ride.id)).toBe(true);
  });

  it("keeps a held ride held after a clean edit, and a published one published", async () => {
    const who = await person();
    const held = await insertRide({ authorId: who.id, status: "pending_review" });
    const live = await post(who, oneOff());
    const edit = async (id: number) =>
      (
        await (
          await call("PATCH", `/api/rides/${id}`, who.token, { notes: "Back seat free" })
        ).json<RideSummary>()
      ).status;
    expect(await edit(held)).toBe("pending_review");
    expect(await edit(live.id)).toBe("published");
  });

  it("screens the contacts again, and refuses a badly formed or empty set", async () => {
    const who = await person();
    const ride = await post(who, oneOff());
    const patch = (contacts: unknown) =>
      call("PATCH", `/api/rides/${ride.id}`, who.token, { contacts });
    expect((await patch({ phone: "12345" })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    const ok = await patch({ whatsapp: WHATSAPP });
    expect(ok.status).toBe(200);
    const row = await rideRow(ride.id);
    expect(row).toMatchObject({ contact_phone: null, contact_whatsapp: WHATSAPP });
  });

  it("refuses the other kind's fields, a departure in the past and an empty change", async () => {
    const who = await person();
    const single = await post(who, oneOff());
    const weekly = await post(who, recurring());
    const patch = (id: number, body: unknown) => call("PATCH", `/api/rides/${id}`, who.token, body);
    expect((await patch(single.id, { days: ["sun"] })).status).toBe(400);
    expect((await patch(weekly.id, { departsAt: Date.now() + DAY })).status).toBe(400);
    expect((await patch(single.id, { departsAt: Date.now() - HOUR })).status).toBe(400);
    expect((await patch(weekly.id, { endsOn: dhakaDay(Date.now() - 3 * DAY) })).status).toBe(400);
    expect((await patch(single.id, {})).status).toBe(400);
  });

  it("moves a one-off's expiry with its departure, and a recurring ride's with its end date", async () => {
    const who = await person();
    const single = await post(who, oneOff());
    const departsAt = Date.now() + 5 * DAY;
    const moved = await (
      await call("PATCH", `/api/rides/${single.id}`, who.token, { departsAt })
    ).json<RideSummary>();
    expect(moved).toMatchObject({ departsAt, expiresAt: departsAt });

    const weekly = await post(who, recurring());
    const endsOn = dhakaDay(Date.now() + 20 * DAY);
    const [y, m, d] = endsOn.split("-").map(Number);
    const changed = await (
      await call("PATCH", `/api/rides/${weekly.id}`, who.token, { endsOn })
    ).json<RideSummary>();
    expect(changed).toMatchObject({
      endsOn,
      expiresAt: endOfDhakaDay({ year: y, month: m, day: d }),
    });
  });

  it("lets only the poster edit, and a removed ride is gone", async () => {
    const who = await person();
    const stranger = await person();
    const ride = await post(who, oneOff());
    expect(
      (await call("PATCH", `/api/rides/${ride.id}`, stranger.token, { pricePerSeatTaka: 1 }))
        .status,
    ).toBe(404);
    expect((await rideRow(ride.id))?.price_per_seat_taka).toBe(150);

    const gone = await insertRide({ authorId: who.id, deletedAt: Date.now(), deletedBy: who.id });
    expect(
      (await call("PATCH", `/api/rides/${gone}`, who.token, { pricePerSeatTaka: 1 })).status,
    ).toBe(404);
  });
});

describe("editing a ride that has ended", () => {
  it("refuses a new departure for a one-off ride that has already left", async () => {
    const who = await person();
    const id = await insertRide({
      authorId: who.id,
      departsAt: Date.now() - HOUR,
      expiresAt: Date.now() - HOUR,
    });
    const res = await call("PATCH", `/api/rides/${id}`, who.token, { departsAt: Date.now() + DAY });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "ride_left" });
  });
});

describe("renewing a ride", () => {
  const renew = (who: Person, id: number) => call("POST", `/api/rides/${id}/renew`, who.token);

  it("extends a recurring ride and keeps its end date in step with its expiry", async () => {
    const who = await person();
    const ride = await post(who, recurring({ endsOn: dhakaDay(Date.now() + 10 * DAY) }));

    const res = await renew(who, ride.id);
    expect(res.status).toBe(200);
    const renewed = await res.json<RideSummary>();
    expect(renewed.expiresAt).toBe(ride.expiresAt + limits.postExpiry.renewExtendMs);
    const [y, m, d] = (renewed.endsOn as string).split("-").map(Number);
    expect(renewed.expiresAt).toBe(endOfDhakaDay({ year: y, month: m, day: d }));
    expect(renewed.endsOn).toBe(dhakaDay(renewed.expiresAt - 1));
  });

  it("refuses a one-off ride", async () => {
    const who = await person();
    const ride = await post(who, oneOff());
    const res = await renew(who, ride.id);
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toBe("not_renewable");
    expect((await rideRow(ride.id))?.expires_at).toBe(ride.expiresAt);
  });

  it("renews a lapsed ride that has not been purged yet, from today", async () => {
    const who = await person();
    const id = await insertRide({
      authorId: who.id,
      kind: "recurring",
      endsOn: dhakaDay(Date.now() - 3 * DAY),
      expiresAt: Date.now() - 2 * DAY,
    });
    expect((await feedIds(who)).includes(id)).toBe(false);

    const res = await renew(who, id);
    expect(res.status).toBe(200);
    const renewed = await res.json<RideSummary>();
    expect(renewed.expiresAt).toBeGreaterThan(Date.now() + limits.postExpiry.renewExtendMs - DAY);
    expect(renewed.state).not.toBe("expired");
    expect(await feedIds(who)).toContain(id);
  });

  it("refuses a renewal that would pass the maximum, and anyone but the poster", async () => {
    const who = await person();
    const stranger = await person();
    const far = await post(who, recurring({ endsOn: dhakaDay(Date.now() + 150 * DAY) }));
    const res = await renew(who, far.id);
    expect(res.status).toBe(409);
    expect((await res.json<{ error: string }>()).error).toBe("too_far");

    const ride = await post(who, recurring());
    expect((await renew(stranger, ride.id)).status).toBe(404);
  });
});

describe("the feed", () => {
  it("hides expired, pending, rejected and removed rides, and rides still show full", async () => {
    const who = await person();
    const viewer = await person();
    const live = await insertRide({ authorId: who.id });
    const full = await insertRide({ authorId: who.id, seatsRemaining: 0 });
    await insertRide({
      authorId: who.id,
      expiresAt: Date.now() - 1000,
      departsAt: Date.now() - 1000,
    });
    await insertRide({ authorId: who.id, status: "pending_review" });
    await insertRide({ authorId: who.id, status: "rejected" });
    await insertRide({ authorId: who.id, deletedAt: Date.now(), deletedBy: who.id });

    const page = await feed(viewer);
    expect(page.items.map((r) => r.id)).toEqual([live, full]);
    expect(page.items.map((r) => r.state)).toEqual(["open", "full"]);
    expect(page.nextCursor).toBeNull();
    // Not even the poster sees a held ride in the public feed: it is in "my rides".
    expect(await feedIds(who)).toEqual([live, full]);
  });

  it("needs a signed-in user", async () => {
    expect((await call("GET", "/api/rides", null)).status).toBe(401);
  });

  it("has no contact fields or contact values", async () => {
    const who = await person();
    await post(
      who,
      oneOff({
        contacts: { phone: PHONE, whatsapp: WHATSAPP, messenger: "https://m.me/some.one" },
      }),
    );
    const res = await call("GET", "/api/rides", who.token);
    const text = await res.text();
    for (const secret of [PHONE, WHATSAPP, "m.me", "contact", "phone", "whatsapp", "messenger"]) {
      expect(text).not.toContain(secret);
    }
    // Nor the author's identity.
    expect(text).not.toContain(who.username);
    expect(text).not.toContain("authorId");
  });

  it("filters by text in the landmarks or the area names, matching % and _ literally", async () => {
    const who = await person();
    const a = await insertRide({
      authorId: who.id,
      pickupAreaId: A.bashundhara,
      destinationAreaId: A.banani,
      pickupLandmark: "North gate",
      destinationLandmark: null,
    });
    const b = await insertRide({
      authorId: who.id,
      pickupAreaId: A.banani,
      destinationAreaId: A.bashundhara,
      pickupLandmark: null,
      destinationLandmark: "NSU",
    });
    const c = await insertRide({
      authorId: who.id,
      pickupAreaId: A.gulshan,
      destinationAreaId: A.banani,
      pickupLandmark: "Uttara 50% off",
      destinationLandmark: null,
    });
    const d = await insertRide({
      authorId: who.id,
      pickupAreaId: A.gulshan,
      destinationAreaId: A.banani,
      pickupLandmark: "Uttara 50x off",
      destinationLandmark: null,
    });

    // An area name on either end, and a landmark.
    expect(await feedIds(who, "?q=bashundhara")).toEqual([a, b]);
    expect(await feedIds(who, "?q=GULSHAN")).toEqual([c, d]);
    expect(await feedIds(who, "?q=north%20gate")).toEqual([a]);
    expect(await feedIds(who, "?q=nsu")).toEqual([b]);
    expect(await feedIds(who, "?q=50%25")).toEqual([c]);
    expect(await feedIds(who, "?q=50_")).toEqual([]);
    expect(await feedIds(who, "?q=")).toEqual([a, b, c, d]);
  });

  it("filters by vehicle", async () => {
    const who = await person();
    const bike = await insertRide({ authorId: who.id, vehicle: "bike" });
    await insertRide({ authorId: who.id, vehicle: "car" });
    expect(await feedIds(who, "?vehicle=bike")).toEqual([bike]);
    expect((await call("GET", "/api/rides?vehicle=boat", who.token)).status).toBe(400);
  });

  it("filters by date: one-offs leaving that Dhaka day and recurring rides running on its weekday", async () => {
    const who = await person();
    const target = Date.now() + 3 * DAY;
    const [y, m, d] = dhakaDay(target).split("-").map(Number);
    const dayStart = startOfDhakaDay({ year: y, month: m, day: d });
    const weekday = weekdayOf(target);
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

    const onTheDay = await insertRide({ authorId: who.id, departsAt: dayStart + 10 * HOUR });
    const lastMinute = await insertRide({ authorId: who.id, departsAt: dayStart + DAY - 60_000 });
    await insertRide({ authorId: who.id, departsAt: dayStart + DAY + HOUR });
    await insertRide({ authorId: who.id, departsAt: dayStart - HOUR });
    const weekly = await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[weekday] as "sun"]),
      endsOn: dhakaDay(target + 10 * DAY),
    });
    // Runs on that weekday but ends before the date.
    await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[weekday] as "sun"]),
      endsOn: dhakaDay(target - DAY),
      expiresAt: Date.now() + DAY,
    });
    // Ends on the date itself: still running.
    const endsThatDay = await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[weekday] as "sun"]),
      endsOn: dhakaDay(target),
    });
    // Runs on another weekday.
    await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[(weekday + 1) % 7] as "sun"]),
      endsOn: dhakaDay(target + 10 * DAY),
    });

    expect((await feedIds(who, `?date=${dhakaDay(target)}`)).sort((a, b) => a - b)).toEqual(
      [onTheDay, lastMinute, weekly, endsThatDay].sort((a, b) => a - b),
    );
    expect((await call("GET", "/api/rides?date=2026-13-40", who.token)).status).toBe(400);
  });

  it("filters by weekday: recurring rides on it and one-offs leaving on it", async () => {
    const who = await person();
    const target = Date.now() + 3 * DAY;
    const weekday = weekdayOf(target);
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
    const [y, m, d] = dhakaDay(target).split("-").map(Number);
    const dayStart = startOfDhakaDay({ year: y, month: m, day: d });

    const weekly = await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[weekday], names[(weekday + 2) % 7]]),
    });
    await insertRide({
      authorId: who.id,
      kind: "recurring",
      days: daysToMask([names[(weekday + 1) % 7]]),
    });
    const single = await insertRide({ authorId: who.id, departsAt: dayStart + 9 * HOUR });
    // The same weekday next week still counts; the next day does not.
    const nextWeek = await insertRide({ authorId: who.id, departsAt: dayStart + 7 * DAY + HOUR });
    await insertRide({ authorId: who.id, departsAt: dayStart + DAY + HOUR });

    expect((await feedIds(who, `?day=${names[weekday]}`)).sort((a, b) => a - b)).toEqual(
      [weekly, single, nextWeek].sort((a, b) => a - b),
    );
    expect((await call("GET", "/api/rides?day=funday", who.token)).status).toBe(400);
  });

  it("combines filters", async () => {
    const who = await person();
    const hit = await insertRide({ authorId: who.id, vehicle: "bike", pickupAreaId: A.gulshan });
    await insertRide({ authorId: who.id, vehicle: "car", pickupAreaId: A.gulshan });
    await insertRide({ authorId: who.id, vehicle: "bike", pickupAreaId: A.banani });
    expect(await feedIds(who, "?vehicle=bike&q=gulshan")).toEqual([hit]);
    expect(await feedIds(who, `?vehicle=bike&from=${A.gulshan}`)).toEqual([hit]);
  });

  it("pages by cursor, soonest expiry first, without repeats or gaps", async () => {
    const who = await person();
    const base = Date.now() + DAY;
    // Two share an expiry, so the id breaks the tie.
    const expiries = [base + 5 * HOUR, base + HOUR, base + 3 * HOUR, base + HOUR, base + 9 * HOUR];
    const ids: number[] = [];
    for (const at of expiries) ids.push(await insertRide({ authorId: who.id, departsAt: at }));
    const expected = ids
      .map((id, i) => ({ id, at: expiries[i] }))
      .sort((a, b) => a.at - b.at || a.id - b.id)
      .map((r) => r.id);

    const first = await feed(who, "?limit=2");
    expect(first.items.map((r) => r.id)).toEqual(expected.slice(0, 2));
    expect(first.nextCursor).not.toBeNull();
    const second = await feed(who, `?limit=2&cursor=${first.nextCursor}`);
    expect(second.items.map((r) => r.id)).toEqual(expected.slice(2, 4));
    const third = await feed(who, `?limit=2&cursor=${second.nextCursor}`);
    expect(third.items.map((r) => r.id)).toEqual(expected.slice(4));
    expect(third.nextCursor).toBeNull();

    expect((await call("GET", "/api/rides?cursor=abc", who.token)).status).toBe(400);
    expect((await call("GET", "/api/rides?cursor=5", who.token)).status).toBe(400);
  });

  it("caps the page size at the largest allowed", async () => {
    const who = await person();
    await insertRide({ authorId: who.id });
    const res = await call("GET", `/api/rides?limit=${limits.ridePage.maxSize + 100}`, who.token);
    expect(res.status).toBe(200);
  });
});

describe("my rides and one ride", () => {
  it("lists the poster's own rides in any status, newest first, with the rejection reason", async () => {
    const who = await person();
    const other = await person();
    await insertRide({ authorId: other.id });
    const rejected = await post(
      who,
      oneOff({ notes: "call 01712345678 or visit https://bit.ly/buy" }),
    );
    const pending = await insertRide({ authorId: who.id, status: "pending_review" });
    const lapsed = await insertRide({
      authorId: who.id,
      kind: "recurring",
      expiresAt: Date.now() - DAY,
      endsOn: dhakaDay(Date.now() - 2 * DAY),
    });
    await insertRide({ authorId: who.id, deletedAt: Date.now(), deletedBy: who.id });

    const res = await call("GET", "/api/rides/mine", who.token);
    expect(res.status).toBe(200);
    const page = await res.json<RideFeedPage>();
    expect(page.items.map((r) => r.id)).toEqual([lapsed, pending, rejected.id]);
    expect(page.items.map((r) => r.status)).toEqual(["published", "pending_review", "rejected"]);
    expect(page.items[0].state).toBe("expired");
    expect(page.items[2].rejectionCategory).toBeTruthy();
    expect(page.items.every((r) => r.mine)).toBe(true);
    expect(JSON.stringify(page)).not.toContain(PHONE);
  });

  it("pages my rides by cursor", async () => {
    const who = await person();
    const ids: number[] = [];
    for (let i = 0; i < 3; i++) ids.push(await insertRide({ authorId: who.id }));
    const first = await (
      await call("GET", "/api/rides/mine?limit=2", who.token)
    ).json<RideFeedPage>();
    expect(first.items.map((r) => r.id)).toEqual([ids[2], ids[1]]);
    const second = await (
      await call("GET", `/api/rides/mine?limit=2&cursor=${first.nextCursor}`, who.token)
    ).json<RideFeedPage>();
    expect(second.items.map((r) => r.id)).toEqual([ids[0]]);
    expect(second.nextCursor).toBeNull();
  });

  it("shows a ride's detail without contacts, and hides a held, removed or lapsed one from others", async () => {
    const who = await person();
    const viewer = await person();
    const live = await insertRide({ authorId: who.id });
    const held = await insertRide({ authorId: who.id, status: "pending_review" });
    const lapsed = await insertRide({
      authorId: who.id,
      expiresAt: Date.now() - 1000,
      departsAt: Date.now() - 1000,
    });

    const res = await call("GET", `/api/rides/${live}`, viewer.token);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ id: live, mine: false });
    expect(text).not.toContain(PHONE);

    expect((await call("GET", `/api/rides/${held}`, viewer.token)).status).toBe(404);
    expect((await call("GET", `/api/rides/${held}`, who.token)).status).toBe(200);
    expect((await call("GET", `/api/rides/${lapsed}`, viewer.token)).status).toBe(404);
    const own = await call("GET", `/api/rides/${lapsed}`, who.token);
    expect((await own.json<RideSummary>()).state).toBe("expired");
    expect((await call("GET", "/api/rides/99999", viewer.token)).status).toBe(404);
  });
});

describe("contact reveal", () => {
  it("needs a login and returns the contacts and nothing else", async () => {
    const who = await person();
    const viewer = await person();
    const ride = await post(
      who,
      oneOff({ contacts: { phone: PHONE, messenger: "https://m.me/some.one" } }),
    );

    expect((await call("GET", `/api/rides/${ride.id}/contact`, null)).status).toBe(401);
    const res = await call("GET", `/api/rides/${ride.id}/contact`, viewer.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contacts: { phone: PHONE, messenger: "https://m.me/some.one" },
    });
  });

  it("is a 404 for a held, removed or lapsed ride", async () => {
    const who = await person();
    const viewer = await person();
    for (const f of [
      { status: "pending_review" },
      { deletedAt: Date.now(), deletedBy: who.id },
      { expiresAt: Date.now() - 1000, departsAt: Date.now() - 1000 },
    ]) {
      const id = await insertRide({ authorId: who.id, ...f });
      expect((await call("GET", `/api/rides/${id}/contact`, viewer.token)).status).toBe(404);
    }
  });

  it("is rate limited per user", async () => {
    const who = await person();
    const viewer = await person();
    const id = await insertRide({ authorId: who.id });
    for (let i = 0; i < limits.contactReveal.limit; i++) {
      expect((await call("GET", `/api/rides/${id}/contact`, viewer.token)).status).toBe(200);
    }
    const blocked = await call("GET", `/api/rides/${id}/contact`, viewer.token);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("own contacts for the edit form", () => {
  const ended = (authorId: number) =>
    insertRide({
      authorId,
      kind: "recurring",
      endsOn: dhakaDay(Date.now() - 3 * DAY),
      expiresAt: Date.now() - 2 * DAY,
    });

  it("gives the poster an ended recurring ride's contacts, and they can set a new end date", async () => {
    const who = await person();
    const id = await ended(who.id);
    const res = await call("GET", `/api/rides/${id}/own-contact`, who.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ contacts: { phone: PHONE } });

    const endsOn = dhakaDay(Date.now() + 20 * DAY);
    const patched = await call("PATCH", `/api/rides/${id}`, who.token, { endsOn });
    expect(patched.status).toBe(200);
    expect((await patched.json<RideSummary>()).endsOn).toBe(endsOn);
  });

  it("is a 404 for anyone else and for a removed ride, and needs a login", async () => {
    const who = await person();
    const other = await person();
    const id = await insertRide({ authorId: who.id });
    const gone = await insertRide({ authorId: who.id, deletedAt: Date.now(), deletedBy: who.id });
    expect((await call("GET", `/api/rides/${id}/own-contact`, other.token)).status).toBe(404);
    expect((await call("GET", `/api/rides/${gone}/own-contact`, who.token)).status).toBe(404);
    expect((await call("GET", `/api/rides/${id}/own-contact`, null)).status).toBe(401);
  });

  it("does not use up the reveal limit", async () => {
    const who = await person();
    const id = await insertRide({ authorId: who.id });
    for (let i = 0; i < limits.contactReveal.limit + 2; i++) {
      expect((await call("GET", `/api/rides/${id}/own-contact`, who.token)).status).toBe(200);
    }
    expect((await call("GET", `/api/rides/${id}/contact`, who.token)).status).toBe(200);
  });
});

describe("author delete", () => {
  it("hides the ride at once, from the feed, the detail and the contact reveal", async () => {
    const who = await person();
    const viewer = await person();
    const ride = await post(who, oneOff());
    expect(await feedIds(viewer)).toEqual([ride.id]);

    const res = await call("DELETE", `/api/rides/${ride.id}`, who.token);
    expect(res.status).toBe(200);
    expect(await feedIds(viewer)).toEqual([]);
    expect((await call("GET", `/api/rides/${ride.id}`, viewer.token)).status).toBe(404);
    expect((await call("GET", `/api/rides/${ride.id}/contact`, viewer.token)).status).toBe(404);
    expect((await call("GET", "/api/rides/mine", who.token)).status).toBe(200);
    expect(
      (await (await call("GET", "/api/rides/mine", who.token)).json<RideFeedPage>()).items,
    ).toEqual([]);

    const row = await rideRow(ride.id);
    expect(row).toMatchObject({ deleted_by: who.id });
    const audit = await env.DB.prepare(
      "SELECT reason FROM audit_log WHERE action = 'soft_delete' AND target_type = 'ride'",
    ).first<{ reason: string }>();
    expect(audit?.reason).toBe("author");
  });

  it("is refused for another user, and the ride stays up", async () => {
    const who = await person();
    const stranger = await person();
    const ride = await post(who, oneOff());
    expect((await call("DELETE", `/api/rides/${ride.id}`, stranger.token)).status).toBe(404);
    expect((await rideRow(ride.id))?.deleted_at).toBeNull();
    expect(await feedIds(stranger)).toEqual([ride.id]);
    expect((await call("DELETE", `/api/rides/${ride.id}`, null)).status).toBe(401);
  });
});

describe("cron purge", () => {
  const exists = async (id: number) => (await rideRow(id)) !== null;

  it("deletes an author-deleted ride after the window, and an expired one after its own", async () => {
    const who = await person();
    const now = Date.now();
    const deletedLong = await insertRide({
      authorId: who.id,
      deletedAt: now - limits.authorDeletePurgeMs - HOUR,
      deletedBy: who.id,
    });
    const deletedRecently = await insertRide({
      authorId: who.id,
      deletedAt: now - HOUR,
      deletedBy: who.id,
    });
    const lapsedLong = await insertRide({
      authorId: who.id,
      expiresAt: now - limits.postExpiry.expiredPurgeMs - HOUR,
      departsAt: now - limits.postExpiry.expiredPurgeMs - HOUR,
    });
    const lapsedRecently = await insertRide({
      authorId: who.id,
      expiresAt: now - HOUR,
      departsAt: now - HOUR,
    });
    const live = await insertRide({ authorId: who.id });
    const removedByMod = await insertRide({
      authorId: who.id,
      deletedAt: now - limits.authorDeletePurgeMs - HOUR,
      deletedBy: (await person({ role: "mod" })).id,
    });

    const removed = await runCronJobs(db(), now);
    expect(removed.rides).toBe(2);
    expect(await exists(deletedLong)).toBe(false);
    expect(await exists(lapsedLong)).toBe(false);
    expect(await exists(deletedRecently)).toBe(true);
    expect(await exists(lapsedRecently)).toBe(true);
    expect(await exists(live)).toBe(true);
    // A mod's removal is never purged by the author-delete rule.
    expect(await exists(removedByMod)).toBe(true);
  });

  it("keeps a ride with an open report, and deletes it once the report is closed", async () => {
    const who = await person();
    const reporter = await person();
    const now = Date.now();
    const id = await insertRide({
      authorId: who.id,
      deletedAt: now - limits.authorDeletePurgeMs - HOUR,
      deletedBy: who.id,
    });
    await env.DB.prepare(
      "INSERT INTO reports (target_type, target_id, reporter_id, reason, status, created_at) VALUES ('ride', ?, ?, 'a scam', 'open', ?)",
    )
      .bind(String(id), reporter.id, now)
      .run();

    await runCronJobs(db(), now);
    expect(await exists(id)).toBe(true);

    await env.DB.prepare("UPDATE reports SET status = 'resolved'").run();
    await runCronJobs(db(), now);
    expect(await exists(id)).toBe(false);
  });
});

describe("reports and moderation", () => {
  async function reportedRide() {
    const author = await person();
    const reporter = await person();
    const mod = await person({ role: "mod" });
    const admin = await person({ role: "admin" });
    const ride = await post(author, oneOff());
    const reported = await call("POST", "/api/reports", reporter.token, {
      targetType: "ride",
      targetId: ride.id,
      reason: "This looks like a scam",
    });
    expect(reported.status).toBe(201);
    const { id: reportId } = await reported.json<{ id: number }>();
    return { author, reporter, mod, admin, ride, reportId };
  }

  it("sends a report to the mod queue labelled with the route, never a contact, and names the poster", async () => {
    const { author, reporter, mod, ride } = await reportedRide();
    const queue = await call("GET", "/api/mod/queue", mod.token);
    expect(queue.status).toBe(200);
    const text = await queue.text();
    expect(JSON.parse(text).items).toEqual([
      expect.objectContaining({
        kind: "report",
        targetType: "ride",
        targetId: String(ride.id),
        targetLabel: "Bashundhara R/A (NSU gate) → Mirpur (Mirpur 10)",
        targetAuthor: author.username,
        reporter: reporter.username,
      }),
    ]);
    expect(text).not.toContain(PHONE);
  });

  it("refuses a report on a ride the reporter cannot see", async () => {
    const author = await person();
    const reporter = await person();
    const held = await insertRide({ authorId: author.id, status: "pending_review" });
    const res = await call("POST", "/api/reports", reporter.token, {
      targetType: "ride",
      targetId: held,
      reason: "This looks like a scam",
    });
    expect(res.status).toBe(404);
  });

  it("lets a mod remove a reported ride, tells the poster it was a ride, and lets an admin reverse it", async () => {
    const { author, reporter, mod, admin, ride, reportId } = await reportedRide();
    expect(await feedIds(reporter)).toEqual([ride.id]);

    const res = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
      reason: "Looks like a scam",
    });
    expect(res.status).toBe(200);
    // Soft-deleted: the row stays, the feed and the detail lose it at once.
    expect((await rideRow(ride.id))?.deleted_at).not.toBeNull();
    expect(await feedIds(reporter)).toEqual([]);
    expect((await call("GET", `/api/rides/${ride.id}`, reporter.token)).status).toBe(404);

    const told = await inbox(author.id);
    expect(told).toHaveLength(1);
    expect(told[0].type).toBe("content_removed");
    expect(JSON.parse(told[0].payload)).toEqual({ kind: "ride", reason: "Looks like a scam" });
    expect(told[0].payload).not.toContain(String(ride.id));
    expect(await inbox(reporter.id)).toEqual([]);

    const removal = (await env.DB.prepare(
      "SELECT id FROM audit_log WHERE action = 'soft_delete' AND target_type = 'ride'",
    ).first<{ id: number }>())!;
    expect(
      (
        await call("POST", `/api/admin/audit/${removal.id}/reverse`, mod.token, {
          reason: "oops",
        })
      ).status,
    ).toBe(403);
    const reversed = await call("POST", `/api/admin/audit/${removal.id}/reverse`, admin.token, {
      reason: "It was fine",
    });
    expect(reversed.status).toBe(201);
    expect((await rideRow(ride.id))?.deleted_at).toBeNull();
    expect(await feedIds(reporter)).toEqual([ride.id]);
  });

  it("does not offer an author's own delete for reversal", async () => {
    const author = await person();
    const admin = await person({ role: "admin" });
    const ride = await post(author, oneOff());
    await call("DELETE", `/api/rides/${ride.id}`, author.token);
    const removal = (await env.DB.prepare(
      "SELECT id FROM audit_log WHERE action = 'soft_delete' AND target_type = 'ride'",
    ).first<{ id: number }>())!;
    const res = await call("POST", `/api/admin/audit/${removal.id}/reverse`, admin.token, {
      reason: "Bring it back",
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await rideRow(ride.id))?.deleted_at).not.toBeNull();
  });

  it("holds a ride for review and publishes it when a mod approves it", async () => {
    const author = await person();
    const mod = await person({ role: "mod" });
    const held = await insertRide({
      authorId: author.id,
      status: "pending_review",
      notes: "Back seat is free",
    });
    const queue = await (
      await call("GET", "/api/mod/queue", mod.token)
    ).json<{
      items: { targetType: string; text: string[] }[];
    }>();
    expect(queue.items[0]).toMatchObject({
      targetType: "ride",
      text: ["NSU gate", "Mirpur 10", "Back seat is free"],
    });
    expect(JSON.stringify(queue)).not.toContain(PHONE);

    const res = await call("POST", `/api/mod/posts/ride/${held}/approve`, mod.token, {});
    expect(res.status).toBe(200);
    expect((await rideRow(held))?.status).toBe("published");
    expect(await feedIds(author)).toEqual([held]);
  });
});

describe("ride areas", () => {
  async function addArea(slug: string, name: string, parentId: number | null = null) {
    const now = Date.now();
    return (await env.DB.prepare(
      "INSERT INTO areas (slug, name, parent_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?) RETURNING id",
    )
      .bind(slug, name, parentId, now, now)
      .first<{ id: number }>())!.id;
  }
  const hide = (id: number) =>
    env.DB.prepare("UPDATE areas SET hidden = 1, hidden_reason = 'test' WHERE id = ?")
      .bind(id)
      .run();

  it("needs a pickup and a destination area", async () => {
    const who = await person();
    const body = async (extra: Record<string, unknown>) =>
      (await call("POST", "/api/rides", who.token, extra)).status;
    const { pickupAreaId, destinationAreaId, ...rest } = oneOff();
    expect(await body(rest)).toBe(400);
    expect(await body({ ...rest, pickupAreaId })).toBe(400);
    expect(await body({ ...rest, destinationAreaId })).toBe(400);
    expect(await body(oneOff({ pickupAreaId: "Bashundhara" }))).toBe(400);
  });

  it("refuses an unknown or hidden area, on create and when an edit changes it", async () => {
    const who = await person();
    const gone = await addArea("old-place", "Old place");
    await hide(gone);
    const create = async (extra: Record<string, unknown>) => {
      const res = await call("POST", "/api/rides", who.token, oneOff(extra));
      return [res.status, (await res.json<{ error?: string }>()).error] as const;
    };
    expect(await create({ pickupAreaId: 999_999 })).toEqual([400, "invalid_area"]);
    expect(await create({ destinationAreaId: gone })).toEqual([400, "invalid_area"]);

    const ride = await post(who, oneOff());
    const patch = async (extra: Record<string, unknown>) => {
      const res = await call("PATCH", `/api/rides/${ride.id}`, who.token, extra);
      return [res.status, (await res.json<{ error?: string }>()).error] as const;
    };
    expect(await patch({ pickupAreaId: gone })).toEqual([400, "invalid_area"]);
    expect(await patch({ destinationAreaId: 999_999 })).toEqual([400, "invalid_area"]);
    // Nothing was written.
    expect((await rideRow(ride.id))?.pickup_area_id).toBe(A.bashundhara);
  });

  it("refuses a sub-area whose parent is hidden", async () => {
    const who = await person();
    const parent = await addArea("zone", "Zone");
    const sub = await addArea("zone-block-a", "Block A", parent);
    expect(
      (await call("POST", "/api/rides", who.token, oneOff({ pickupAreaId: sub }))).status,
    ).toBe(201);
    await hide(parent);
    const res = await call("POST", "/api/rides", who.token, oneOff({ pickupAreaId: sub }));
    expect(res.status).toBe(400);
  });

  it("keeps a ride's area after the area is hidden, and still accepts an edit that leaves it alone", async () => {
    const who = await person();
    const viewer = await person();
    const place = await addArea("old-place", "Old place");
    const ride = await post(who, oneOff({ pickupAreaId: place }));
    await hide(place);

    const detail = await call("GET", `/api/rides/${ride.id}`, viewer.token);
    expect((await detail.json<RideSummary>()).pickupArea).toEqual({ id: place, name: "Old place" });
    expect(await feedIds(viewer)).toEqual([ride.id]);

    const edited = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      pickupAreaId: place,
      pricePerSeatTaka: 200,
      destinationAreaId: A.banani,
    });
    expect(edited.status).toBe(200);
    expect(await edited.json<RideSummary>()).toMatchObject({
      pickupArea: { id: place },
      destinationArea: { id: A.banani, name: "Banani" },
      pricePerSeatTaka: 200,
    });
  });

  it("makes the landmarks optional, blank means none, and a patch can set and clear them", async () => {
    const who = await person();
    const { pickupLandmark, destinationLandmark, ...bare } = oneOff();
    expect(pickupLandmark && destinationLandmark).toBeTruthy();
    const ride = await post(who, bare);
    expect(ride).toMatchObject({ pickupLandmark: null, destinationLandmark: null });

    const blank = await post(who, oneOff({ pickupLandmark: "   ", destinationLandmark: "" }));
    expect(blank).toMatchObject({ pickupLandmark: null, destinationLandmark: null });

    const set = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      pickupLandmark: "North gate",
    });
    expect(await set.json<RideSummary>()).toMatchObject({
      pickupLandmark: "North gate",
      status: "published",
    });
    const cleared = await call("PATCH", `/api/rides/${ride.id}`, who.token, {
      pickupLandmark: null,
    });
    expect((await cleared.json<RideSummary>()).pickupLandmark).toBeNull();
  });

  it("screens the landmarks on create and on edit", async () => {
    const who = await person();
    const bad = "call 01712345678 or visit https://bit.ly/buy";
    const created = await call(
      "POST",
      "/api/rides",
      who.token,
      oneOff({ destinationLandmark: bad }),
    );
    expect(created.status).toBe(201);
    expect((await created.json<RideSummary>()).status).toBe("rejected");

    const ride = await post(who, oneOff());
    expect(ride.status).toBe("published");
    const edited = await call("PATCH", `/api/rides/${ride.id}`, who.token, { pickupLandmark: bad });
    expect((await edited.json<RideSummary>()).status).toBe("rejected");
  });

  it("filters by pickup and destination area, a broad area also matching its sub-areas", async () => {
    const who = await person();
    const sub = await addArea("mirpur-10", "Mirpur 10", A.mirpur);
    const otherSub = await addArea("banani-11", "Banani 11", A.banani);
    const toMirpur = await insertRide({ authorId: who.id, destinationAreaId: A.mirpur });
    const toSub = await insertRide({ authorId: who.id, destinationAreaId: sub });
    const toBanani = await insertRide({ authorId: who.id, destinationAreaId: A.banani });
    const toOtherSub = await insertRide({ authorId: who.id, destinationAreaId: otherSub });
    const fromUttara = await insertRide({
      authorId: who.id,
      pickupAreaId: A.uttara,
      destinationAreaId: sub,
    });

    // A broad area takes its sub-areas; a sub-area only itself.
    expect(await feedIds(who, `?to=${A.mirpur}`)).toEqual([toMirpur, toSub, fromUttara]);
    expect(await feedIds(who, `?to=${sub}`)).toEqual([toSub, fromUttara]);
    expect(await feedIds(who, `?to=${A.banani}`)).toEqual([toBanani, toOtherSub]);
    // From and to combine, and with the other filters.
    expect(await feedIds(who, `?from=${A.uttara}&to=${A.mirpur}`)).toEqual([fromUttara]);
    expect(await feedIds(who, `?from=${A.bashundhara}&to=${A.mirpur}`)).toEqual([toMirpur, toSub]);
    expect(await feedIds(who, `?from=${A.bashundhara}&to=${A.mirpur}&vehicle=bike`)).toEqual([]);
    expect(await feedIds(who, "?from=999999")).toEqual([]);
    expect((await call("GET", "/api/rides?from=abc", who.token)).status).toBe(400);
    expect(await feedIds(who)).toHaveLength(5);
  });

  it("filters by an area a ride kept after it was hidden", async () => {
    const who = await person();
    const place = await addArea("old-place", "Old place");
    const ride = await insertRide({ authorId: who.id, pickupAreaId: place });
    await hide(place);
    expect(await feedIds(who, `?from=${place}`)).toEqual([ride]);
  });

  it("names the areas in the report queue label, with the landmarks when there are some", async () => {
    const author = await person();
    const reporter = await person();
    const mod = await person({ role: "mod" });
    const ride = await post(author, oneOff({ pickupLandmark: undefined }));
    await call("POST", "/api/reports", reporter.token, {
      targetType: "ride",
      targetId: ride.id,
      reason: "This looks like a scam",
    });
    const queue = await (
      await call("GET", "/api/mod/queue", mod.token)
    ).json<{
      items: { targetLabel: string }[];
    }>();
    expect(queue.items[0]?.targetLabel).toBe("Bashundhara R/A → Mirpur (Mirpur 10)");
  });
});
