import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AUTHOR_DELETE_REASON } from "../../shared/posts";
import { runCronJobs, postPurgeJob } from "../cron";
import { contactColumns } from "../db/contactColumns";
import { getDb } from "../db/client";
import { moderationColumns } from "../db/moderationColumns";
import { limits } from "../limits";
import type { AppEnv, SessionUser } from "../middleware/types";
import type { ModeratedPostTypes } from "../moderation/postTypes";
import { reverse } from "../reverse";
import { softDelete, type SoftDeleteTargets } from "../softDelete";
import { createTestUser } from "../test/factories";
import { authorDelete, deleteOwnPost } from "./authorDelete";
import { revealContact } from "./contactReveal";

/*
 * The shared post kit on a throwaway table, the way a post type will register its own: author-delete,
 * the reversal refusal, the purge rule and the contact reveal. The rides block adds its own table to the
 * same checks (and a `ride` case to the cron test) instead of rewriting them.
 */
const TYPE = "kit_post";
const kitPosts = sqliteTable("test_kit_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  authorId: integer("author_id").notNull(),
  body: text("body").notNull(),
  ...moderationColumns,
  ...contactColumns,
  expiresAt: integer("expires_at"),
  deletedAt: integer("deleted_at"),
  deletedBy: integer("deleted_by"),
});
const targets: SoftDeleteTargets = { [TYPE]: kitPosts };
const postTypes: ModeratedPostTypes = { [TYPE]: { table: kitPosts, screenedText: () => [] } };

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 10, 12, 4, 0, 0);

let author: number;
let other: number;
let mod: number;
let admin: number;

