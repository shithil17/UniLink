import { describe, expect, it } from "vite-plus/test";
import {
  arcLine,
  ARC_SEGMENTS,
  distanceM,
  inBounds,
  MAP_BOUNDS,
  NSU_CENTRE,
  nearestArea,
  roundPoint,
} from "./geo";

describe("MAP_BOUNDS and inBounds", () => {
  it("holds NSU and the corners of the box, and nothing past them", () => {
    expect(inBounds(NSU_CENTRE)).toBe(true);
    expect(inBounds({ lat: MAP_BOUNDS.south, lng: MAP_BOUNDS.west })).toBe(true);
    expect(inBounds({ lat: MAP_BOUNDS.north, lng: MAP_BOUNDS.east })).toBe(true);
    expect(inBounds({ lat: MAP_BOUNDS.south - 0.00001, lng: NSU_CENTRE.lng })).toBe(false);
    expect(inBounds({ lat: NSU_CENTRE.lat, lng: MAP_BOUNDS.east + 0.00001 })).toBe(false);
  });

  it("covers Savar, Gazipur and Narayanganj but not Chattogram or Sylhet", () => {
    expect(inBounds({ lat: 23.85, lng: 90.26 })).toBe(true); // Savar
    expect(inBounds({ lat: 24.0, lng: 90.42 })).toBe(true); // Gazipur
    expect(inBounds({ lat: 23.62, lng: 90.5 })).toBe(true); // Narayanganj
    expect(inBounds({ lat: 22.36, lng: 91.78 })).toBe(false); // Chattogram
    expect(inBounds({ lat: 24.9, lng: 91.87 })).toBe(false); // Sylhet
  });

  it("refuses points that are not numbers", () => {
    expect(inBounds({ lat: Number.NaN, lng: NSU_CENTRE.lng })).toBe(false);
    expect(inBounds({ lat: NSU_CENTRE.lat, lng: Infinity })).toBe(false);
  });
});

describe("roundPoint", () => {
  it("keeps 5 decimals", () => {
    expect(roundPoint({ lat: 23.8151234567, lng: 90.4253987654 })).toEqual({
      lat: 23.81512,
      lng: 90.4254,
    });
  });

  it("leaves a point that already fits alone", () => {
    expect(roundPoint({ lat: 23.81512, lng: 90.42539 })).toEqual({ lat: 23.81512, lng: 90.42539 });
  });
});

describe("nearestArea", () => {
  const areas = [
    { name: "Bashundhara", lat: 23.8151, lng: 90.4253 },
    { name: "Uttara", lat: 23.8759, lng: 90.3795 },
    { name: "Jatrabari", lat: 23.7104, lng: 90.434 },
    { name: "Outside Dhaka", lat: null, lng: null },
  ];

  it("picks the closest area by distance", () => {
    expect(nearestArea({ lat: 23.87, lng: 90.39 }, areas)?.name).toBe("Uttara");
    expect(nearestArea({ lat: 23.72, lng: 90.43 }, areas)?.name).toBe("Jatrabari");
    expect(nearestArea({ lat: 23.8151, lng: 90.4253 }, areas)?.name).toBe("Bashundhara");
  });

  it("skips areas with no point, and gives undefined when none has one", () => {
    expect(nearestArea(NSU_CENTRE, [areas[3]!])).toBeUndefined();
    expect(nearestArea(NSU_CENTRE, [])).toBeUndefined();
  });
});

describe("distanceM", () => {
  it("is zero for the same point and about 111 km per degree of latitude", () => {
    expect(distanceM(NSU_CENTRE, NSU_CENTRE)).toBe(0);
    const d = distanceM({ lat: 23, lng: 90 }, { lat: 24, lng: 90 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe("arcLine", () => {
  const a = { lat: 23.8151, lng: 90.4253 };
  const b = { lat: 23.7104, lng: 90.434 };

  it("starts exactly on the first point and ends exactly on the second", () => {
    const line = arcLine(a, b);
    expect(line).toHaveLength(ARC_SEGMENTS + 1);
    expect(line[0]).toEqual(a);
    expect(line.at(-1)).toEqual(b);
  });

  it("bows away from the straight line between the ends", () => {
    const line = arcLine(a, b);
    const middle = line[Math.floor(line.length / 2)]!;
    const chordMid = { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
    expect(distanceM(middle, chordMid)).toBeGreaterThan(distanceM(a, b) * 0.05);
    // and stays close to the ends' own box, a gentle curve and not a loop
    expect(distanceM(middle, chordMid)).toBeLessThan(distanceM(a, b) * 0.3);
  });

  it("honours the segment count, and still ends on both points for the smallest one", () => {
    expect(arcLine(a, b, 8)).toHaveLength(9);
    expect(arcLine(a, b, 0)).toEqual([a, b]);
  });

  it("does not move the ends when they are the same place", () => {
    const line = arcLine(a, a);
    expect(line[0]).toEqual(a);
    expect(line.at(-1)).toEqual(a);
  });
});
