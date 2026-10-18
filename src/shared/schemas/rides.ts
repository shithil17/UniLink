import { z } from "zod";
import { contacts, id, instant, postStatus } from "./common";

// Stub. Weekdays and departure times are Asia/Dhaka local values.

export const vehicleType = z.enum(["bike", "car", "suv", "bus"]);
export const weekday = z.enum(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);

const rideBase = z.object({
  pickup: z.string(),
  destination: z.string(),
  vehicle: vehicleType,
  totalSeats: z.number().int().positive(),
  pricePerSeatTaka: z.number().int().nonnegative(),
  notes: z.string().optional(),
  contacts,
});

export const rideInput = z.discriminatedUnion("kind", [
  rideBase.extend({ kind: z.literal("one_off"), departsAt: instant }),
  rideBase.extend({
    kind: z.literal("recurring"),
    days: z.array(weekday).min(1),
    departureTime: z.string(),
    endsOn: z.string(),
  }),
]);

export const rideFeedQuery = z.object({
  q: z.string().optional(),
  vehicle: vehicleType.optional(),
  date: z.string().optional(),
  day: weekday.optional(),
  cursor: z.string().optional(),
});

/** Feed item: no contact details. */
export const rideSummary = rideBase.omit({ contacts: true }).extend({
  id,
  kind: z.enum(["one_off", "recurring"]),
  seatsRemaining: z.number().int().nonnegative(),
  status: postStatus,
});
