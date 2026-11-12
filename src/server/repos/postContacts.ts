import { and, eq, gt, isNull } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { Contacts } from "../../shared/schemas/common";
import type { Db } from "../db/client";
import { visibleTo, type Viewer } from "./visibility";

/**
 * A post table with contacts: the shared `moderationColumns` and `contactColumns`, `author_id` and
 * `deleted_at`. `expiresAt` is optional; when the table has it, an expired post has no contacts to show.
 */
export type ContactPostTable = SQLiteTable & {
  id: SQLiteColumn;
  authorId: SQLiteColumn;
  status: SQLiteColumn;
  deletedAt: SQLiteColumn;
  phone: SQLiteColumn;
  whatsapp: SQLiteColumn;
  messenger: SQLiteColumn;
  expiresAt?: SQLiteColumn;
};

export function postContactsRepo(db: Db, table: ContactPostTable) {
  return {
    /**
     * The contacts of a post the viewer may see: published (or their own, or any for a mod), not
     * deleted, not expired. Null when there is no such post, so a hidden post and a missing one look the same.
     */
    async find(id: number, viewer: Viewer, now: number): Promise<Contacts | null> {
      const row = await db
        .select({ phone: table.phone, whatsapp: table.whatsapp, messenger: table.messenger })
        .from(table)
        .where(
          and(
            eq(table.id, id),
            isNull(table.deletedAt),
            visibleTo(table, viewer),
            table.expiresAt ? gt(table.expiresAt, now) : undefined,
          ),
        )
        .get();
      if (!row) return null;
      // A column left empty is undefined, so it is absent from the JSON answer.
      const value = (v: unknown) => (typeof v === "string" && v !== "" ? v : undefined);
      return {
        phone: value(row.phone),
        whatsapp: value(row.whatsapp),
        messenger: value(row.messenger),
      };
    },
  };
}
