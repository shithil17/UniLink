import { z } from "zod";
import { isDepartureTime, WEEKDAYS } from "../rides";
import { parseDhakaDate } from "../time";
import { areaRef } from "./areas";
import { geoPoint } from "./geo";
import { contacts, id, instant, page, postStatus, reasonCategory } from "./common";

// Weekdays and departure times are Asia/Dhaka local values. A ride is one of two kinds: a one-off with a
// departure instant, or a recurring ride with weekdays, a time of day and an end date.

/** A landmark is the fine detail inside an area ("north gate", "Mirpur 10 roundabout"), not an address. */
export const RIDE_LANDMARK_MAX_LENGTH = 80;
export const RIDE_NOTES_MAX_LENGTH = 300;
/** The most seats one ride can offer. A bus is the largest vehicle. */
export const RIDE_SEATS_MAX = 60;
export const RIDE_PRICE_MAX_TAKA = 20_000;
export const RIDE_SEARCH_MAX_LENGTH = 60;

export const vehicleType = z.enum(["bike", "car", "suv", "bus"]);
export const weekday = z.enum(WEEKDAYS);
export const rideKind = z.enum(["one_off", "recurring"]);
/** What a reader sees of a ride: a ride past its expiry is `expired` whatever its seats say. */
export const rideState = z.enum(["open", "full", "expired"]);

/** An area id in a request body. */
const areaId = z.number().int().positive();

const landmark = z
  .string()
  .trim()
  .max(RIDE_LANDMARK_MAX_LENGTH, `Keep it under ${RIDE_LANDMARK_MAX_LENGTH} characters`);

const notes = z
  .string()
  .trim()
  .max(RIDE_NOTES_MAX_LENGTH, `Keep the notes under ${RIDE_NOTES_MAX_LENGTH} characters`);

const seats = z
  .number()
  .int()
  .min(1, "A ride needs at least one seat")
  .max(RIDE_SEATS_MAX, `A ride can have at most ${RIDE_SEATS_MAX} seats`);

const price = z
  .number()
  .int()
  .min(0, "The price can't be negative")
  .max(RIDE_PRICE_MAX_TAKA, `The price can be at most ${RIDE_PRICE_MAX_TAKA} taka a seat`);

/** A calendar date in Asia/Dhaka, "YYYY-MM-DD". */
export const dhakaDateString = z
  .string()
  .refine((v) => parseDhakaDate(v) !== null, "Use a date like 2026-11-20");

const departureTime = z
  .string()
  .refine(isDepartureTime, "Pick a time")
  .describe("HH:MM, Asia/Dhaka");

const days = z.array(weekday).min(1, "Pick at least one day").max(WEEKDAYS.length);

const rideBase = z.object({
  // Both areas are required and must be visible areas (the server checks).
  pickupAreaId: areaId,
  destinationAreaId: areaId,
  // Blank becomes absent.
  pickupLandmark: landmark.optional().transform((v) => (v === "" ? undefined : v)),
  destinationLandmark: landmark.optional().transform((v) => (v === "" ? undefined : v)),
  // The exact spots, optional. Only a spot the poster confirmed is sent.
  pickupPoint: geoPoint.optional(),
  destinationPoint: geoPoint.optional(),
  vehicle: vehicleType,
  totalSeats: seats,
  pricePerSeatTaka: price,
  // Blank becomes absent.
  notes: notes.optional().transform((v) => (v === "" ? undefined : v)),
  contacts,
});

/**
 * A new ride. A one-off expires at `departsAt` (UTC epoch ms). A recurring ride runs on `days` at
 * `departureTime` until the end of `endsOn`; leave `endsOn` out for the default, 60 days from today.
 * The server checks the dates against the clock.
 */
export const rideInput = z.discriminatedUnion("kind", [
  rideBase.extend({ kind: z.literal("one_off"), departsAt: instant }),
  rideBase.extend({
    kind: z.literal("recurring"),
    days,
    departureTime,
    endsOn: dhakaDateString.optional(),
  }),
]);

/**
 * An edit: only what changed. The kind never changes. `contacts` replaces all contacts, so it must keep
 * at least one. A one-off takes `departsAt`; a recurring ride takes `days`, `departureTime` and `endsOn`.
 * Seats left are changed with `rideSeatsInput`, not here (changing `totalSeats` keeps the seats already
 * taken: the seats left shrink or grow with it).
 */
