import { Hono, type Context } from "hono";
import type { z } from "zod";
import { daysToMask, timeToMinutes, WEEKDAYS } from "../../../shared/rides";
import { pageQuery } from "../../../shared/schemas/common";
import {
  rideFeedQuery,
  rideInput,
  ridePatch,
  rideSeatsInput,
  type rideDetail,
  type rideFeedPage,
} from "../../../shared/schemas/rides";
import { dhakaDate, formatDhakaDate, parseDhakaDate } from "../../../shared/time";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv, SessionUser } from "../../middleware/types";
import { submitPost } from "../../moderation/submit";
import { pageParams, toPage } from "../../paging";
import { ownContacts, revealContact } from "../../posts/contactReveal";
import { deleteOwnPost } from "../../posts/authorDelete";
import { postBlocked } from "../../posts/postBlocked";
import {
  computeExpiresAt,
  NOT_RENEWABLE,
  RENEWABLE,
  renewExpiresAt,
  type ExpiryFailure,
} from "../../posts/expiry";
import { rides } from "../../db/schema";
import { areasRepo } from "../../repos/areas";
import { ridesRepo, type RidePatch, type RideRow } from "../../repos/rides";
import { validateJson, validateQuery } from "../../validate";
import {
  decodeRideCursor,
  encodeRideCursor,
  rideState,
  toRideDetailView,
  toRideView,
} from "./view";

const user = (c: Context<AppEnv>): SessionUser => c.get("user") as SessionUser;

const notFound = (c: Context) => c.json({ error: "not_found" }, 404);

