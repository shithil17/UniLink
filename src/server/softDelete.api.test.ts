import { env } from "cloudflare:workers";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "./db/client";
import { reverse } from "./reverse";
import { softDelete, softDeleteTargets, type SoftDeleteTargets } from "./softDelete";
import { createTestUser } from "./test/factories";

// No content table exists yet, so these tests register a throwaway one the way a post type will.
const testPosts = sqliteTable("test_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  body: text("body").notNull(),
  deletedAt: integer("deleted_at"),
  deletedBy: integer("deleted_by"),
});
const targets: SoftDeleteTargets = { test_post: testPosts };

const db = () => getDb(env.DB);
let mod: number;
let admin: number;

const rowOf = (id: number) =>
  env.DB.prepare("SELECT body, deleted_at, deleted_by FROM test_posts WHERE id = ?")
    .bind(id)
    .first<{ body: string; deleted_at: number | null; deleted_by: number | null }>();

beforeAll(async () => {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS test_posts (id integer PRIMARY KEY AUTOINCREMENT NOT NULL, body text NOT NULL, deleted_at integer, deleted_by integer)",
  ).run();
});

beforeEach(async () => {
  for (const table of ["test_posts", "audit_log", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  mod = (await createTestUser(db(), { role: "mod" })).id;
  admin = (await createTestUser(db(), { role: "admin" })).id;
  await env.DB.prepare("INSERT INTO test_posts (id, body) VALUES (1, 'hello')").run();
});

const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log ORDER BY id").all<{
    id: number;
    actor: string;
    action: string;
    target_type: string;
    target_id: string;
    before: string | null;
    reason: string | null;
    reverses_id: number | null;
  }>();

describe("softDelete()", () => {
  it("marks the row, keeps it, and logs the before-snapshot and reason", async () => {
    const result = await softDelete(
      db(),
      { actor: mod, targetType: "test_post", targetId: 1, reason: "spam" },
      { targets, now: 5000 },
    );
    expect(result).toEqual({ ok: true });
    expect(await rowOf(1)).toEqual({ body: "hello", deleted_at: 5000, deleted_by: mod });

    const [row] = (await auditRows()).results;
    expect(row).toMatchObject({
      actor: String(mod),
      action: "soft_delete",
      target_type: "test_post",
      target_id: "1",
      before: '{"deletedAt":null,"deletedBy":null}',
      reason: "spam",
    });
  });

  it("refuses an unknown target type, a missing row and a second delete, logging nothing", async () => {
    const input = { actor: mod, targetType: "test_post", targetId: 1, reason: "spam" };
    expect(await softDelete(db(), { ...input, targetType: "nope" }, { targets })).toEqual({
      ok: false,
      reason: "unknown_target",
    });
    expect(await softDelete(db(), { ...input, targetId: 99 }, { targets })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect((await softDelete(db(), input, { targets })).ok).toBe(true);
    expect(await softDelete(db(), input, { targets })).toEqual({
      ok: false,
      reason: "already_deleted",
    });
    expect((await auditRows()).results).toHaveLength(1);
  });

  it("has no registered target until a content type adds one", () => {
    expect(Object.keys(softDeleteTargets)).toEqual([]);
  });
});

describe("reverse() on a soft delete", () => {
  it("restores the exact before-state and logs itself", async () => {
    await softDelete(
      db(),
      { actor: mod, targetType: "test_post", targetId: 1, reason: "spam" },
      { targets, now: 5000 },
    );
    const [original] = (await auditRows()).results;

    const result = await reverse(
      db(),
      { auditId: original.id, actor: admin, reason: "mod was wrong" },
      { targets, now: 6000 },
    );
    expect(result.ok).toBe(true);
    expect(await rowOf(1)).toEqual({ body: "hello", deleted_at: null, deleted_by: null });

    const rows = (await auditRows()).results;
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      actor: String(admin),
      action: "reverse",
      target_type: "test_post",
      target_id: "1",
      reverses_id: original.id,
      reason: "mod was wrong",
      // What the target looked like just before the reversal.
      before: '{"deletedAt":5000,"deletedBy":' + mod + "}",
    });
  });

  it("refuses to reverse the same row twice, or a reversal", async () => {
    await softDelete(
      db(),
      { actor: mod, targetType: "test_post", targetId: 1, reason: "spam" },
      { targets },
    );
    const [original] = (await auditRows()).results;
    const first = await reverse(
      db(),
      { auditId: original.id, actor: admin, reason: "x" },
      { targets },
    );
    expect(first.ok).toBe(true);

    expect(
      await reverse(db(), { auditId: original.id, actor: admin, reason: "again" }, { targets }),
    ).toEqual({ ok: false, reason: "already_reversed" });
    const reversal = (await auditRows()).results[1];
    expect(
      await reverse(db(), { auditId: reversal.id, actor: admin, reason: "undo" }, { targets }),
    ).toEqual({ ok: false, reason: "is_reversal" });
    expect((await auditRows()).results).toHaveLength(2);
  });

  it("is refused when the row is gone or the type is no longer registered", async () => {
    await softDelete(
      db(),
      { actor: mod, targetType: "test_post", targetId: 1, reason: "spam" },
      { targets },
    );
    const [original] = (await auditRows()).results;
    expect(
      await reverse(db(), { auditId: original.id, actor: admin, reason: "x" }, { targets: {} }),
    ).toEqual({ ok: false, reason: "not_reversible" });

    await env.DB.prepare("DELETE FROM test_posts").run();
    expect(
      await reverse(db(), { auditId: original.id, actor: admin, reason: "x" }, { targets }),
    ).toEqual({ ok: false, reason: "target_missing" });
  });
});
