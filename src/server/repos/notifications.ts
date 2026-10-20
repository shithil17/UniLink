import { and, count, desc, eq, isNull, lt } from "drizzle-orm";
import type { Db } from "../db/client";
import { notifications } from "../db/schema";
import { limits } from "../limits";

export type NotificationRow = typeof notifications.$inferSelect;
export type NewNotification = Pick<
  typeof notifications.$inferInsert,
  "userId" | "type" | "payload" | "createdAt"
>;

/**
 * Notifications. Reads and changes take the owner's id and always filter on it, so one user can
 * never see or touch another's rows. `insertMany` is the one write that targets other users and is
 * only called through `notify()`.
 */
export function notificationsRepo(db: Db) {
  return {
    /** Inserts all rows in one D1 batch, chunked to stay under the bound-parameter cap. */
    async insertMany(rows: NewNotification[]): Promise<void> {
      const inserts = [];
      for (let i = 0; i < rows.length; i += limits.notifyChunkRows) {
        inserts.push(db.insert(notifications).values(rows.slice(i, i + limits.notifyChunkRows)));
      }
      const [first, ...rest] = inserts;
      if (first) await db.batch([first, ...rest]);
    },
    /** One page of the owner's notifications, newest first. `beforeId` is the last id of the previous page. */
    async listPage(
      ownerId: number,
      limit: number,
      beforeId: number | null,
    ): Promise<NotificationRow[]> {
      return db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, ownerId),
            beforeId === null ? undefined : lt(notifications.id, beforeId),
          ),
        )
        .orderBy(desc(notifications.id))
        .limit(limit)
        .all();
    },
    async countUnread(ownerId: number): Promise<number> {
      const row = await db
        .select({ n: count() })
        .from(notifications)
        .where(and(eq(notifications.userId, ownerId), isNull(notifications.readAt)))
        .get();
      return row?.n ?? 0;
    },
    /**
     * Marks one of the owner's notifications read and returns it, or null when it is not theirs or
     * does not exist. A second call keeps the first `read_at`.
     */
    async markRead(ownerId: number, id: number, now: number): Promise<NotificationRow | null> {
      const own = and(eq(notifications.id, id), eq(notifications.userId, ownerId));
      await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(own, isNull(notifications.readAt)));
      return (await db.select().from(notifications).where(own).get()) ?? null;
    },
    /** Marks all the owner's unread notifications read; returns how many changed. */
    async markAllRead(ownerId: number, now: number): Promise<number> {
      const rows = await db
        .update(notifications)
        .set({ readAt: now })
        .where(and(eq(notifications.userId, ownerId), isNull(notifications.readAt)))
        .returning({ id: notifications.id });
      return rows.length;
    },
  };
}
