// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { Map as FakeMap, Marker, resetFakeMaps } from "@/test/fakeMapLibre";
import type { AreaOption } from "../../../shared/schemas/areas";
import { directionsUrl, drawTrip, tripOf, tripPoints } from "./trip";

const area = (id: number, name: string, lat: number | null, lng: number | null, children = []) =>
  ({ id, slug: name.toLowerCase(), name, lat, lng, children }) as AreaOption;

const AREAS: AreaOption[] = [
  area(1, "Bashundhara R/A", 23.8151, 90.4253),
  {
    ...area(2, "Mirpur", 23.8223, 90.3654),
    children: [
      { id: 20, slug: "m10", name: "Mirpur 10", lat: null, lng: null },
      { id: 21, slug: "m11", name: "Mirpur 11", lat: 23.82, lng: 90.37 },
    ],
  },
  area(3, "Outside Dhaka", null, null),
];

const pin = { lat: 23.8, lng: 90.4 };

describe("tripOf", () => {
  it("uses an exact pin as it is and an area's point for an end with no pin", () => {
    const trip = tripOf(
      {
        pickup: { point: pin, areaId: 1, areaName: "Bashundhara R/A" },
        destination: { point: null, areaId: 2, areaName: "Mirpur" },
      },
      AREAS,
    );
    expect(trip.pickup).toEqual({ point: pin, exact: true, area: "Bashundhara R/A" });
    expect(trip.destination).toEqual({
      point: { lat: 23.8223, lng: 90.3654 },
      exact: false,
      area: "Mirpur",
    });
    expect(tripPoints(trip)).toEqual([pin, { lat: 23.8223, lng: 90.3654 }]);
  });

  it("puts a sub-area with no point where its parent is, and draws nothing for an area with none", () => {
    const trip = tripOf(
      {
        pickup: { point: null, areaId: 20, areaName: "Mirpur 10" },
        destination: { point: null, areaId: 3, areaName: "Outside Dhaka" },
      },
      AREAS,
    );
    expect(trip.pickup?.point).toEqual({ lat: 23.8223, lng: 90.3654 });
    expect(trip.destination).toBeNull();
    expect(tripPoints(trip)).toHaveLength(1);
    // Before the area list loads (or any area is picked) there is nothing to draw.
    expect(
      tripOf(
        {
          pickup: { point: null, areaId: null, areaName: null },
          destination: { point: null, areaId: 2, areaName: null },
        },
        undefined,
      ),
    ).toEqual({ pickup: null, destination: null });
  });
});

describe("directionsUrl", () => {
  it("hands both points to Google Maps, area points included, and needs both ends", () => {
    const both = tripOf(
      {
        pickup: { point: pin, areaId: 1, areaName: "Bashundhara R/A" },
        destination: { point: null, areaId: 2, areaName: "Mirpur" },
      },
      AREAS,
    );
    expect(directionsUrl(both)).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=23.8,90.4&destination=23.8223,90.3654",
    );
    expect(directionsUrl({ ...both, destination: null })).toBeNull();
  });
});

describe("drawTrip", () => {
  beforeEach(resetFakeMaps);

  const setup = () => {
    const container = document.createElement("div");
    const map = new FakeMap({ container }) as unknown as import("maplibre-gl").Map;
    return { map, container, lib: { Marker } as never };
  };
  const trip = tripOf(
    {
      pickup: { point: pin, areaId: 1, areaName: "Bashundhara R/A" },
      destination: { point: null, areaId: 2, areaName: "Mirpur" },
    },
    AREAS,
  );

  it("draws a pin for an exact end, an 'Around' circle for the other, and a dashed line", () => {
    const { map, container, lib } = setup();
    const clear = drawTrip(map, lib, trip);
    expect(container.querySelector('[aria-label="Pickup, Bashundhara R/A"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Destination, around mirpur"]')).toBeTruthy();
    expect(container.textContent).toContain("Around Mirpur");
    expect(container.textContent).not.toContain("Around Bashundhara");
    const layer = (map as unknown as FakeMap).layers.get("trip-line") as {
      paint: Record<string, unknown>;
    };
    expect(layer.paint["line-dasharray"]).toBeTruthy();

    clear();
    expect(container.querySelector("[aria-label]")).toBeNull();
    expect((map as unknown as FakeMap).layers.has("trip-line")).toBe(false);
    expect((map as unknown as FakeMap).sources.has("trip-line")).toBe(false);
  });

  it("can be drawn again after the style is replaced, as a palette change does", () => {
    const { map, container, lib } = setup();
    const fake = map as unknown as FakeMap;
    const clear = drawTrip(map, lib, trip);
    fake.setStyle({}); // drops runtime layers and sources
    clear();
    drawTrip(map, lib, trip);
    expect(container.querySelectorAll("[role=img]")).toHaveLength(2);
    expect(fake.layers.has("trip-line")).toBe(true);
  });

  it("draws no line for a single end", () => {
    const { map, lib } = setup();
    drawTrip(map, lib, { pickup: trip.pickup, destination: null });
    expect((map as unknown as FakeMap).layers.has("trip-line")).toBe(false);
  });
});
