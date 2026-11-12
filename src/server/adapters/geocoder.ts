import { z } from "zod";
import { inBounds, roundPoint, type GeoBounds } from "../../shared/geo";
import { place, type Place } from "../../shared/schemas/places";
import { limits } from "../limits";

/**
 * Turns typed text into named places inside `bounds`. It is given the text and the box and nothing
 * about the person who typed it. May throw or time out: the route answers 502 `search_unavailable`.
 */
export interface Geocoder {
  search(query: string, bounds: GeoBounds, signal: AbortSignal): Promise<Place[]>;
}

/** The geocoder answered with an error or throttled us, or never answered. */
export class GeocoderUnavailableError extends Error {
  constructor(message = "The geocoder is unavailable") {
    super(message);
    this.name = "GeocoderUnavailableError";
  }
}

const PHOTON_URL = "https://photon.komoot.io/api/";
/** A generic client name: the public server asks for one, and it says nothing about the user. */
const USER_AGENT = "UniLink place search";

// One GeoJSON feature as Photon sends it. Everything but the point is optional: Photon leaves out
// the fields a place does not have.
const photonFeature = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]).rest(z.unknown()) }),
  properties: z.object({
    name: z.string().optional(),
    street: z.string().optional(),
    locality: z.string().optional(),
    district: z.string().optional(),
    city: z.string().optional(),
    county: z.string().optional(),
  }),
});
const photonResponse = z.object({ features: z.array(z.unknown()) });

/** A short "where" line: up to two distinct parts, most local first. */
function detailOf(p: z.infer<typeof photonFeature>["properties"], name: string): string {
  const parts: string[] = [];
  for (const part of [p.street, p.locality, p.district, p.city, p.county]) {
    if (part && part !== name && !parts.includes(part)) parts.push(part);
    if (parts.length === 2) break;
  }
  return parts.join(", ");
}

/**
 * Maps a Photon GeoJSON body to places. A body that is not the expected shape gives an empty list; a
 * feature with no name or point, or outside `bounds`, is dropped; points are rounded to 5 decimals.
 */
export function placesFromPhoton(body: unknown, bounds: GeoBounds): Place[] {
  const parsed = photonResponse.safeParse(body);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  const places: Place[] = [];
  for (const raw of parsed.data.features) {
    const feature = photonFeature.safeParse(raw);
    if (!feature.success) continue;
    const { coordinates } = feature.data.geometry;
    const point = roundPoint({ lat: coordinates[1], lng: coordinates[0] });
    if (!inBounds(point, bounds)) continue;
    const props = feature.data.properties;
    const name = props.name?.trim() || props.street?.trim();
    if (!name) continue;
    const candidate = place.safeParse({ name, detail: detailOf(props, name), ...point });
    if (!candidate.success) continue;
    const key = `${candidate.data.name}|${candidate.data.detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    places.push(candidate.data);
  }
  return places;
}

/**
 * The public Photon server (OpenStreetMap data, built for search-as-you-type). The request carries the
 * typed text, the box, a result limit, a language and a generic User-Agent, and nothing about the user:
 * no IP forwarding, no ids, no cookies. `fetchImpl` is only swapped in tests.
 */
export function photonGeocoder(fetchImpl: typeof fetch = fetch): Geocoder {
  return {
    async search(query, bounds, signal) {
      const url = new URL(PHOTON_URL);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(limits.placeSearch.maxResults));
      url.searchParams.set("lang", "en");
      // Photon's order: min lon, min lat, max lon, max lat.
      url.searchParams.set(
        "bbox",
        [bounds.west, bounds.south, bounds.east, bounds.north].join(","),
      );
      let res: Response;
      try {
        res = await fetchImpl(url, {
          headers: { "user-agent": USER_AGENT, accept: "application/json" },
          signal,
        });
      } catch (err) {
        throw new GeocoderUnavailableError(err instanceof Error ? err.message : undefined);
      }
      if (!res.ok) {
        await res.body?.cancel();
        throw new GeocoderUnavailableError(`The geocoder answered ${res.status}`);
      }
      const body: unknown = await res.json().catch(() => null);
      return placesFromPhoton(body, bounds);
    },
  };
}

export type GeocoderCall = { query: string; bounds: GeoBounds };

/** A scripted geocoder for tests: returns or throws what it is given and records what it was asked. */
export class FakeGeocoder implements Geocoder {
  readonly calls: GeocoderCall[] = [];

  private readonly respond: (query: string, bounds: GeoBounds) => Place[] | Promise<Place[]>;

  constructor(
    respond: (query: string, bounds: GeoBounds) => Place[] | Promise<Place[]> = () => [],
  ) {
    this.respond = respond;
  }

  async search(query: string, bounds: GeoBounds): Promise<Place[]> {
    this.calls.push({ query, bounds });
    return this.respond(query, bounds);
  }
}
