// One-off, offline: finds a centre point for each seeded area on OpenStreetMap (Nominatim) and writes
// data/areas/points.json. The app and the tests never call Nominatim; only this script does, and it
// waits a second between requests (the public server's usage policy).
//   vp run area-points         look every area up and rewrite data/areas/points.json
//   vp run area-points --sql   print the UPDATE statements for points.json (pasted into the migration)
// Data: OpenStreetMap contributors, ODbL (https://www.openstreetmap.org/copyright).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inBounds, MAP_BOUNDS, roundPoint } from "../src/shared/geo.ts";

export const POINTS_FILE = join(import.meta.dirname, "..", "data", "areas", "points.json");
export const SEED_MIGRATION = join(import.meta.dirname, "..", "drizzle", "0020_ride_areas.sql");

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "UniLink area-points script";
/** Nominatim allows one request a second. */
const DELAY_MS = 1100;

export type AreaPoint = { slug: string; lat: number; lng: number; note?: string };
export type AreaPointsFile = {
  source: { name: string; license: string; url: string; date: string };
  points: AreaPoint[];
};

/** The areas migration 0020 seeds, in its order. The one list this script, its test and the data share. */
export function seededAreas(): { slug: string; name: string }[] {
  const sql = readFileSync(SEED_MIGRATION, "utf8");
  return [...sql.matchAll(/^\t\('([a-z0-9-]+)', '([^']+)', \d+, 0, 0\)/gm)].map((m) => ({
    slug: m[1]!,
    name: m[2]!,
  }));
}

/** Areas with no place of their own in OpenStreetMap. */
const SKIP = new Set(["outside-dhaka"]);

/**
 * Where the plain name finds the wrong place, a narrower query, or a hand-checked point (`point`) with
 * the reason. Anything here is noted in points.json.
 */
const QUERY: Record<string, string> = {
  "airport-kawla": "Kawla, Dhaka",
  "old-dhaka-sadarghat": "Sadarghat, Dhaka",
  // The plain name finds a same-named place in Narayanganj, Keraniganj or Gazipur.
  gabtoli: "Gabtoli, Mirpur",
  "new-market": "New Market, Azimpur",
  wari: "ওয়ারী",
  nikunja: "Nikunja, Khilkhet",
  kadamtali: "কদমতলী",
};
// Areas OpenStreetMap has no usable point for, placed by hand from the map.
const NO_MATCH = "hand-placed: Nominatim has no usable match";
const MANUAL: Record<string, { lat: number; lng: number; note: string }> = {
  // Both DOHS areas resolve to the same school, so Banani is placed on its own.
  "dohs-banani": {
    lat: 23.7935,
    lng: 90.3975,
    note: `${NO_MATCH} (same school as DOHS Mohakhali)`,
  },
  kazipara: { lat: 23.7978, lng: 90.3728, note: `${NO_MATCH} (finds Kazipara in Gazipur)` },
  kotwali: { lat: 23.709, lng: 90.406, note: `${NO_MATCH} (finds Gopibagh, 2 km off)` },
};

type Hit = { lat: string; lon: string; display_name: string; category?: string; type?: string };

async function lookup(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set("q", `${query}, Dhaka, Bangladesh`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "bd");
  url.searchParams.set(
    "viewbox",
    `${MAP_BOUNDS.west},${MAP_BOUNDS.north},${MAP_BOUNDS.east},${MAP_BOUNDS.south}`,
  );
  url.searchParams.set("bounded", "1");
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim answered ${res.status} for "${query}"`);
  const hits = (await res.json()) as Hit[];
  for (const hit of hits) {
    const point = roundPoint({ lat: Number(hit.lat), lng: Number(hit.lon) });
    if (inBounds(point)) return { ...point, label: hit.display_name };
  }
  return null;
}

async function build() {
  const points: AreaPoint[] = [];
  const missing: string[] = [];
  for (const { slug, name } of seededAreas()) {
    if (SKIP.has(slug)) continue;
    const manual = MANUAL[slug];
    if (manual) {
      points.push({ slug, ...roundPoint(manual), note: manual.note });
      continue;
    }
    const query = QUERY[slug] ?? name;
    const found = await lookup(query);
    await new Promise((r) => setTimeout(r, DELAY_MS));
    if (!found) {
      missing.push(slug);
      console.log(`  none   ${slug}`);
      continue;
    }
    console.log(`  ${found.lat}, ${found.lng}  ${slug}  <- ${found.label}`);
    points.push({
      slug,
      lat: found.lat,
      lng: found.lng,
      ...(QUERY[slug] ? { note: `looked up as "${QUERY[slug]}"` } : {}),
    });
  }
  const file: AreaPointsFile = {
    source: {
      name: "OpenStreetMap contributors via Nominatim",
      license: "ODbL 1.0",
      url: "https://www.openstreetmap.org/copyright",
      date: new Date().toISOString().slice(0, 10),
    },
    points,
  };
  writeFileSync(POINTS_FILE, `${JSON.stringify(file, null, 2)}\n`);
  console.log(
    `${points.length} points written, ${missing.length} not found: ${missing.join(", ")}`,
  );
}

/** The migration's UPDATE statements for `points`, one per area, matched by slug. */
export function pointsSql(points: readonly AreaPoint[]): string {
  return points
    .map(
      (p) =>
        `UPDATE \`areas\` SET \`lat\` = ${p.lat}, \`lng\` = ${p.lng} WHERE \`slug\` = '${p.slug}';--> statement-breakpoint`,
    )
    .join("\n");
}

if (import.meta.main) {
  if (process.argv.includes("--sql")) {
    const file = JSON.parse(readFileSync(POINTS_FILE, "utf8")) as AreaPointsFile;
    process.stdout.write(`${pointsSql(file.points)}\n`);
  } else {
    await build();
  }
}
