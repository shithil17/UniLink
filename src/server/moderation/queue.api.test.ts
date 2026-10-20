import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { FakeModelStep } from "../adapters/modelStep";
import { app } from "../app";
import { getDb } from "../db/client";
import { moderationColumns, moderationConstraints } from "../db/moderationColumns";
import { decidePost } from "../features/mod/postActions";
import { modQueue } from "../features/mod/queue";
import { limits } from "../limits";
import { SESSION_COOKIE } from "../middleware/session";
import { visibleTo } from "../repos/visibility";
import { createTestSession, createTestUser } from "../test/factories";
import { askModerator } from "./appeal";
import { postTypeOf, type ModeratedPostTypes } from "./postTypes";
import { submitPost } from "./submit";
import { rejectReasonMessage } from "../../shared/rejectReasons";

// No post table exists yet, so these tests register a throwaway one the way a post type will.
const testPosts = sqliteTable(
  "test_queue_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id").notNull(),
    title: text("title").notNull(),
    secretContact: text("secret_contact"),
    deletedAt: integer("deleted_at"),
    deletedBy: integer("deleted_by"),
    ...moderationColumns,
  },
  (t) => moderationConstraints("test_queue_posts", t),
);
const postTypes: ModeratedPostTypes = {
  test_post: { table: testPosts, screenedText: (row) => [String(row.title)] },
};

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
const OLD_ACCOUNT = 0;

