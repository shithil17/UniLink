// Mock rides on the local dev database, for looking at the ride maps and the "Not on the map" chip.
//
//   vp run seed:rides      local D1 only (run `vp run db:migrate:local` and `vp run seed` first)
//
// Safe to run again: it deletes every ride of the two fake students (`dev_cse`, `dev_bba`, see
// scripts/seed.ts) and writes the set below fresh, with departures counted from now. It takes no target
// flag and always runs against local D1, so it cannot reach staging or production.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daysToMask, timeToMinutes, type Weekday } from "../src/shared/rides.ts";
import {
  dhakaDate,
  endOfDhakaDay,
  formatDhakaDate,
  parseDhakaDate,
  startOfDhakaDay,
} from "../src/shared/time.ts";

// Not imported from seed.ts: that file pulls in the Zod schemas, which Node cannot load as plain ESM, and this
// script should keep working without them.
const DEV_USERNAMES = ["dev_cse", "dev_bba"] as const;
const sqlString = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlOptional = (value: string | undefined) => (value == null ? "NULL" : sqlString(value));

type Pin = readonly [lat: number, lng: number];
type Contacts = { phone?: string; whatsapp?: string; messenger?: string };
type MockRide = {
  author: (typeof DEV_USERNAMES)[number];
  vehicle: "bike" | "car" | "suv" | "bus";
  /** Area slugs from the seeded `areas`. */
  from: { area: string; landmark: string; pin?: Pin };
  to: { area: string; landmark: string; pin?: Pin };
  seats: number;
  taken: number;
  price: number;
  notes: string;
  contacts: Contacts;
  when:
    | { kind: "one_off"; inDays: number; time: string }
    | { kind: "recurring"; days: Weekday[]; time: string };
};

const WORKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu"];
/** A recurring mock ride runs this many days (well inside the 180-day maximum a real one may have). */
const RECURRING_RUN_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

// Pins are WGS84 at 5 decimals, each inside its area.
const NSU_GATE: Pin = [23.8151, 90.4253];