function paramId(c: Context): number | null {
  const n = Number(c.req.param("id"));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const ridePageSizes = limits.ridePage;

const PROBLEMS = {
  departure: {
    in_past: "Pick a departure time in the future.",
    too_far: "That departure is too far ahead.",
  },
  endDate: {
    in_past: "The end date can't be in the past.",
    too_far: "That end date is too far ahead.",
  },
} as const;

/** The 400 for a date the shared schema accepts but the clock refuses. `not_renewable` never comes from a date. */
function badDate(c: Context, field: keyof typeof PROBLEMS, reason: ExpiryFailure) {
  const problems: Record<string, string> = PROBLEMS[field];
  return c.json(
    {
      error: field === "departure" ? "invalid_departure" : "invalid_end_date",
      message: problems[reason] ?? "That date can't be used.",
    },
    400,
  );
}

/** When a recurring ride ends if no date is given: the Dhaka day `limits.postExpiry.defaultMs` from now. */
const defaultEndsOn = (now: number) =>
  formatDhakaDate(dhakaDate(now + limits.postExpiry.defaultMs));

/** The expiry of a recurring ride that runs through `endsOn` (a valid "YYYY-MM-DD"). */
function recurringExpiry(endsOn: string, now: number) {
  const date = parseDhakaDate(endsOn);
  return date ? computeExpiresAt({ throughDhakaDate: date }, now) : null;
}

const storedContacts = (r: RideRow) => ({
  phone: r.phone ?? undefined,
  whatsapp: r.whatsapp ?? undefined,
  messenger: r.messenger ?? undefined,
});

const sameContacts = (a: ReturnType<typeof storedContacts>, b: ReturnType<typeof storedContacts>) =>
  a.phone === b.phone && a.whatsapp === b.whatsapp && a.messenger === b.messenger;

/**
 * The 400 for a ride whose pickup or destination area does not exist or is hidden, or null when every
 * id in `ids` can be used. Only the areas being set are checked, so a ride keeps an area hidden later.
 */
async function invalidArea(c: Context<AppEnv>, ids: number[]) {
  const usable = await areasRepo(getDb(c.env.DB)).usableIds(ids);
  return ids.every((id) => usable.has(id))
    ? null
    : c.json(
        { error: "invalid_area", message: "Pick a pickup and a destination area from the list." },
        400,
      );
}

const updateLimit = (c: Context<AppEnv>, me: SessionUser, now: number) =>
  rateLimit(
    getDb(c.env.DB),
    `ride:update:${me.id}`,
    limits.rideUpdate.limit,
    limits.rideUpdate.windowMs,
    now,
  );

/**
 * Rides. A ride is a user-written post: screened on create and again on any edit that changes its
 * landmarks, notes or contacts. Contacts are only returned by `GET /:id/contact` (login, rate limited),
 * never by the feed, the detail or "my rides". Exact pins are only on the single-ride responses (the
 * detail, create, edit, seats, renew), never on the feed or "my rides". Reports go through `POST /api/reports` with the `ride`
 * target type. The platform does not arrange or guarantee rides.
 */
export const rideRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .post("/", validateJson(rideInput), async (c) => {
    const me = user(c);
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `ride:create:${me.id}`,
      limits.rideCreate.limit,
      limits.rideCreate.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    let expiry;
    let schedule;
    let endsOn: string | null = null;
    if (body.kind === "one_off") {
      expiry = computeExpiresAt({ at: body.departsAt }, now);
      if (!expiry.ok) return badDate(c, "departure", expiry.reason);
      schedule = {
        kind: "one_off" as const,
        departsAt: body.departsAt,
        days: null,
        departureMinutes: null,
        endsOn: null,
      };
    } else {
      endsOn = body.endsOn ?? defaultEndsOn(now);
      const result = recurringExpiry(endsOn, now);
      if (!result) return badDate(c, "endDate", "in_past");
      expiry = result;
      if (!expiry.ok) return badDate(c, "endDate", expiry.reason);
      schedule = {
        kind: "recurring" as const,
        departsAt: null,
        days: daysToMask(body.days),
        departureMinutes: timeToMinutes(body.departureTime),
        endsOn,
      };
    }

    const badArea = await invalidArea(c, [body.pickupAreaId, body.destinationAreaId]);
    if (badArea) return badArea;

    const repo = ridesRepo(db);
    if ((await repo.countOpenMine(me.id, now)) >= limits.rideOpenMax) {
      return c.json(
        {
          error: "too_many_open",
          message: `You can have ${limits.rideOpenMax} rides at a time.`,
        },
        409,
      );
    }

    const result = await submitPost(
      db,
      c.env,
      {
        user: me,
        targetType: "ride",
        input: {
          texts: [body.pickupLandmark, body.destinationLandmark, body.notes].filter(
            (t): t is string => t !== undefined,
          ),
          contacts: body.contacts,
        },
        save: (moderation) =>
          repo.insert({
            authorId: me.id,
            pickupAreaId: body.pickupAreaId,
            pickupLandmark: body.pickupLandmark ?? null,
            destinationAreaId: body.destinationAreaId,
            destinationLandmark: body.destinationLandmark ?? null,
            pickupLat: body.pickupPoint?.lat ?? null,
            pickupLng: body.pickupPoint?.lng ?? null,
            destinationLat: body.destinationPoint?.lat ?? null,
            destinationLng: body.destinationPoint?.lng ?? null,
            vehicle: body.vehicle,
            totalSeats: body.totalSeats,
            seatsRemaining: body.totalSeats,
            pricePerSeatTaka: body.pricePerSeatTaka,
            notes: body.notes ?? null,
            phone: body.contacts.phone ?? null,
            whatsapp: body.contacts.whatsapp ?? null,
            messenger: body.contacts.messenger ?? null,
            ...schedule,
            expiresAt: expiry.expiresAt,
            createdAt: now,
            updatedAt: now,
            ...moderation,
          }),
      },
      { now },
    );
    if (!result.ok) return postBlocked(c, result);
    const created = await repo.find(result.id);
    return created
      ? c.json(toRideDetailView(created, me.id, now) satisfies z.infer<typeof rideDetail>, 201)
      : notFound(c);
  })
  // The public feed. Registered before "/:id" along with "/mine".
  .get("/", validateQuery(rideFeedQuery), async (c) => {
    const me = user(c);
    const { cursor, limit, q, from, to, vehicle, date, day } = c.req.valid("query");
    const params = pageParams({ limit }, ridePageSizes);
    const start = cursor === undefined ? null : decodeRideCursor(cursor);
    if (!params || (cursor !== undefined && !start)) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const now = Date.now();
    const rows = await ridesRepo(getDb(c.env.DB)).feed(
      { id: me.id, role: me.role },
      now,
      {
        q: q === "" ? undefined : q,
        from,
        to,
        vehicle,
        date,
        day: day === undefined ? undefined : WEEKDAYS.indexOf(day),
      },
      params.size + 1,
      start,
    );
    const items = rows.slice(0, params.size);
    const last = items.at(-1);
    return c.json({
      items: items.map((r) => toRideView(r, me.id, now)),
      nextCursor: rows.length > params.size && last ? encodeRideCursor(last) : null,
    } satisfies z.infer<typeof rideFeedPage>);
  })
  .get("/mine", validateQuery(pageQuery), async (c) => {
    const me = user(c);
    const { cursor, limit } = c.req.valid("query");
    const params = pageParams({ cursor, limit }, ridePageSizes);
    if (!params) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const now = Date.now();
    const rows = await ridesRepo(getDb(c.env.DB)).listMine(me.id, params.size + 1, params.cursor);
    const page = toPage(rows, params.size);
    return c.json({
      items: page.items.map((r) => toRideView(r, me.id, now)),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof rideFeedPage>);
  })
  .get("/:id", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const now = Date.now();
    const ride = await ridesRepo(getDb(c.env.DB)).findVisible(id, { id: me.id, role: me.role });
    if (!ride) return notFound(c);
    // Someone else's lapsed ride is gone as far as they can tell; its poster can still renew it.
    if (ride.authorId !== me.id && rideState(ride, now) === "expired") return notFound(c);
    return c.json(toRideDetailView(ride, me.id, now) satisfies z.infer<typeof rideDetail>);
  })
  .get("/:id/contact", revealContact(rides))
  .get("/:id/own-contact", ownContacts(rides))
  .delete("/:id", deleteOwnPost("ride"))
  .patch("/:id", validateJson(ridePatch), async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await updateLimit(c, me, now);
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const repo = ridesRepo(db);
    const ride = await repo.find(id);
    // Someone else's ride is a 404, the same as one that does not exist.
    if (!ride || ride.authorId !== me.id || ride.deletedAt !== null) return notFound(c);

    const oneOff = ride.kind === "one_off";
    if (
      oneOff
        ? body.days !== undefined || body.departureTime !== undefined || body.endsOn !== undefined
        : body.departsAt !== undefined
    ) {
      return c.json(
        {
          error: "wrong_kind",
          message: oneOff
            ? "A one-off ride has a departure time, not days or an end date."
            : "A recurring ride has days and an end date, not one departure time.",
        },
        400,
      );
    }

    const patch: RidePatch = {};
    // Only an area that is changing has to be visible: a ride keeps one hidden since it was posted.
    const newAreas = [
      body.pickupAreaId !== undefined && body.pickupAreaId !== ride.pickupAreaId
        ? body.pickupAreaId
        : null,
      body.destinationAreaId !== undefined && body.destinationAreaId !== ride.destinationAreaId
        ? body.destinationAreaId
        : null,
    ].filter((v): v is number => v !== null);
    const badArea = await invalidArea(c, newAreas);
    if (badArea) return badArea;
    if (body.pickupAreaId !== undefined) patch.pickupAreaId = body.pickupAreaId;
    if (body.destinationAreaId !== undefined) patch.destinationAreaId = body.destinationAreaId;
    // Blank or null clears a landmark.
    if (body.pickupLandmark !== undefined) patch.pickupLandmark = body.pickupLandmark || null;
    if (body.destinationLandmark !== undefined) {
      patch.destinationLandmark = body.destinationLandmark || null;
    }
    // A point sets or moves a pin, null removes it; each end is independent. Both columns of a pin go in
    // one UPDATE, so the both-or-none check holds.
    if (body.pickupPoint !== undefined) {
      patch.pickupLat = body.pickupPoint?.lat ?? null;
      patch.pickupLng = body.pickupPoint?.lng ?? null;
    }
    if (body.destinationPoint !== undefined) {
      patch.destinationLat = body.destinationPoint?.lat ?? null;
      patch.destinationLng = body.destinationPoint?.lng ?? null;
    }
    if (body.vehicle !== undefined) patch.vehicle = body.vehicle;
    if (body.totalSeats !== undefined) patch.totalSeats = body.totalSeats;
    if (body.pricePerSeatTaka !== undefined) patch.pricePerSeatTaka = body.pricePerSeatTaka;
    if (body.notes !== undefined)
      patch.notes = body.notes === null || body.notes === "" ? null : body.notes;
    if (body.contacts) {
      patch.phone = body.contacts.phone ?? null;
      patch.whatsapp = body.contacts.whatsapp ?? null;
      patch.messenger = body.contacts.messenger ?? null;
    }
    if (body.departsAt !== undefined) {
      // One-off rides aren't renewable: once it has left, a new departure is a new post.
      if (ride.expiresAt <= now) {
        return c.json(
          { error: "ride_left", message: "This ride has left. Post a new one instead." },
          409,
        );
      }
      const expiry = computeExpiresAt({ at: body.departsAt }, now);
      if (!expiry.ok) return badDate(c, "departure", expiry.reason);
      patch.departsAt = body.departsAt;
      patch.expiresAt = expiry.expiresAt;
    }
    if (body.days !== undefined) patch.days = daysToMask(body.days);
    if (body.departureTime !== undefined)
      patch.departureMinutes = timeToMinutes(body.departureTime);
    if (body.endsOn !== undefined) {
      const expiry = recurringExpiry(body.endsOn, now);
      if (!expiry) return badDate(c, "endDate", "in_past");
      if (!expiry.ok) return badDate(c, "endDate", expiry.reason);
      patch.endsOn = body.endsOn;
      patch.expiresAt = expiry.expiresAt;
    }

    const pickupLandmark =
      patch.pickupLandmark === undefined ? ride.pickupLandmark : patch.pickupLandmark;
    const destinationLandmark =
      patch.destinationLandmark === undefined
        ? ride.destinationLandmark
        : patch.destinationLandmark;
    const notes = patch.notes === undefined ? ride.notes : patch.notes;
    const contacts = body.contacts ?? storedContacts(ride);
    const screenedChanged =
      pickupLandmark !== ride.pickupLandmark ||
      destinationLandmark !== ride.destinationLandmark ||
      notes !== ride.notes ||
      !sameContacts(contacts, storedContacts(ride));

    if (screenedChanged) {
      // The same sequence as a new post: may they post, screen, save the row with the result, audit.
      const result = await submitPost(
        db,
        c.env,
        {
          user: me,
          targetType: "ride",
          input: {
            texts: [pickupLandmark, destinationLandmark, notes].filter((t): t is string => !!t),
            contacts,
          },
          previousStatus: ride.status,
          save: async (moderation) => {
            await repo.update(id, { ...patch, ...moderation }, now);
            return id;
          },
        },
        { now },
      );
      if (!result.ok) return postBlocked(c, result);
    } else {
      await repo.update(id, patch, now);
    }
    const updated = await repo.find(id);
    return updated
      ? c.json(toRideDetailView(updated, me.id, now) satisfies z.infer<typeof rideDetail>)
      : notFound(c);
  })
  .post("/:id/seats", validateJson(rideSeatsInput), (c) =>
    setSeats(c, c.req.valid("json").seatsRemaining),
  )
  .post("/:id/full", (c) => setSeats(c, 0))
  .post("/:id/renew", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await updateLimit(c, me, now);
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const repo = ridesRepo(db);
    const ride = await repo.find(id);
    if (!ride || ride.authorId !== me.id || ride.deletedAt !== null) return notFound(c);

    // A one-off ride ends when it departs; only a recurring ride can be renewed, lapsed or not.
    const renewed = renewExpiresAt(
      ride.kind === "recurring" ? RENEWABLE : NOT_RENEWABLE,
      ride.expiresAt,
      now,
    );
    if (!renewed.ok) {
      return c.json(
        renewed.reason === "not_renewable"
          ? {
              error: "not_renewable",
              message: "A one-off ride can't be renewed. Post a new one instead.",
            }
          : { error: "too_far", message: "This ride already runs as far ahead as it can." },
        409,
      );
    }
    // The ride runs through the whole of its last Dhaka day: round the new expiry up to that day's end.
    const endsOn = dhakaDate(renewed.expiresAt - 1);
    const next = recurringExpiry(formatDhakaDate(endsOn), now);
    if (
      !next?.ok ||
      !(await repo.renew(
        id,
        me.id,
        { expiresAt: next.expiresAt, endsOn: formatDhakaDate(endsOn) },
        now,
      ))
    ) {
      return c.json(
        { error: "too_far", message: "This ride already runs as far ahead as it can." },
        409,
      );
    }
    const updated = await repo.find(id);
    return updated
      ? c.json(toRideDetailView(updated, me.id, now) satisfies z.infer<typeof rideDetail>)
      : notFound(c);
  });

/** `POST /:id/seats` and `POST /:id/full`: one guarded UPDATE, never a read then a write. */
async function setSeats(c: Context<AppEnv>, seatsRemaining: number) {
  const id = paramId(c);
  if (id === null) return notFound(c);
  const me = user(c);
  const db = getDb(c.env.DB);
  const now = Date.now();

  const hit = await updateLimit(c, me, now);
  if (!hit.allowed) return rateLimitedResponse(c, hit);

  const repo = ridesRepo(db);
  if (!(await repo.setSeatsRemaining(id, me.id, seatsRemaining, now))) {
    const ride = await repo.find(id);
    if (!ride || ride.authorId !== me.id || ride.deletedAt !== null) return notFound(c);
    // Theirs, so the number was out of range. Refused as it is, never clamped.
    return c.json(
      {
        error: "invalid_seats",
        message: `Seat count must be between 0 and ${ride.totalSeats}.`,
      },
      409,
    );
  }
  const updated = await repo.find(id);
  return updated
    ? c.json(toRideDetailView(updated, me.id, now) satisfies z.infer<typeof rideDetail>)
    : notFound(c);
}
