import { describe, expect, it } from "vite-plus/test";
import type { AreaOption } from "../../shared/schemas/areas";
import { areaCardLine, areaPills, offMapLabel } from "./rideAreaMap";

const area = (
  id: number,
  name: string,
  lat: number | null,
  children: AreaOption["children"] = [],
) =>
  ({
    id,
    slug: name.toLowerCase(),
    name,
    lat,
    lng: lat === null ? null : 90.4,
    children,
  }) as AreaOption;

const AREAS = [
  area(1, "Bashundhara R/A", 23.8),
  area(60, "Mirpur", 23.82, [{ id: 61, slug: "m10", name: "Mirpur 10", lat: 23.81, lng: 90.37 }]),
  area(80, "Outside Dhaka", null),
];

describe("areaPills", () => {
  it("makes a pill for each area with a point, biggest first, and adds up the rest as not on the map", () => {
    const { pills, offMap } = areaPills(AREAS, [
      { areaId: 1, count: 1 },
      { areaId: 61, count: 4 },
      { areaId: 80, count: 2 },
      // Hidden since the list loaded: no name and no point, so it cannot be drawn.
      { areaId: 999, count: 3 },
    ]);
    expect(pills.map((p) => [p.areaId, p.name, p.count])).toEqual([
      [61, "Mirpur 10", 4],
      [1, "Bashundhara R/A", 1],
    ]);
    expect(offMap).toBe(5);
  });
});

describe("words", () => {
  it("says rides in the singular for one", () => {
    expect(areaCardLine("Jatrabari", 6, "pickup")).toBe("Jatrabari: 6 rides leaving");
    expect(areaCardLine("Jatrabari", 1, "destination")).toBe("Jatrabari: 1 ride arriving");
    expect(offMapLabel(1)).toBe("Not on the map: 1 ride");
  });
});
