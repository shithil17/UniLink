import { describe, expect, it, vi } from "vite-plus/test";
import { MAP_BOUNDS } from "../../shared/geo";
import { limits } from "../limits";
import {
  FakeGeocoder,
  GeocoderUnavailableError,
  photonGeocoder,
  placesFromPhoton,
} from "./geocoder";

// A trimmed recording of a Photon answer for "kuril": a road, a market, a duplicate of the road, a
// feature with no name, one in Chattogram (outside the Dhaka box) and one with a broken point.
const RECORDED = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [90.4212345678, 23.8187654321] },
      properties: {
        osm_id: 1,
        name: "Kuril Flyover",
        street: "Pragati Sarani",
        district: "Badda",
        city: "Dhaka",
        county: "Dhaka District",
        country: "Bangladesh",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [90.4215, 23.8201] },
      properties: { name: "Kuril Bishwa Road Bus Stand", locality: "Kuril", city: "Dhaka" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [90.4212345678, 23.8187654321] },
      properties: { name: "Kuril Flyover", street: "Pragati Sarani", district: "Badda" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [90.42, 23.81] },
      properties: { city: "Dhaka" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [91.8, 22.35] },
      properties: { name: "Kuril, Chattogram", city: "Chattogram" },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: ["x", "y"] },
      properties: { name: "Bad" },
    },
  ],
};

describe("placesFromPhoton", () => {
  it("maps a recorded Photon answer to the shared shape, rounded and with a short detail line", () => {
    expect(placesFromPhoton(RECORDED, MAP_BOUNDS)).toEqual([
      { name: "Kuril Flyover", detail: "Pragati Sarani, Badda", lat: 23.81877, lng: 90.42123 },
      { name: "Kuril Bishwa Road Bus Stand", detail: "Kuril, Dhaka", lat: 23.8201, lng: 90.4215 },
    ]);
  });

  it("drops anything outside the bounds", () => {
    const names = placesFromPhoton(RECORDED, MAP_BOUNDS).map((p) => p.name);
    expect(names).not.toContain("Kuril, Chattogram");
  });

  it.each([null, "nope", 42, {}, { features: "x" }, { features: null }])(
    "gives an empty list for a malformed body (%j)",
    (body) => {
      expect(placesFromPhoton(body, MAP_BOUNDS)).toEqual([]);
    },
  );
});

describe("photonGeocoder", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  it("sends the typed text, the box, a limit, a language and a generic client name, nothing else", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => ok(RECORDED));
    const signal = new AbortController().signal;
    const places = await photonGeocoder(fetchImpl).search("kuril", MAP_BOUNDS, signal);
    expect(places).toHaveLength(2);

    const [url, init = {}] = fetchImpl.mock.calls[0]!;
    const parsed = url as URL;
    expect(parsed.origin + parsed.pathname).toBe("https://photon.komoot.io/api/");
    expect([...parsed.searchParams.keys()].sort()).toEqual(["bbox", "lang", "limit", "q"]);
    expect(parsed.searchParams.get("q")).toBe("kuril");
    expect(parsed.searchParams.get("limit")).toBe(String(limits.placeSearch.maxResults));
    expect(parsed.searchParams.get("bbox")).toBe("90.22,23.58,90.62,24.08");
    const headers = init.headers as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(["accept", "user-agent"]);
    expect(headers["user-agent"]).toBe("UniLink place search");
    // No cookies, credentials or forwarded address: only the headers and the abort signal.
    expect(Object.keys(init).sort()).toEqual(["headers", "signal"]);
    expect(init.signal).toBe(signal);
  });

  it("throws on a throttled or failed answer and on a network error", async () => {
    const signal = new AbortController().signal;
    for (const status of [429, 500, 503]) {
      const fetchImpl = vi.fn<typeof fetch>(async () => new Response("no", { status }));
      await expect(photonGeocoder(fetchImpl).search("kuril", MAP_BOUNDS, signal)).rejects.toThrow(
        GeocoderUnavailableError,
      );
    }
    const down = vi.fn<typeof fetch>(async () => {
      throw new TypeError("network");
    });
    await expect(photonGeocoder(down).search("kuril", MAP_BOUNDS, signal)).rejects.toThrow(
      GeocoderUnavailableError,
    );
  });

  it("gives an empty list when a 200 answer is not JSON", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 200 }));
    const signal = new AbortController().signal;
    expect(await photonGeocoder(fetchImpl).search("kuril", MAP_BOUNDS, signal)).toEqual([]);
  });
});

describe("FakeGeocoder", () => {
  it("records the query and the bounds and returns what it is given", async () => {
    const fake = new FakeGeocoder(() => [{ name: "A", detail: "", lat: 23.8, lng: 90.4 }]);
    const found = await fake.search("abc", MAP_BOUNDS);
    expect(found).toHaveLength(1);
    expect(fake.calls).toEqual([{ query: "abc", bounds: MAP_BOUNDS }]);
  });
});
