import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { runCronJobs, postPurgeJob } from "../cron";
import { getDb } from "../db/client";
import { rides } from "../db/schema";
import { limits } from "../limits";
import { createTestUser } from "../test/factories";
import { purgeDueStatement } from "./postLifecycle";

const db = () => getDb(env.DB);
const NOW = Date.UTC(2026, 10, 12, 4, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

let authorId: number;

async function addRide(f: { expiresAt?: number; deletedAt?: number; deletedBy?: number }) {
  const row = await env.DB.prepare(
    `INSERT INTO rides (author_id, pickup_area_id, destination_area_id, vehicle, total_seats,
       seats_remaining, price_per_seat_taka, contact_phone, kind, departs_at, status, expires_at,
       created_at, updated_at, deleted_at, deleted_by)
     VALUES (?, 1, 2, 'car', 4, 4, 100, '+8801712345678', 'one_off', ?, 'published', ?, ?, ?, ?, ?)
     RETURNING id`,
  )
    .bind(
      authorId,
      NOW + DAY,
      f.expiresAt ?? NOW + DAY,
      NOW,
      NOW,
      f.deletedAt ?? null,
      f.deletedBy ?? null,
    )
    .first<{ id: number }>();
  return row!.id;
}

const exists = async (id: number) =>
  (await env.DB.prepare("SELECT 1 AS one FROM rides WHERE id = ?").bind(id).first()) !== null;

const purge = () => runCronJobs(db(), NOW, [postPurgeJob("rides", "ride", rides)]);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM rides").run();
  await env.DB.prepare("DELETE FROM reports").run();
  await env.DB.prepare("DELETE FROM audit_log").run();
  authorId = (await createTestUser(db())).id;
});

describe("ride purge", () => {
  it("answers both halves of the purge from an index, never scanning the rides table", async () => {
    const { sql, params } = purgeDueStatement(db(), rides, "ride", NOW).toSQL();
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${sql}`)
      .bind(...params)
      .all<{ detail: string }>();
    const details = plan.results.map((r) => r.detail).join("\n");
    expect(details).toContain("rides_deleted_idx");
    expect(details).toContain("rides_expires_idx");
    expect(details).not.toMatch(/SCAN rides/);
  });

  it("removes expired and author-deleted rides, and writes one audit row", async () => {
    const expired = await addRide({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    const deleted = await addRide({
      deletedAt: NOW - limits.authorDeletePurgeMs - 1,
      deletedBy: authorId,
    });
    const live = await addRide({});
    expect(await purge()).toEqual({ rides: 2 });
    expect(await exists(expired)).toBe(false);
    expect(await exists(deleted)).toBe(false);
    expect(await exists(live)).toBe(true);
    const audit = await env.DB.prepare(
      "SELECT actor, action, target_type, target_id FROM audit_log",
    ).all();
    expect(audit.results).toEqual([
      { actor: "system", action: "cron_purge", target_type: "ride", target_id: "rides" },
    ]);
  });

  it("keeps a due ride while a report on it is open", async () => {
    const expired = await addRide({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    const deleted = await addRide({
      deletedAt: NOW - limits.authorDeletePurgeMs - 1,
      deletedBy: authorId,
    });
    for (const id of [expired, deleted]) {
      await env.DB.prepare(
        `INSERT INTO reports (reporter_id, target_type, target_id, reason, status, created_at)
         VALUES (?, 'ride', ?, 'spam', 'open', ?)`,
      )
        .bind(authorId, String(id), NOW)
        .run();
    }
    expect(await purge()).toEqual({ rides: 0 });
    expect(await exists(expired)).toBe(true);
    expect(await exists(deleted)).toBe(true);
    expect((await env.DB.prepare("SELECT 1 FROM audit_log").all()).results).toHaveLength(0);
  });
});