type Student = { id: number; createdAt: number };
let author: Awaited<ReturnType<typeof createTestUser>>;
let other: Awaited<ReturnType<typeof createTestUser>>;
let mod: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS test_queue_posts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      author_id integer NOT NULL,
      title text NOT NULL,
      secret_contact text,
      deleted_at integer,
      deleted_by integer,
      status text DEFAULT 'pending_review' NOT NULL,
      moderation_category text,
      moderation_flags text,
      moderation_confidence real,
      moderation_model text,
      moderation_appealed_at integer,
      CONSTRAINT test_queue_posts_status_check CHECK(status in ('published', 'pending_review', 'rejected'))
    )`,
  ).run();
  await env.DB.prepare(
    "CREATE INDEX IF NOT EXISTS test_queue_posts_status_id_idx ON test_queue_posts (status, id)",
  ).run();
});

beforeEach(async () => {
  for (const table of [
    "test_queue_posts",
    "notifications",
    "reports",
    "audit_log",
    "rate_limits",
    "sessions",
    "users",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  author = await createTestUser(db(), { createdAt: OLD_ACCOUNT });
  other = await createTestUser(db(), { createdAt: OLD_ACCOUNT });
  mod = await createTestUser(db(), { role: "mod" });
});

const holdAll = { SCREEN_FORCE_REVIEW: "1" };
const noEnv = {};

/** Creates a post through the shared helper, the way a post type's create route does. */
function create(
  user: Student,
  title: string,
  opts: { env?: { SCREEN_FORCE_REVIEW?: string }; now?: number; model?: FakeModelStep } = {},
) {
  return submitPost(
    db(),
    opts.env ?? noEnv,
    {
      user,
      targetType: "test_post",
      input: { texts: [title] },
      save: async (values) => {
        const row = await db()
          .insert(testPosts)
          .values({ authorId: user.id, title, ...values })
          .returning({ id: testPosts.id })
          .get();
        return row.id;
      },
    },
    { now: opts.now, model: opts.model },
  );
}

const postRow = (id: number) =>
  env.DB.prepare("SELECT * FROM test_queue_posts WHERE id = ?").bind(id).first<{
    status: string;
    title: string;
    moderation_category: string | null;
    moderation_appealed_at: number | null;
  }>();

const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log ORDER BY id")
    .all<{
      actor: string;
      action: string;
      target_type: string;
      target_id: string;
      before: string | null;
      reason: string | null;
    }>()
    .then((r) => r.results);

const inbox = (userId: number) =>
  env.DB.prepare("SELECT type, payload FROM notifications WHERE user_id = ? ORDER BY id")
    .bind(userId)
    .all<{ type: string; payload: string }>()
    .then((r) => r.results);

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  return app.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

describe("a held post", () => {
  it("is hidden from other students, shown to its author, and listed in the mod queue", async () => {
    const created = await create(author, "Selling a calculator", { env: holdAll });
    expect(created.ok && created.outcome.status).toBe("pending_review");
    const id = created.ok ? created.id : 0;

    const titlesFor = async (viewer: { id: number; role: "student" | "mod" } | null) =>
      (
        await db()
          .select({ title: testPosts.title })
          .from(testPosts)
          .where(visibleTo(testPosts, viewer))
          .all()
      ).map((r) => r.title);
    expect(await titlesFor({ id: other.id, role: "student" })).toEqual([]);
    expect(await titlesFor(null)).toEqual([]);
    expect(await titlesFor({ id: author.id, role: "student" })).toEqual(["Selling a calculator"]);

    const queue = await modQueue(db(), { cursor: undefined, size: 20 }, { postTypes });
    expect(queue?.total).toBe(1);
    expect(queue?.items).toEqual([
      {
        kind: "post",
        targetType: "test_post",
        id,
        text: ["Selling a calculator"],
        author: author.username,
        category: "fine",
        confidence: null,
        flags: [],
        model: null,
        appealed: false,
      },
    ]);
  });

  it("never puts a student ID or contact field in the queue", async () => {
    const created = await create(author, "Bike for sale", { env: holdAll });
    await env.DB.prepare("UPDATE test_queue_posts SET secret_contact = '01711111111' WHERE id = ?")
      .bind(created.ok ? created.id : 0)
      .run();
    const queue = await modQueue(db(), { cursor: undefined, size: 20 }, { postTypes });
    const text = JSON.stringify(queue);
    expect(text).toContain(author.username);
    expect(text).not.toContain("01711111111");
    expect(text).not.toContain(author.studentKey);
  });

  it("blanks a student ID or card number in a rejected post the author sent to the queue", async () => {
    const created = await create(
      author,
      "call me, my id is 221 2345 042 or card 4111 1111 1111 1111",
    );
    expect(created.ok && created.outcome.status).toBe("rejected");
    const id = created.ok ? created.id : 0;
    expect(
      await askModerator(
        db(),
        { userId: author.id, targetType: "test_post", targetId: id },
        { postTypes },
      ),
    ).toEqual({ ok: true });

    const queue = await modQueue(db(), { cursor: undefined, size: 20 }, { postTypes });
    const json = JSON.stringify(queue);
    expect(queue?.items).toHaveLength(1);
    expect(json).toContain("[redacted]");
    expect(json).not.toMatch(/2212345042|221 2345 042|4111/);
    expect(json).toContain("student_id");
  });

  it("shows the rule flags and model category of an automatic hold", async () => {
    const model = new FakeModelStep(async () => ({
      verdict: "review",
      category: "scam_or_spam",
      confidence: 0.64,
      scores: {},
    }));
    await create(author, "Great deal, message me", { model });
    const [item] = (await modQueue(db(), { cursor: undefined, size: 20 }, { postTypes }))!.items;
    expect(item).toMatchObject({ category: "scam_or_spam", confidence: 0.64, flags: [] });
  });
});

describe("a mod's decision", () => {
  it("overrides the model on approve, writes an audit row and tells the author", async () => {
    const created = await create(author, "Study group for CSE115", { env: holdAll });
    const id = created.ok ? created.id : 0;

    const result = await decidePost(
      db(),
      { id: mod.id, role: "mod" },
      { type: "test_post", id },
      { decision: "approve" },
      { postTypes, now: 9000 },
    );
    expect(result).toEqual({ ok: true });
    expect((await postRow(id))?.status).toBe("published");

    const decision = (await auditRows()).find((r) => r.action === "mod_approve_post");
    expect(decision).toMatchObject({
      actor: String(mod.id),
      target_type: "test_post",
      target_id: String(id),
    });
    expect(JSON.parse(decision?.before ?? "{}")).toMatchObject({
      status: "pending_review",
      category: "fine",
    });
    expect(await inbox(author.id)).toEqual([
      { type: "post_approved", payload: JSON.stringify({ targetType: "test_post", targetId: id }) },
    ]);
    expect(await inbox(other.id)).toEqual([]);
  });

  it("overrides on reject with a category, and the author's message is category-level", async () => {
    const created = await create(author, "Something odd", { env: holdAll });
    const id = created.ok ? created.id : 0;

    await decidePost(
      db(),
      { id: mod.id, role: "mod" },
      { type: "test_post", id },
      { decision: "reject", reason: "looks like a scam", category: "scam_or_spam" },
      { postTypes },
    );
    expect(await postRow(id)).toMatchObject({
      status: "rejected",
      moderation_category: "scam_or_spam",
    });
    const [note] = await inbox(author.id);
    expect(note.type).toBe("post_rejected");
    expect(JSON.parse(note.payload)).toEqual({
      targetType: "test_post",
      targetId: id,
      category: "scam_or_spam",
    });
    // The mod's private reason stays in the audit log only.
    expect(note.payload).not.toContain("looks like a scam");
    expect(rejectReasonMessage("scam_or_spam")).not.toBe("");
  });

  it("decides a post once, and refuses an unknown type, a missing post or a post not held", async () => {
    const created = await create(author, "Hello", { env: holdAll });
    const id = created.ok ? created.id : 0;
    const actor = { id: mod.id, role: "mod" as const };
    const approve = { decision: "approve" as const };

    expect(await decidePost(db(), actor, { type: "nope", id }, approve, { postTypes })).toEqual({
      ok: false,
      reason: "unknown_target",
    });
    expect(
      await decidePost(db(), actor, { type: "constructor", id }, approve, { postTypes }),
    ).toEqual({ ok: false, reason: "unknown_target" });
    expect(
      await decidePost(db(), actor, { type: "test_post", id: 999 }, approve, { postTypes }),
    ).toEqual({ ok: false, reason: "not_found" });
    expect(
      (await decidePost(db(), actor, { type: "test_post", id }, approve, { postTypes })).ok,
    ).toBe(true);
    expect(
      await decidePost(db(), actor, { type: "test_post", id }, approve, { postTypes }),
    ).toEqual({
      ok: false,
      reason: "not_held",
    });
    expect(await inbox(author.id)).toHaveLength(1);
  });
});

describe("the shared create and edit helper", () => {
  it("publishes a clean post with the stub model and logs the automatic decision", async () => {
    const created = await create(author, "Lost my umbrella near the library");
    expect(created.ok && created.outcome.status).toBe("published");
    const rows = await auditRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor: "automod", action: "automod_approve" });
  });

  it("starts a cooldown after 3 automatic rejections and refuses the next post unsaved", async () => {
    const T0 = 1_000 * HOUR + 10 * 60 * 1000;
    const bad = "call me, my id is 2212345042";
    const results = [];
    for (let i = 0; i < limits.probing.rejections; i++) {
      results.push(await create(author, bad, { now: T0 + i }));
    }
    expect(results.map((r) => r.ok && r.outcome.status)).toEqual([
      "rejected",
      "rejected",
      "rejected",
    ]);
    expect(results.map((r) => r.ok && r.cooldownStarted)).toEqual([false, false, true]);

    const refused = await create(author, "A fine post now", { now: T0 + 1000 });
    expect(refused).toMatchObject({ ok: false, reason: "cooldown" });
    const saved = await env.DB.prepare("SELECT count(*) AS n FROM test_queue_posts").first<{
      n: number;
    }>();
    expect(saved?.n).toBe(3);
    // The cooldown is a hard stop for this user only.
    expect((await create(other, "A fine post", { now: T0 + 1000 })).ok).toBe(true);
  });

  it("screens an edit again: a clean post edited to include an ID is rejected", async () => {
    const created = await create(author, "Original text");
    const id = created.ok ? created.id : 0;
    expect((await postRow(id))?.status).toBe("published");

    const edited = await submitPost(db(), noEnv, {
      user: author,
      targetType: "test_post",
      input: { texts: ["now with my id 2212345042"] },
      save: async (values) => {
        await db().update(testPosts).set(values).where(eqId(id));
        return id;
      },
    });
    expect(edited.ok && edited.outcome.status).toBe("rejected");
    expect(await postRow(id)).toMatchObject({
      status: "rejected",
      moderation_category: "personal_data",
    });
    expect((await auditRows()).map((r) => r.action)).toEqual(["automod_approve", "automod_reject"]);
  });

  it("blocks a new account before screening anything", async () => {
    const fresh = await createTestUser(db(), { createdAt: Date.now() });
    expect(await create(fresh, "Hello")).toMatchObject({ ok: false, reason: "new_account" });
    expect(await auditRows()).toEqual([]);
  });
});

describe("ask a moderator to look", () => {
  const rejectedPost = async () => {
    const created = await create(author, "my id 2212345042");
    return created.ok ? created.id : 0;
  };
  const ask = (userId: number, id: number, now?: number) =>
    askModerator(db(), { userId, targetType: "test_post", targetId: id }, { postTypes, now });

  it("moves the author's rejected post into the queue, marked as asked", async () => {
    const id = await rejectedPost();
    expect(await ask(author.id, id, 7000)).toEqual({ ok: true });
    expect(await postRow(id)).toMatchObject({
      status: "pending_review",
      moderation_appealed_at: 7000,
    });

    const queue = await modQueue(db(), { cursor: undefined, size: 20 }, { postTypes });
    expect(queue?.items[0]).toMatchObject({ id, appealed: true, flags: ["student_id"] });
  });

  it("refuses someone else's post, a published post, and a second tap", async () => {
    const id = await rejectedPost();
    expect(await ask(other.id, id)).toEqual({ ok: false, reason: "not_found" });
    expect(await ask(author.id, id)).toEqual({ ok: true });
    expect(await ask(author.id, id)).toEqual({ ok: false, reason: "not_rejected" });
    const live = await create(author, "A fine post");
    expect(await ask(author.id, live.ok ? live.id : 0)).toEqual({
      ok: false,
      reason: "not_rejected",
    });
  });

  it("is rate limited, with the limit from limits.ts", async () => {
    const id = await rejectedPost();
    for (let i = 0; i < limits.appeal.limit; i++) await ask(author.id, id, 30 * HOUR);
    expect(await ask(author.id, id, 30 * HOUR)).toMatchObject({
      ok: false,
      reason: "rate_limited",
    });
  });

  it("clears the ask when the author edits and the post is screened again", async () => {
    const id = await rejectedPost();
    await ask(author.id, id);
    await submitPost(db(), noEnv, {
      user: author,
      targetType: "test_post",
      input: { texts: ["fixed text"] },
      save: async (values) => {
        await db().update(testPosts).set(values).where(eqId(id));
        return id;
      },
    });
    expect(await postRow(id)).toMatchObject({ status: "published", moderation_appealed_at: null });
  });
});

describe("the queue list", () => {
  it("lists held posts then open reports, pages with a cursor and counts the whole queue", async () => {
    for (const title of ["one", "two", "three"]) await create(author, title, { env: holdAll });
    const reporter = await createTestUser(db(), { createdAt: OLD_ACCOUNT });
    for (let i = 0; i < 2; i++) {
      await env.DB.prepare(
        "INSERT INTO reports (target_type, target_id, reporter_id, reason, status, created_at) VALUES ('user', ?, ?, 'rude', 'open', 1)",
      )
        .bind(String(other.id + i * 1000), reporter.id)
        .run();
    }

    const first = (await modQueue(db(), { cursor: undefined, size: 2 }, { postTypes }))!;
    expect(first.total).toBe(5);
    expect(first.items.map((i) => i.kind)).toEqual(["post", "post"]);
    const second = (await modQueue(db(), { cursor: first.nextCursor!, size: 2 }, { postTypes }))!;
    expect(second.items.map((i) => i.kind)).toEqual(["post", "report"]);
    const third = (await modQueue(db(), { cursor: second.nextCursor!, size: 2 }, { postTypes }))!;
    expect(third.items.map((i) => i.kind)).toEqual(["report"]);
    expect(third.nextCursor).toBeNull();
    expect(await modQueue(db(), { cursor: "9.1", size: 2 }, { postTypes })).toBeNull();
  });
});

describe("queue routes", () => {
  it("answer 403 to students, 401 signed out, and work for mods", async () => {
    const student = await createTestSession(db(), author.id);
    const modToken = await createTestSession(db(), mod.id);

    expect((await call("GET", "/api/mod/queue", null)).status).toBe(401);
    expect((await call("GET", "/api/mod/queue", student)).status).toBe(403);
    expect((await call("POST", "/api/mod/posts/test_post/1/approve", student, {})).status).toBe(
      403,
    );
    expect(
      (
        await call("POST", "/api/mod/posts/test_post/1/reject", student, {
          reason: "no good",
          category: "off_topic",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call("POST", `/api/mod/users/${other.id}/clear-probing`, student, {
          reason: "looks fine",
        })
      ).status,
    ).toBe(403);

    const res = await call("GET", "/api/mod/queue", modToken);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [], nextCursor: null, total: 0 });
    expect((await call("GET", "/api/mod/queue?cursor=bad", modToken)).status).toBe(400);
    // No post type is registered in production yet.
    expect((await call("POST", "/api/mod/posts/ride/1/approve", modToken, {})).status).toBe(404);
    expect(postTypeOf(postTypes, "test_post")).toBeDefined();
  });

  it("merges an open report into the same list", async () => {
    const modToken = await createTestSession(db(), mod.id);
    const reporterToken = await createTestSession(db(), other.id);
    await call("POST", "/api/reports", reporterToken, {
      targetType: "user",
      targetId: author.id,
      reason: "spamming the feed",
    });
    const body = (await (await call("GET", "/api/mod/queue", modToken)).json()) as {
      total: number;
      items: { kind: string; targetLabel: string; reporter: string }[];
    };
    expect(body.total).toBe(1);
    expect(body.items[0]).toMatchObject({
      kind: "report",
      targetLabel: author.username,
      reporter: other.username,
    });
  });
});

describe("the probing flag in the mod panel", () => {
  const flagUser = async () => {
    for (let i = 0; i < limits.probing.rejections; i++) {
      await create(author, "my id 2212345042", { now: 30 * HOUR + i });
    }
  };

  it("shows on the user list with the cooldown, and a mod can clear it with an audit row", async () => {
    await flagUser();
    const modToken = await createTestSession(db(), mod.id);
    const list = (await (
      await call("GET", `/api/mod/users?q=${author.username}`, modToken)
    ).json()) as {
      items: { probingFlaggedAt: number | null; postingBlockedUntil: number | null }[];
    };
    expect(list.items[0].probingFlaggedAt).not.toBeNull();
    expect(list.items[0].postingBlockedUntil).not.toBeNull();

    const res = await call("POST", `/api/mod/users/${author.id}/clear-probing`, modToken, {
      reason: "honest mistakes",
    });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT probing_flagged_at, posting_blocked_until FROM users WHERE id = ?",
    )
      .bind(author.id)
      .first();
    expect(row).toEqual({ probing_flagged_at: null, posting_blocked_until: null });
    const audit = (await auditRows()).find((r) => r.action === "clear_probing_flag");
    expect(audit).toMatchObject({ actor: String(mod.id), target_id: String(author.id) });

    // The count restarts: one more rejection does not trigger the cooldown at once.
    const again = await create(author, "my id 2212345042", { now: 30 * HOUR + 100 });
    expect(again.ok && again.cooldownStarted).toBe(false);
    expect(
      await call("POST", `/api/mod/users/${author.id}/clear-probing`, modToken, {
        reason: "again",
      }).then((r) => r.status),
    ).toBe(409);
  });

  it("is reversible by an admin, which puts the flag and cooldown back", async () => {
    await flagUser();
    const before = await env.DB.prepare(
      "SELECT probing_flagged_at, posting_blocked_until FROM users WHERE id = ?",
    )
      .bind(author.id)
      .first();
    const admin = await createTestUser(db(), { role: "admin" });
    const modToken = await createTestSession(db(), mod.id);
    const adminToken = await createTestSession(db(), admin.id);
    await call("POST", `/api/mod/users/${author.id}/clear-probing`, modToken, {
      reason: "looks fine",
    });
    const entry = await env.DB.prepare(
      "SELECT id FROM audit_log WHERE action = 'clear_probing_flag'",
    ).first<{ id: number }>();

    const res = await call("POST", `/api/admin/audit/${entry?.id}/reverse`, adminToken, {
      reason: "flag was right",
    });
    expect(res.status).toBe(201);
    expect(
      await env.DB.prepare(
        "SELECT probing_flagged_at, posting_blocked_until FROM users WHERE id = ?",
      )
        .bind(author.id)
        .first(),
    ).toEqual(before);
  });
});

function eqId(id: number) {
  return eq(testPosts.id, id);
}
