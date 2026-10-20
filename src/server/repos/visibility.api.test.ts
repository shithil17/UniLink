import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { beforeAll, beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "../db/client";
import { moderationColumns, moderationConstraints } from "../db/moderationColumns";
import { createTestUser } from "../test/factories";
import { visibleTo, type Viewer } from "./visibility";

// No post table exists yet, so this registers a throwaway one the way a post type will.
const testPosts = sqliteTable(
  "test_moderated_posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    authorId: integer("author_id").notNull(),
    body: text("body").notNull(),
    ...moderationColumns,
  },
  (t) => moderationConstraints("test_moderated_posts", t),
);

const db = () => getDb(env.DB);
let author: number;
let other: number;
let mod: number;
let admin: number;

const asViewer = (id: number, role: "student" | "mod" | "admin"): Viewer => ({ id, role });
const bodiesFor = async (viewer: Viewer) =>
  (
    await db()
      .select({ body: testPosts.body })
      .from(testPosts)
      .where(visibleTo(testPosts, viewer))
      .orderBy(testPosts.id)
      .all()
  ).map((r) => r.body);

beforeAll(async () => {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS test_moderated_posts (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      author_id integer NOT NULL,
      body text NOT NULL,
      status text DEFAULT 'pending_review' NOT NULL,
      moderation_category text,
      moderation_flags text,
      moderation_confidence real,
      moderation_model text,
      CONSTRAINT test_moderated_posts_status_check CHECK(status in ('published', 'pending_review', 'rejected'))
    )`,
  ).run();
});

beforeEach(async () => {
  for (const table of ["test_moderated_posts", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  author = (await createTestUser(db())).id;
  other = (await createTestUser(db())).id;
  mod = (await createTestUser(db(), { role: "mod" })).id;
  admin = (await createTestUser(db(), { role: "admin" })).id;
  await db()
    .insert(testPosts)
    .values([
      { authorId: author, body: "live", status: "published" },
      { authorId: author, body: "waiting", status: "pending_review" },
      { authorId: author, body: "refused", status: "rejected" },
    ]);
});

describe("visibleTo", () => {
  it("shows only published posts to anonymous visitors and other students", async () => {
    expect(await bodiesFor(null)).toEqual(["live"]);
    expect(await bodiesFor(asViewer(other, "student"))).toEqual(["live"]);
  });

  it("shows the author their own pending and rejected posts", async () => {
    expect(await bodiesFor(asViewer(author, "student"))).toEqual(["live", "waiting", "refused"]);
  });

  it("shows mods and admins everything", async () => {
    expect(await bodiesFor(asViewer(mod, "mod"))).toEqual(["live", "waiting", "refused"]);
    expect(await bodiesFor(asViewer(admin, "admin"))).toEqual(["live", "waiting", "refused"]);
  });

  it("holds a row written without a screening result", async () => {
    await db().insert(testPosts).values({ authorId: author, body: "unscreened" });
    expect(await bodiesFor(asViewer(other, "student"))).toEqual(["live"]);
  });

  it("refuses a status outside the three values", async () => {
    await expect(db().run(sql`UPDATE test_moderated_posts SET status = 'bogus'`)).rejects.toThrow();
  });
});
