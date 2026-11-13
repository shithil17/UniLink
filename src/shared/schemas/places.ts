import { z } from "zod";
import { inBounds } from "../geo";

// Place search in the pin picker: the typed text goes to the Worker, which asks a geocoder and answers
// with named places inside the greater-Dhaka box. These numbers are shared so the client box and the
// server validator agree.

// ceiling: three letters is the shortest a place name is worth searching for ("Gul"), and it keeps one-letter keystrokes from costing a request. Revisit if students cannot find short names.
export const PLACE_QUERY_MIN_LENGTH = 3;
// ceiling: a place or road name with its area ("Jamuna Future Park, Bashundhara") is well under this; it only stops a pasted paragraph from being sent to the geocoder. Revisit if a real search is cut short.
export const PLACE_QUERY_MAX_LENGTH = 80;
// ceiling: the client waits for this pause in typing before asking, so a typed word is one request, not one per key. Revisit if search feels slow or the geocoder throttles.
export const PLACE_SEARCH_DEBOUNCE_MS = 350;

// ceiling: our own areas that match the typed text show above the places, a few rows on a phone. Defined in shared code for the client list. Revisit if students scroll for an area that is cut off.
export const PLACE_AREA_MATCHES_MAX = 4;

/** `?q=`: the text a student typed. */
export const placeSearchQuery = z.object({
  q: z
    .string()
    .trim()
    .min(PLACE_QUERY_MIN_LENGTH, `Type at least ${PLACE_QUERY_MIN_LENGTH} letters to search`)
    .max(PLACE_QUERY_MAX_LENGTH, `Use at most ${PLACE_QUERY_MAX_LENGTH} characters`),
});

/** One search result: a name, a short line saying where it is, and its point (5 decimals, inside the box). */
export const place = z
  .object({
    name: z.string().min(1),
    /** A short locality, street or district line. May be empty. */
    detail: z.string(),
    lat: z.number(),
    lng: z.number(),
  })
  .refine((p) => inBounds(p), "Pick a spot inside Dhaka");

export const placeSearchResponse = z.object({ places: z.array(place) });

export type Place = z.infer<typeof place>;
export type PlaceSearchResponse = z.infer<typeof placeSearchResponse>;
