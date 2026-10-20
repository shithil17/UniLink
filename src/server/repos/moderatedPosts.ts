import { and, asc, count, eq, gt, isNull } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client";
import { users } from "../db/schema";

/**
 * Any post table the review queue and the mod decisions work on: an integer `id` and `author_id`, the
 * shared `moderationColumns`, and the soft-delete column `deleted_at`.
 */
export type ModeratedPostTable = SQLiteTable & {
  id: SQLiteColumn;
  authorId: SQLiteColumn;
  status: SQLiteColumn;
  moderationCategory: SQLiteColumn;
  moderationFlags: SQLiteColumn;
  moderationConfidence: SQLiteColumn;
  moderationModel: SQLiteColumn;
  moderationAppealedAt: SQLiteColumn;
  deletedAt: SQLiteColumn;
};

/** The moderation state of one post: what a decision snapshots and what the queue shows. */
export type PostModerationState = {
  id: number;
  authorId: number;
  status: "published" | "pending_review" | "rejected";
  category: string | null;
  flags: string | null;
  confidence: number | null;
  model: string | null;
  appealedAt: number | null;
  deletedAt: number | null;
};

/** A held post with its author's public handle and the whole row, for the registry to pull text from. */
export type HeldPostRow = PostModerationState & {
  username: string | null;
  row: Record<string, unknown>;
};

export function moderatedPostsRepo(db: Db, table: ModeratedPostTable) {
  const state = {
    id: table.id,
    authorId: table.authorId,
    status: table.status,
    category: table.moderationCategory,
    flags: table.moderationFlags,
    confidence: table.moderationConfidence,
    model: table.moderationModel,
    appealedAt: table.moderationAppealedAt,
    deletedAt: table.deletedAt,
  };
  const held = and(eq(table.status, "pending_review"), isNull(table.deletedAt));

  return {
    /** The moderation state of a row, or null when it does not exist. */
    async find(id: number): Promise<PostModerationState | null> {
      const row = await db.select(state).from(table).where(eq(table.id, id)).get();
      return (row as PostModerationState | undefined) ?? null;
    },
    /** One page of held posts, oldest first, after `afterId`. Pages by the (status, id) index. */
    async heldPage(afterId: number, limit: number): Promise<HeldPostRow[]> {
      const rows = await db
        .select({ ...state, username: users.username, row: table })
        .from(table)
        .leftJoin(users, eq(users.id, table.authorId))
        .where(and(held, gt(table.id, afterId)))
        .orderBy(asc(table.id))
        .limit(limit)
        .all();
      return rows as HeldPostRow[];
    },
    /** How many posts wait for a moderator. */
    async heldCount(): Promise<number> {
      const row = await db.select({ n: count() }).from(table).where(held).get();
      return row?.n ?? 0;
    },
    /**
     * A mod's decision on a held post. One guarded UPDATE, so two mods racing decide it once. A category
     * replaces the stored one (a rejection); null keeps it. False when the post is not held any more.
     */
    async decide(
      id: number,
      status: "published" | "rejected",
      category: string | null,
    ): Promise<boolean> {
      const rows = await db
        .update(table)
        .set({ status, ...(category === null ? {} : { moderationCategory: category }) })
        .where(and(eq(table.id, id), held))
        .returning({ id: table.id });
      return rows.length > 0;
    },
    /** Moves the author's own rejected post to the queue. False when it is not theirs, not rejected, or deleted. */
    async appeal(id: number, authorId: number, now: number): Promise<boolean> {
      const rows = await db
        .update(table)
        .set({ status: "pending_review", moderationAppealedAt: now })
        .where(
          and(
            eq(table.id, id),
            eq(table.authorId, authorId),
            eq(table.status, "rejected"),
            isNull(table.deletedAt),
          ),
        )
        .returning({ id: table.id });
      return rows.length > 0;
    },
  };
}