export const MOCK_RIDES: readonly MockRide[] = [
  {
    author: "dev_cse",
    vehicle: "car",
    from: { area: "bashundhara-r-a", landmark: "NSU main gate", pin: NSU_GATE },
    to: { area: "dhanmondi", landmark: "Dhanmondi 27 bus stop", pin: [23.753, 90.374] },
    seats: 3,
    taken: 1,
    price: 150,
    notes: "Leaving right after the 3:20 class. Can wait ten minutes.",
    contacts: { phone: "+8801700000101" },
    when: { kind: "one_off", inDays: 1, time: "17:30" },
  },
  {
    author: "dev_bba",
    vehicle: "bike",
    from: { area: "mirpur", landmark: "Mirpur 10 roundabout", pin: [23.8069, 90.3684] },
    to: { area: "bashundhara-r-a", landmark: "NSU main gate", pin: NSU_GATE },
    seats: 1,
    taken: 0,
    price: 80,
    notes: "Helmet provided. Morning class at 9:40.",
    contacts: { whatsapp: "https://wa.me/8801700000102" },
    when: { kind: "one_off", inDays: 1, time: "07:45" },
  },
  {
    author: "dev_cse",
    vehicle: "car",
    from: { area: "uttara", landmark: "Uttara House Building bus stop", pin: [23.8743, 90.3999] },
    to: { area: "bashundhara-r-a", landmark: "Jamuna Future Park gate", pin: [23.8134, 90.4244] },
    seats: 3,
    taken: 2,
    price: 120,
    notes: "Every class day. Split the fuel, pay weekly.",
    contacts: { phone: "+8801700000103", whatsapp: "https://wa.me/8801700000103" },
    when: { kind: "recurring", days: WORKDAYS, time: "07:30" },
  },
  {
    author: "dev_bba",
    vehicle: "bus",
    from: { area: "jatrabari", landmark: "Jatrabari flyover bus stand", pin: [23.7095, 90.4345] },
    to: { area: "bashundhara-r-a", landmark: "Bashundhara gate, Pragati Sarani" },
    seats: 30,
    taken: 30,
    price: 40,
    notes: "Hired bus, monthly pass. Full right now, ask to be put on the waiting list.",
    contacts: { messenger: "https://m.me/dev.rider" },
    when: { kind: "recurring", days: WORKDAYS, time: "06:50" },
  },
  {
    author: "dev_cse",
    vehicle: "suv",
    from: { area: "gulshan", landmark: "Gulshan 1 circle", pin: [23.7806, 90.4169] },
    to: { area: "bashundhara-r-a", landmark: "NSU main gate", pin: NSU_GATE },
    seats: 5,
    taken: 2,
    price: 200,
    notes: "AC. Pick-up under the Gulshan 1 flyover, east side.",
    contacts: { phone: "+8801700000105" },
    when: { kind: "one_off", inDays: 2, time: "16:00" },
  },
  {
    author: "dev_bba",
    vehicle: "car",
    from: { area: "bashundhara-r-a", landmark: "NSU main gate" },
    to: { area: "outside-dhaka", landmark: "Sylhet highway, Kanchpur bridge" },
    seats: 3,
    taken: 0,
    price: 600,
    notes: "Weekend trip home to Sylhet. Back on Sunday evening if anyone needs a return.",
    contacts: { phone: "+8801700000106", whatsapp: "https://wa.me/8801700000106" },
    when: { kind: "one_off", inDays: 3, time: "06:00" },
  },
  {
    author: "dev_cse",
    vehicle: "bike",
    from: { area: "mohammadpur", landmark: "Town Hall", pin: [23.7659, 90.3599] },
    to: { area: "bashundhara-r-a", landmark: "NSU main gate", pin: NSU_GATE },
    seats: 1,
    taken: 0,
    price: 70,
    notes: "Sun, Tue and Thu classes.",
    contacts: { whatsapp: "https://wa.me/8801700000107" },
    when: { kind: "recurring", days: ["sun", "tue", "thu"], time: "08:15" },
  },
  {
    author: "dev_bba",
    vehicle: "car",
    from: { area: "bashundhara-r-a", landmark: "Block D, near Evercare Hospital" },
    to: { area: "banani", landmark: "Banani 11" },
    seats: 2,
    taken: 1,
    price: 100,
    notes: "Heading to a friend's place after the lab.",
    contacts: { phone: "+8801700000108" },
    when: { kind: "one_off", inDays: 2, time: "19:00" },
  },
  {
    author: "dev_cse",
    vehicle: "suv",
    from: { area: "badda", landmark: "Uttar Badda bus stop", pin: [23.7771, 90.4455] },
    to: { area: "bashundhara-r-a", landmark: "Block D gate", pin: [23.8104, 90.4312] },
    seats: 4,
    taken: 1,
    price: 60,
    notes: "Door to door, I know the back lanes so it is quick.",
    contacts: { phone: "+8801700000109", messenger: "https://m.me/dev.rider.badda" },
    when: { kind: "recurring", days: WORKDAYS, time: "08:00" },
  },
  {
    author: "dev_bba",
    vehicle: "bike",
    from: { area: "bashundhara-r-a", landmark: "Kuril bus stand", pin: [23.8185, 90.421] },
    to: { area: "uttara", landmark: "Sector 7 market" },
    seats: 1,
    taken: 0,
    price: 60,
    notes: "Only one seat, backpacks welcome.",
    contacts: { whatsapp: "https://wa.me/8801700000110" },
    when: { kind: "one_off", inDays: 1, time: "14:20" },
  },
  {
    author: "dev_cse",
    vehicle: "car",
    from: { area: "dhanmondi", landmark: "Satmasjid Road" },
    to: { area: "gulshan", landmark: "Gulshan 2 circle" },
    seats: 3,
    taken: 0,
    price: 140,
    notes: "Not going to campus, just across town. Happy to drop on the way.",
    contacts: { phone: "+8801700000111" },
    when: { kind: "one_off", inDays: 3, time: "08:30" },
  },
  {
    author: "dev_bba",
    vehicle: "bus",
    from: { area: "bashundhara-r-a", landmark: "NSU main gate", pin: NSU_GATE },
    to: { area: "jatrabari", landmark: "Jatrabari flyover bus stand", pin: [23.7095, 90.4345] },
    seats: 25,
    taken: 9,
    price: 35,
    notes: "Hired bus after the evening classes. Pay the driver on boarding.",
    contacts: { messenger: "https://m.me/dev.rider.bus" },
    when: { kind: "one_off", inDays: 4, time: "20:30" },
  },
];

