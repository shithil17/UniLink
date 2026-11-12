import { and, eq, isNull } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client";

/**
 * Any content table that mods can remove. It needs an integer `id` and the two soft-delete columns,
 * `deleted_at` (UTC epoch ms) and `deleted_by` (the mod's user id).
 */
export type SoftDeletableTable = SQLiteTable & {
  id: SQLiteColumn;
  deletedAt: SQLiteColumn;
  deletedBy: SQLiteColumn;
  /** The post tables all name their owner `author_id`; a table without one never notifies. */
  authorId?: SQLiteColumn;
};

/** The columns a soft delete changes: the before-snapshot, and what a reversal puts back. */
export type SoftDeleteState = { deletedAt: number | null; deletedBy: number | null };

export function softDeleteRepo(db: Db, table: SoftDeletableTable) {
  return {
    /** The current soft-delete columns of a row, or null when the row does not exist. */
    async state(id: number): Promise<SoftDeleteState | null> {
      const row = await db
        .select({ deletedAt: table.deletedAt, deletedBy: table.deletedBy })
        .from(table)
        .where(eq(table.id, id))
        .get();
      return (row as SoftDeleteState | undefined) ?? null;
    },
    /** Who wrote the row, or null when the table has no author column or the row is missing. */
    async authorOf(id: number): Promise<number | null> {
      if (!table.authorId) return null;
      const row = await db
        .select({ authorId: table.authorId })
        .from(table)
        .where(eq(table.id, id))
        .get();
      return (row?.authorId as number | null | undefined) ?? null;
    },
    /** Marks a live row deleted. False when it is already deleted or missing. Never removes the row. */
    async markDeleted(id: number, by: number, now: number): Promise<boolean> {
      const rows = await db
        .update(table)
        .set({ deletedAt: now, deletedBy: by })
        .where(and(eq(table.id, id), isNull(table.deletedAt)))
        .returning({ id: table.id });
      return rows.length > 0;
    },
    /** The update that puts a snapshot back (not run here, so a reversal can batch it with its audit row). */
    restoreStatement(id: number, snapshot: SoftDeleteState) {
      return db.update(table).set(snapshot).where(eq(table.id, id));
    },
  };
}
