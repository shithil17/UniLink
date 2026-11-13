import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { MOCK_RIDES, mockRideStatements } from "../../../../scripts/seed-rides";
import { seed } from "../../../../scripts/seed";
import { RIDE_LANDMARK_MAX_LENGTH, RIDE_NOTES_MAX_LENGTH } from "../../../shared/schemas/rides";
import { parseDhakaDate } from "../../../shared/time";
import { computeExpiresAt } from "../../posts/expiry";

// The mock rides `vp run seed:rides` writes for looking at the maps.
type Row = {
  kind: string;
  departs_at: number | null;
  ends_on: string | null;
  expires_at: number;
  pickup_lat: number | null;
  destination_lat: number | null;
  status: string;
};

const run = async (now: number) => {
  await env.DB.batch(mockRideStatements(now).map((sql) => env.DB.prepare(sql)));
};
const rows = async () => (await env.DB.prepare("SELECT * FROM rides").all<Row>()).results;

describe("mock rides seed", () => {
  it("writes published rides that satisfy every table check, and replaces them on a re-run", async () => {
    await seed(env.DB);
    const now = Date.now();
    await run(now);
    expect(await rows()).toHaveLength(MOCK_RIDES.length);
    await run(now);
    const all = await rows();
    expect(all).toHaveLength(MOCK_RIDES.length);
    expect(all.every((r) => r.status === "published")).toBe(true);
    // A mix of kinds, some with both pins, some with one, some with none.
    expect(all.some((r) => r.kind === "one_off")).toBe(true);
    expect(all.some((r) => r.kind === "recurring")).toBe(true);
    expect(all.some((r) => r.pickup_lat !== null && r.destination_lat !== null)).toBe(true);
    expect(all.some((r) => (r.pickup_lat === null) !== (r.destination_lat === null))).toBe(true);
    expect(all.some((r) => r.pickup_lat === null && r.destination_lat === null)).toBe(true);
  });

  it("expires each ride the way the app does, and stays within the text limits", async () => {
    await seed(env.DB);
    const now = Date.now();
    await run(now);
    for (const r of await rows()) {
      const spec =
        r.departs_at !== null
          ? { at: r.departs_at }
          : { throughDhakaDate: parseDhakaDate(r.ends_on!)! };
      expect(computeExpiresAt(spec, now)).toEqual({ ok: true, expiresAt: r.expires_at });
    }
    for (const r of MOCK_RIDES) {
      expect(r.from.landmark.length).toBeLessThanOrEqual(RIDE_LANDMARK_MAX_LENGTH);
      expect(r.to.landmark.length).toBeLessThanOrEqual(RIDE_LANDMARK_MAX_LENGTH);
      expect(r.notes.length).toBeLessThanOrEqual(RIDE_NOTES_MAX_LENGTH);
    }
  });

  it("includes a ride to an area with no centre, so the Not on the map chip shows", () => {
    expect(
      MOCK_RIDES.some((r) => r.to.area === "outside-dhaka" || r.from.area === "outside-dhaka"),
    ).toBe(true);
  });
});
