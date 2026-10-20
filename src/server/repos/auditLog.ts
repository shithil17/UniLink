import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Db } from "../db/client";
import { auditLog } from "../db/schema";
import { limits } from "../limits";

export type NewAuditRow = typeof auditLog.$inferInsert;
export type AuditRow = typeof auditLog.$inferSelect;

export type AuditFilter = {
  actor?: string;
  targetType?: string;
  targetId?: string;
};

export function auditLogRepo(db: Db) {
  return {
    async insert(row: NewAuditRow) {
      await db.insert(auditLog).values(row);
    },
    async findById(id: number): Promise<AuditRow | null> {
      return (await db.select().from(auditLog).where(eq(auditLog.id, id)).get()) ?? null;
    },
    /** One page, newest first. `beforeId` is the last id of the previous page. */
    async listPage(
      filter: AuditFilter,
      limit: number,
      beforeId: number | null,
    ): Promise<AuditRow[]> {
      return db
        .select()
        .from(auditLog)
        .where(
          and(
            filter.actor === undefined ? undefined : eq(auditLog.actor, filter.actor),
            filter.targetType === undefined
              ? undefined
              : eq(auditLog.targetType, filter.targetType),
            filter.targetId === undefined ? undefined : eq(auditLog.targetId, filter.targetId),
            beforeId === null ? undefined : lt(auditLog.id, beforeId),
          ),
        )
        .orderBy(desc(auditLog.id))
        .limit(limit)
        .all();
    },
    /** For each of `ids` that has been reversed, the id of its reversal row. */
    async reversalsOf(ids: number[]): Promise<Map<number, number>> {
      const found = new Map<number, number>();
      for (let i = 0; i < ids.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: auditLog.id, reversesId: auditLog.reversesId })
          .from(auditLog)
          .where(inArray(auditLog.reversesId, ids.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) if (r.reversesId !== null) found.set(r.reversesId, r.id);
      }
      return found;
    },
    /**
     * Writes a reversal row and runs `restore` in one D1 batch, which is a transaction: both happen
     * or neither does. The unique index on `reverses_id` makes a second reversal of the same row fail.
     * Returns the new audit row's id.
     */
    async insertWithRestore(row: NewAuditRow, restore: BatchItem<"sqlite">): Promise<number> {
      const [inserted] = await db.batch([
        db.insert(auditLog).values(row).returning({ id: auditLog.id }),
        restore,
      ]);
      return inserted[0]?.id ?? 0;
    },
  };
}
