import { z } from "zod";
import { inBounds, roundPoint } from "../geo";

/**
 * A map point in a request or a response: WGS84 degrees, inside the greater-Dhaka box (`MAP_BOUNDS`),
 * rounded to 5 decimals (about 1 m). One shape for the ride forms, the validators and the detail.
 */
export const geoPoint = z
  .object({ lat: z.number(), lng: z.number() })
  .refine(inBounds, "Pick a spot inside Dhaka")
  .transform(roundPoint);

export type GeoPointValue = z.output<typeof geoPoint>;
