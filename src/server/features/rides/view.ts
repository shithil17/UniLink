import type { z } from "zod";
import { maskToDays, minutesToTime } from "../../../shared/rides";
import type { rideSummary } from "../../../shared/schemas/rides";
import type { RideCursor, RideRow } from "../../repos/rides";

type RideView = z.infer<typeof rideSummary>;

/** Where a ride stands at `now`. Worked out when it is read, so a ride past its expiry never shows as open before the cron purges it. */
export function rideState(
  r: Pick<RideRow, "seatsRemaining" | "expiresAt">,
  now: number,
): RideView["state"] {
  if (r.expiresAt <= now) return "expired";
  return r.seatsRemaining === 0 ? "full" : "open";
}

/** A ride as the viewer reads it. Carries no contact and no identity. */
export function toRideView(r: RideRow, viewerId: number, now: number): RideView {
  const mine = r.authorId === viewerId;
  return {
    id: r.id,
    kind: r.kind,
    pickup: r.pickup,
    destination: r.destination,
    vehicle: r.vehicle,
    totalSeats: r.totalSeats,
    seatsRemaining: r.seatsRemaining,
    pricePerSeatTaka: r.pricePerSeatTaka,
    notes: r.notes,
    departsAt: r.departsAt,
    days: r.days === null ? null : maskToDays(r.days),
    departureTime: r.departureMinutes === null ? null : minutesToTime(r.departureMinutes),
    endsOn: r.endsOn,
    state: rideState(r, now),
    status: r.status,
    rejectionCategory: mine && r.status === "rejected" ? r.moderationCategory : null,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    mine,
  };
}

/** The feed cursor is the last row's `expires_at` and id, "<expiresAt>.<id>". */
export const encodeRideCursor = (r: Pick<RideRow, "expiresAt" | "id">): string =>
  `${r.expiresAt}.${r.id}`;

const CURSOR = /^(\d{1,16})\.(\d{1,16})$/;

/** The cursor a client sent back, or null when it is not one this feed handed out. */
export function decodeRideCursor(value: string): RideCursor | null {
  const m = CURSOR.exec(value);
  if (!m) return null;
  const cursor = { expiresAt: Number(m[1]), id: Number(m[2]) };
  return Number.isSafeInteger(cursor.expiresAt) && Number.isSafeInteger(cursor.id) ? cursor : null;
}