beforeAll(async () => {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS test_kit_posts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      author_id integer NOT NULL,
      body text NOT NULL,
      status text DEFAULT 'pending_review' NOT NULL,
      moderation_category text,
      moderation_flags text,
      moderation_confidence real,
      moderation_model text,
      moderation_appealed_at integer,
      contact_phone text,
      contact_whatsapp text,
      contact_messenger text,
      expires_at integer,
      deleted_at integer,
      deleted_by integer
    )`,
  ).run();
});

beforeEach(async () => {
  for (const table of [
    "test_kit_posts",
    "reports",
    "audit_log",
    "notifications",
    "rate_limits",
    "sessions",
    "users",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  author = (await createTestUser(db())).id;
  other = (await createTestUser(db())).id;
  mod = (await createTestUser(db(), { role: "mod" })).id;
  admin = (await createTestUser(db(), { role: "admin" })).id;
});

async function addPost(
  fields: Partial<{
    status: string;
    phone: string | null;
    expiresAt: number | null;
    deletedAt: number | null;
    deletedBy: number | null;
    authorId: number;
  }> = {},
): Promise<number> {
  const row = await env.DB.prepare(
    `INSERT INTO test_kit_posts (author_id, body, status, contact_phone, contact_messenger, expires_at, deleted_at, deleted_by)
     VALUES (?, 'hi', ?, ?, 'https://m.me/some.one', ?, ?, ?) RETURNING id`,
  )
    .bind(
      fields.authorId ?? author,
      fields.status ?? "published",
      fields.phone === undefined ? "+8801712345678" : fields.phone,
      fields.expiresAt === undefined ? NOW + DAY : fields.expiresAt,
      fields.deletedAt ?? null,
      fields.deletedBy ?? null,
    )
    .first<{ id: number }>();
  return row!.id;
}

const exists = async (id: number) =>
  (await env.DB.prepare("SELECT 1 AS x FROM test_kit_posts WHERE id = ?").bind(id).first()) !==
  null;

const auditRows = async () =>
  (await env.DB.prepare("SELECT * FROM audit_log ORDER BY id").all<Record<string, unknown>>())
    .results;

const openReport = (targetId: number, reporter: number = other) =>
  env.DB.prepare(
    "INSERT INTO reports (target_type, target_id, reporter_id, reason, status, created_at) VALUES (?, ?, ?, 'bad', 'open', ?)",
  )
    .bind(TYPE, String(targetId), reporter, NOW)
    .run();

describe("author delete", () => {
  it("hides the post at once, audits it with the reason author, and tells nobody", async () => {
    const id = await addPost();
    const result = await authorDelete(
      db(),
      { userId: author, targetType: TYPE, targetId: id },
      { postTypes, targets, now: NOW },
    );
    expect(result).toEqual({ ok: true });

    const row = await env.DB.prepare(
      "SELECT deleted_at, deleted_by FROM test_kit_posts WHERE id = ?",
    )
      .bind(id)
      .first();
    expect(row).toEqual({ deleted_at: NOW, deleted_by: author });
    expect(await auditRows()).toMatchObject([
      {
        actor: String(author),
        action: "soft_delete",
        target_type: TYPE,
        reason: AUTHOR_DELETE_REASON,
      },
    ]);
    const notices = await env.DB.prepare("SELECT 1 FROM notifications").all();
    expect(notices.results).toHaveLength(0);
  });

  it("is a not_found for anyone else, a deleted post, an unknown type and a missing post", async () => {
    const id = await addPost();
    const input = { userId: other, targetType: TYPE, targetId: id };
    expect(await authorDelete(db(), input, { postTypes, targets })).toEqual({
      ok: false,
      reason: "not_found",
    });
    // A mod is not the author either: mods use the removal flow.
    expect(await authorDelete(db(), { ...input, userId: mod }, { postTypes, targets })).toEqual({
      ok: false,
      reason: "not_found",
    });
    const mine = { userId: author, targetType: TYPE, targetId: id };
    expect(
      await authorDelete(db(), { ...mine, targetType: "nope" }, { postTypes, targets }),
    ).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(
      await authorDelete(db(), { ...mine, targetId: id + 99 }, { postTypes, targets }),
    ).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await authorDelete(db(), mine, { postTypes, targets })).toEqual({ ok: true });
    expect(await authorDelete(db(), mine, { postTypes, targets })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await auditRows()).toHaveLength(1);
  });
});

describe("reversing a delete", () => {
  it("refuses an author's own delete, and still reverses a mod's removal", async () => {
    const own = await addPost();
    await authorDelete(
      db(),
      { userId: author, targetType: TYPE, targetId: own },
      { postTypes, targets },
    );
    const removed = await addPost();
    await softDelete(
      db(),
      { actor: mod, targetType: TYPE, targetId: removed, reason: "spam" },
      { targets },
    );
    const [ownAudit, modAudit] = await auditRows();

    expect(
      await reverse(
        db(),
        { auditId: ownAudit!.id as number, actor: admin, reason: "undo" },
        { targets },
      ),
    ).toEqual({ ok: false, reason: "not_reversible" });
    // The refused reversal leaves the post deleted.
    expect(
      (await env.DB.prepare("SELECT deleted_at FROM test_kit_posts WHERE id = ?").bind(own).first<{
        deleted_at: number | null;
      }>())!.deleted_at,
    ).not.toBeNull();

    expect(
      (
        await reverse(
          db(),
          { auditId: modAudit!.id as number, actor: admin, reason: "undo" },
          { targets },
        )
      ).ok,
    ).toBe(true);
  });

  it("does not let a mod's removal that says 'author' pass for an author delete", async () => {
    const id = await addPost();
    await softDelete(
      db(),
      { actor: mod, targetType: TYPE, targetId: id, reason: AUTHOR_DELETE_REASON },
      { targets },
    );
    const [row] = await auditRows();
    expect(
      (
        await reverse(
          db(),
          { auditId: row!.id as number, actor: admin, reason: "undo" },
          { targets },
        )
      ).ok,
    ).toBe(true);
  });
});

describe("purge rule", () => {
  const purge = () => runCronJobs(db(), NOW, [postPurgeJob("kit_posts", TYPE, kitPosts)]);

  it("deletes a post expired past the window, keeps one still inside it or live", async () => {
    const lapsed = await addPost({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    const justLapsed = await addPost({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs + HOUR });
    const live = await addPost({ expiresAt: NOW + DAY });
    expect(await purge()).toEqual({ kit_posts: 1 });
    expect(await exists(lapsed)).toBe(false);
    expect(await exists(justLapsed)).toBe(true);
    expect(await exists(live)).toBe(true);
  });

  it("deletes an author-deleted post only after the author-delete window", async () => {
    const old = await addPost({
      deletedAt: NOW - limits.authorDeletePurgeMs - 1,
      deletedBy: author,
    });
    const fresh = await addPost({ deletedAt: NOW - DAY, deletedBy: author });
    await purge();
    expect(await exists(old)).toBe(false);
    expect(await exists(fresh)).toBe(true);
  });

  it("never purges a mod-removed post that has not expired", async () => {
    const id = await addPost({ deletedAt: NOW - 30 * DAY, deletedBy: mod });
    await purge();
    expect(await exists(id)).toBe(true);
  });

  it("keeps a due post while a report on it is open, and deletes it after the report is closed", async () => {
    const expired = await addPost({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    const deleted = await addPost({
      deletedAt: NOW - limits.authorDeletePurgeMs - 1,
      deletedBy: author,
    });
    await openReport(expired);
    await openReport(deleted);

    expect(await purge()).toEqual({ kit_posts: 0 });
    expect(await exists(expired)).toBe(true);
    expect(await exists(deleted)).toBe(true);

    await env.DB.prepare("UPDATE reports SET status = 'resolved'").run();
    expect(await purge()).toEqual({ kit_posts: 2 });
    expect(await exists(expired)).toBe(false);
    expect(await exists(deleted)).toBe(false);
  });

  it("is not held back by an open report on a different post or a different type", async () => {
    const id = await addPost({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    const bystander = await addPost();
    await openReport(bystander);
    await env.DB.prepare(
      "INSERT INTO reports (target_type, target_id, reporter_id, reason, status, created_at) VALUES ('other_type', ?, ?, 'bad', 'open', ?)",
    )
      .bind(String(id), other, NOW)
      .run();
    await purge();
    expect(await exists(id)).toBe(false);
    expect(await exists(bystander)).toBe(true);
  });

  it("writes one audit row for the run", async () => {
    await addPost({ expiresAt: NOW - limits.postExpiry.expiredPurgeMs - 1 });
    await purge();
    expect(await auditRows()).toMatchObject([
      { actor: "system", action: "cron_purge", target_type: TYPE, target_id: "kit_posts" },
    ]);
  });
});

describe("contact reveal and author delete handlers", () => {
  // The handlers read the real clock, while the posts here expire relative to NOW: pin Date to NOW.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  // A router the way a post type mounts the kit: behind a session, one line per handler.
  function appFor(user: SessionUser | null) {
    return new Hono<AppEnv>()
      .use(async (c, next) => {
        c.set("user", user);
        await next();
      })
      .get("/:id/contact", revealContact(kitPosts))
      .delete("/:id", deleteOwnPost(TYPE, { postTypes, targets }));
  }
  const sessionUser = (id: number, role: SessionUser["role"] = "student"): SessionUser => ({
    id,
    username: `u${id}`,
    role,
    admissionYear: 22,
    mustChangePassword: false,
    createdAt: 0,
    sessionId: 1,
  });
  const get = (user: SessionUser | null, id: number) =>
    appFor(user).request(`/${id}/contact`, {}, env);

  it("needs a login", async () => {
    const id = await addPost();
    expect((await get(null, id)).status).toBe(401);
  });

  it("returns only the contacts of a visible post", async () => {
    const id = await addPost();
    const res = await get(sessionUser(other), id);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      contacts: { phone: "+8801712345678", messenger: "https://m.me/some.one" },
    });
  });

  it("answers 404 for a held, rejected, deleted, expired or missing post, as it does for a missing one", async () => {
    const held = await addPost({ status: "pending_review" });
    const rejected = await addPost({ status: "rejected" });
    const deleted = await addPost({ deletedAt: NOW, deletedBy: author });
    const expired = await addPost({ expiresAt: Date.now() - HOUR });
    for (const id of [held, rejected, deleted, expired, 9999]) {
      expect((await get(sessionUser(other), id)).status).toBe(404);
    }
  });

  it("shows a held post to its author and to a mod, never to someone else", async () => {
    const held = await addPost({ status: "pending_review" });
    expect((await get(sessionUser(author), held)).status).toBe(200);
    expect((await get(sessionUser(mod, "mod"), held)).status).toBe(200);
    expect((await get(sessionUser(other), held)).status).toBe(404);
  });

  it("is rate limited per user and answers 429 with Retry-After", async () => {
    const id = await addPost();
    for (let i = 0; i < limits.contactReveal.limit; i++) {
      expect((await get(sessionUser(other), id)).status).toBe(200);
    }
    const res = await get(sessionUser(other), id);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
    // Someone else still has their own allowance.
    expect((await get(sessionUser(author), id)).status).toBe(200);
  });

  it("deletes through the author's own DELETE and 404s for another user", async () => {
    const id = await addPost();
    expect(
      (await appFor(sessionUser(other)).request(`/${id}`, { method: "DELETE" }, env)).status,
    ).toBe(404);
    expect(await exists(id)).toBe(true);
    const res = await appFor(sessionUser(author)).request(`/${id}`, { method: "DELETE" }, env);
    expect(res.status).toBe(200);
    // The post and its contacts are gone for everyone at once.
    expect((await get(sessionUser(other), id)).status).toBe(404);
  });
});