/** The instant of an Asia/Dhaka "HH:MM" on the day `inDays` after today's Dhaka date. */
function dhakaInstant(now: number, inDays: number, time: string): number {
  return startOfDhakaDay(dhakaDate(now)) + inDays * DAY_MS + timeToMinutes(time) * 60_000;
}

const sqlPoint = (pin: Pin | undefined) => (pin ? `${pin[0]}, ${pin[1]}` : "NULL, NULL");
const areaId = (slug: string) => `(SELECT id FROM areas WHERE slug = ${sqlString(slug)})`;
const userId = (username: string) =>
  `(SELECT id FROM users WHERE username = ${sqlString(username)})`;

/**
 * The SQL that replaces the fake students' rides with `MOCK_RIDES`. A one-off lapses at its departure and
 * a recurring ride at the end of its last Asia/Dhaka day, which is the rule `computeExpiresAt` applies to
 * a posted ride (src/server/posts/expiry.ts, which a Node script cannot import; the test pins the two together).
 */
export function mockRideStatements(now: number = Date.now()): string[] {
  const usernames = DEV_USERNAMES.map(sqlString).join(", ");
  const endsOn = formatDhakaDate(dhakaDate(now + RECURRING_RUN_DAYS * DAY_MS));
  return [
    `DELETE FROM rides WHERE author_id IN (SELECT id FROM users WHERE username IN (${usernames}));`,
    ...MOCK_RIDES.map((r, i) => {
      const oneOff = r.when.kind === "one_off";
      const departsAt =
        r.when.kind === "one_off" ? dhakaInstant(now, r.when.inDays, r.when.time) : null;
      const end = parseDhakaDate(endsOn);
      const expiresAt = departsAt ?? endOfDhakaDay(end!);
      const createdAt = now - (MOCK_RIDES.length - i) * 5 * 60_000;
      const days = r.when.kind === "recurring" ? daysToMask(r.when.days) : null;
      const minutes = r.when.kind === "recurring" ? timeToMinutes(r.when.time) : null;
      return `INSERT INTO rides (author_id, pickup_area_id, pickup_landmark, pickup_lat, pickup_lng, destination_area_id, destination_landmark, destination_lat, destination_lng, vehicle, total_seats, seats_remaining, price_per_seat_taka, notes, contact_phone, contact_whatsapp, contact_messenger, kind, departs_at, days, departure_minutes, ends_on, status, expires_at, created_at, updated_at) VALUES (${userId(r.author)}, ${areaId(r.from.area)}, ${sqlString(r.from.landmark)}, ${sqlPoint(r.from.pin)}, ${areaId(r.to.area)}, ${sqlString(r.to.landmark)}, ${sqlPoint(r.to.pin)}, ${sqlString(r.vehicle)}, ${r.seats}, ${r.seats - r.taken}, ${r.price}, ${sqlString(r.notes)}, ${sqlOptional(r.contacts.phone)}, ${sqlOptional(r.contacts.whatsapp)}, ${sqlOptional(r.contacts.messenger)}, ${sqlString(r.when.kind)}, ${departsAt ?? "NULL"}, ${days ?? "NULL"}, ${minutes ?? "NULL"}, ${oneOff ? "NULL" : sqlString(endsOn)}, 'published', ${expiresAt}, ${createdAt}, ${createdAt});`;
    }),
  ];
}

if (import.meta.main) {
  if (process.argv.length > 2) {
    console.error("seed:rides takes no arguments: it only ever runs against local D1.");
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), "unilink-seed-rides-"));
  try {
    const file = join(dir, "rides.sql");
    writeFileSync(file, mockRideStatements().join("\n"));
    execFileSync("wrangler", ["d1", "execute", "DB", "--local", `--file=${file}`], {
      stdio: "inherit",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
