import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { inBounds, MAP_BOUNDS } from "../src/shared/geo";
import { pointsSql, POINTS_FILE, seededAreas, type AreaPointsFile } from "./area-points";

const file = JSON.parse(readFileSync(POINTS_FILE, "utf8")) as AreaPointsFile;
const migration = readFileSync(
  join(import.meta.dirname, "..", "drizzle", "0022_ride_points.sql"),
  "utf8",
);
const seeded = seededAreas();

const decimals = (n: number) => (String(n).split(".")[1] ?? "").length;

describe("data/areas/points.json", () => {
  it("notes where the points come from", () => {
    expect(file.source.name).toMatch(/OpenStreetMap/);
    expect(file.source.license).toMatch(/ODbL/);
    expect(file.source.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("holds one point per seeded area, none for Outside Dhaka, every slug from the seed", () => {
    expect(seeded).toHaveLength(95);
    const slugs = file.points.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const known = new Set(seeded.map((a) => a.slug));
    for (const slug of slugs) expect(known.has(slug), slug).toBe(true);
    expect(slugs).not.toContain("outside-dhaka");
    expect(slugs.length).toBeGreaterThanOrEqual(seeded.length - 1 - 5);
  });

  it("keeps every point inside the map bounds, to at most 5 decimals", () => {
    for (const p of file.points) {
      expect(inBounds(p), p.slug).toBe(true);
      expect(decimals(p.lat), p.slug).toBeLessThanOrEqual(5);
      expect(decimals(p.lng), p.slug).toBeLessThanOrEqual(5);
    }
  });

  it("puts well-known areas where they are", () => {
    const at = (slug: string) => file.points.find((p) => p.slug === slug)!;
    const nsu = { lat: 23.8151, lng: 90.4253 };
    expect(Math.abs(at("bashundhara-r-a").lat - nsu.lat)).toBeLessThan(0.02);
    expect(Math.abs(at("bashundhara-r-a").lng - nsu.lng)).toBeLessThan(0.02);
    expect(at("uttara").lat).toBeGreaterThan(nsu.lat);
    expect(at("jatrabari").lat).toBeLessThan(nsu.lat);
    expect(at("jatrabari").lng).toBeLessThan(nsu.lng + 0.05);
    // Places that share a name with one in another district.
    expect(at("gabtoli").lat).toBeGreaterThan(23.77);
    expect(at("new-market").lat).toBeGreaterThan(23.72);
    expect(at("kazipara").lat).toBeLessThan(23.82);
  });
});

describe("migration 0022", () => {
  it("sets the same points the JSON holds, by slug", () => {
    const updates = migration
      .split("\n")
      .filter((line) => line.startsWith("UPDATE `areas`"))
      .join("\n");
    expect(updates).toBe(pointsSql(file.points));
  });

  it("checks the same box as MAP_BOUNDS", () => {
    const lat = `between ${MAP_BOUNDS.south} and ${MAP_BOUNDS.north}`;
    const lng = `between ${MAP_BOUNDS.west} and ${MAP_BOUNDS.east}`;
    // Three pairs: pickup, destination and area.
    expect(migration.split(lat)).toHaveLength(4);
    expect(migration.split(lng)).toHaveLength(4);
  });
});
