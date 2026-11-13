import type { z } from "zod";
import { maskToDays, minutesToTime } from "../../../shared/rides";
import type { rideDetail, rideSummary } from "../../../shared/schemas/rides";
import type { RideCursor, RideRow, RideSummaryRow } from "../../repos/rides";

type RideView = z.infer<typeof rideSummary>;
type RideDetailView = z.infer<typeof rideDetail>;

/** Where a ride stands at `now`. Worked out when it is read, so a ride past its expiry never shows as open before the cron purges it. */
export function rideState(
  r: Pick<RideSummaryRow, "seatsRemaining" | "expiresAt">,
  now: number,
): RideView["state"] {
  if (r.expiresAt <= now) return "expired";
  return r.seatsRemaining === 0 ? "full" : "open";
}

/** A ride as the feed and "my rides" list it. Carries no contact, no identity and no exact point. */
export function toRideView(r: RideSummaryRow, viewerId: number, now: number): RideView {
  const mine = r.authorId === viewerId;
  return {
    id: r.id,
    kind: r.kind,
    pickupArea: { id: r.pickupAreaId, name: r.pickupAreaName },
    destinationArea: { id: r.destinationAreaId, name: r.destinationAreaName },
    pickupLandmark: r.pickupLandmark,
    destinationLandmark: r.destinationLandmark,
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

const point = (lat: number | null, lng: number | null) =>
  lat === null || lng === null ? null : { lat, lng };

/** A ride as its own screen reads it: the summary plus the exact pins the poster set, each null when unset. No contact, no identity. */
export function toRideDetailView(r: RideRow, viewerId: number, now: number): RideDetailView {
  return {
    ...toRideView(r, viewerId, now),
    pickupPoint: point(r.pickupLat, r.pickupLng),
    destinationPoint: point(r.destinationLat, r.destinationLng),
  };
}

/** The feed cursor is the last row's `expires_at` and id, "<expiresAt>.<id>". */
export const encodeRideCursor = (r: Pick<RideSummaryRow, "expiresAt" | "id">): string =>
  `${r.expiresAt}.${r.id}`;

const CURSOR = /^(\d{1,16})\.(\d{1,16})$/;

/** The cursor a client sent back, or null when it is not one this feed handed out. */
export function decodeRideCursor(value: string): RideCursor | null {
  const m = CURSOR.exec(value);
  if (!m) return null;
  const cursor = { expiresAt: Number(m[1]), id: Number(m[2]) };
  return Number.isSafeInteger(cursor.expiresAt) && Number.isSafeInteger(cursor.id) ? cursor : null;
}