export const ridePatch = z
  .object({
    pickupAreaId: areaId.optional(),
    destinationAreaId: areaId.optional(),
    // Blank or null clears the landmark.
    pickupLandmark: landmark.nullable().optional(),
    destinationLandmark: landmark.nullable().optional(),
    // A point sets or moves the pin; null removes it.
    pickupPoint: geoPoint.nullable().optional(),
    destinationPoint: geoPoint.nullable().optional(),
    vehicle: vehicleType.optional(),
    totalSeats: seats.optional(),
    pricePerSeatTaka: price.optional(),
    // Blank or null clears the notes.
    notes: notes.nullable().optional(),
    contacts: contacts.optional(),
    departsAt: instant.optional(),
    days: days.optional(),
    departureTime: departureTime.optional(),
    endsOn: dhakaDateString.optional(),
  })
  .refine((p) => Object.values(p).some((v) => v !== undefined), {
    message: "Change at least one thing",
  });

/** Seats left, as set by the poster. Must be within 0 and the ride's total seats; the server refuses anything else. */
export const rideSeatsInput = z.object({
  seatsRemaining: z
    .number()
    .int()
    .min(0, "Seat count can't be negative")
    .max(RIDE_SEATS_MAX, `A ride can have at most ${RIDE_SEATS_MAX} seats`),
});

/**
 * The feed's search params (kept in the URL). `from` and `to` are area ids: a top-level area also
 * matches its sub-areas. `q` is a text fallback that matches landmarks and area names. `date` is a Dhaka day:
 * one-off rides leaving that day and recurring rides that run on its weekday and have not ended.
 * `day` is a weekday: recurring rides on it and one-off rides leaving on it. `cursor` is the
 * `nextCursor` of the previous page.
 */
export const rideFeedQuery = z.object({
  q: z.string().trim().max(RIDE_SEARCH_MAX_LENGTH).optional(),
  from: id.optional(),
  to: id.optional(),
  vehicle: vehicleType.optional(),
  date: dhakaDateString.optional(),
  day: weekday.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

/**
 * A ride as the feed, the detail screen and "my rides" show it. Never carries a contact (those come from
 * `GET /api/rides/:id/contact`) or the poster's identity. `status` is the moderation status; a ride other
 * students see is always `published`. `rejectionCategory` is set only on the poster's own rejected ride.
 */
export const rideSummary = z.object({
  id: z.number().int(),
  kind: rideKind,
  pickupArea: areaRef,
  destinationArea: areaRef,
  /** The fine detail inside the area, or null. */
  pickupLandmark: z.string().nullable(),
  destinationLandmark: z.string().nullable(),
  vehicle: vehicleType,
  totalSeats: z.number().int(),
  seatsRemaining: z.number().int().nonnegative(),
  pricePerSeatTaka: z.number().int().nonnegative(),
  notes: z.string().nullable(),
  /** One-off: the departure, UTC epoch ms. Null for a recurring ride. */
  departsAt: instant.nullable(),
  /** Recurring: the weekdays, Sunday first. Null for a one-off. */
  days: z.array(weekday).nullable(),
  /** Recurring: "HH:MM" in Asia/Dhaka. Null for a one-off. */
  departureTime: z.string().nullable(),
  /** Recurring: the last day it runs, "YYYY-MM-DD" in Asia/Dhaka. Null for a one-off. */
  endsOn: z.string().nullable(),
  /** Worked out when read: seats left 0 is `full`, a lapsed ride is `expired`. */
  state: rideState,
  status: postStatus,
  rejectionCategory: reasonCategory.nullable().optional(),
  expiresAt: instant,
  createdAt: instant,
  /** Whether the viewer posted it. */
  mine: z.boolean(),
});

/**
 * One ride as the detail screen (and the responses to creating and editing it) shows it: the summary
 * plus the exact pins, each null when the poster set none. The feed and "my rides" use `rideSummary`,
 * which has no points, so an exact spot only ever goes to someone opening that ride.
 */
export const rideDetail = rideSummary.extend({
  pickupPoint: geoPoint.nullable(),
  destinationPoint: geoPoint.nullable(),
});

export const rideFeedPage = page(rideSummary);

export type RideInput = z.output<typeof rideInput>;
export type RideFormValues = z.input<typeof rideInput>;
export type RidePatch = z.output<typeof ridePatch>;
export type RideSeatsInput = z.output<typeof rideSeatsInput>;
export type RideFeedQuery = z.output<typeof rideFeedQuery>;
export type RideSummary = z.infer<typeof rideSummary>;
export type RideDetail = z.infer<typeof rideDetail>;
export type RideFeedPage = z.infer<typeof rideFeedPage>;
