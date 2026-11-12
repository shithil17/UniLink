import { and, eq, gt, isNotNull, lt, notExists, or, sql } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client";
import { reports } from "../db/schema";
import { limits } from "../limits";

/** A post table the cleanup can purge: `id`, `author_id`, the soft-delete columns and, if it expires, `expires_at`. */
export type PurgeablePostTable = SQLiteTable & {
  id: SQLiteColumn;
  authorId: SQLiteColumn;
  deletedAt: SQLiteColumn;
  deletedBy: SQLiteColumn;
  expiresAt?: SQLiteColumn;
};

/** The feed filter for a table with `expires_at`: only rows that have not lapsed at `now`. */
export const notExpired = (table: { expiresAt: SQLiteColumn }, now: number) =>
  gt(table.expiresAt, now);

/**
 * The purge statement, not yet run. Both halves of its `or` must be answered from an index (the
 * table's `expires_at` index and a partial index on `deleted_at`), as D1 bills every row it reads.
 */
export function purgeDueStatement(
  db: Db,
  table: PurgeablePostTable,
  targetType: string,
  now: number,
) {
  const expired = table.expiresAt
    ? and(isNotNull(table.expiresAt), lt(table.expiresAt, now - limits.postExpiry.expiredPurgeMs))
    : undefined;
  const authorDeleted = and(
    isNotNull(table.deletedAt),
    lt(table.deletedAt, now - limits.authorDeletePurgeMs),
    eq(table.deletedBy, table.authorId),
  );
  const openReport = db
    .select({ one: sql`1` })
    .from(reports)
    .where(
      and(
        eq(reports.targetType, targetType),
        eq(reports.targetId, sql`cast(${table.id} as text)`),
        eq(reports.status, "open"),
      ),
    );
  return db
    .delete(table)
    .where(and(or(expired, authorDeleted), notExists(openReport)))
    .returning({ id: table.id });
}

/**
 * The purge rule every post type's cron job uses, so none has its own copy. A row is hard-deleted when
 *
 *   - it expired more than `limits.postExpiry.expiredPurgeMs` ago, or
 *   - its author deleted it (`deleted_by` is `author_id`) more than `limits.authorDeletePurgeMs` ago,
 *
 * and in both cases only if no report on it is still open. Deleting at once would let a reported scam
 * wipe its own evidence; the row goes on the first run after the report is closed. A post a mod removed
 * goes only once it has expired and the window has passed (the expired branch above); after that it can
 * no longer be reversed. The rows must not be left holding files: a type with photos deletes them from
 * the returned ids. `targetType` is the report target type of the table.
 */
export function postLifecycleRepo(db: Db, table: PurgeablePostTable, targetType: string) {
  return {
    /** Hard-deletes what is due at `now` and returns the ids it removed. One statement. */
    async purgeDue(now: number): Promise<number[]> {
      const rows = await purgeDueStatement(db, table, targetType, now);
      return rows.map((r) => r.id as number);
    },
  };
}
