import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { pushSubscriptions } from "../db/schema";
import { limits } from "../limits";
import type { PushTarget } from "../adapters/push";

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

/** Splits a list into pieces that fit D1's bound-parameter cap. */
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += limits.d1MaxBoundParams) {
    out.push(items.slice(i, i + limits.d1MaxBoundParams));
  }
  return out;
}

/** Web Push subscriptions: private to the owner, read in bulk only by `notify()`. */
export function pushSubscriptionsRepo(db: Db) {
  return {
    /**
     * Saves a device for the user in one statement. An endpoint that already exists (same device,
     * another login) moves to this user. The cap is part of the statement: it counts the user's
     * other devices, so re-saving an own endpoint never trips it. Returns false when over the cap.
     */
    async upsert(userId: number, sub: PushTarget, now: number): Promise<boolean> {
      const t = pushSubscriptions;
      const rows = await db.all<{ id: number }>(sql`
        insert into ${t} (user_id, endpoint, p256dh, auth, created_at)
        select ${userId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth}, ${now}
        where (select count(*) from ${t} where ${t.userId} = ${userId} and ${t.endpoint} <> ${sub.endpoint}) < ${limits.pushSubscriptionsMax}
        on conflict (endpoint) do update set
          user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = excluded.created_at
        returning id`);
      return rows.length > 0;
    },
    /** Removes the user's own row for this endpoint. Idempotent: a missing row is fine. */
    async remove(userId: number, endpoint: string): Promise<void> {
      const t = pushSubscriptions;
      await db.delete(t).where(and(eq(t.userId, userId), eq(t.endpoint, endpoint)));
    },
    /** Every device of these users, chunked under the parameter cap and sent as one D1 batch. */
    async listForUsers(userIds: number[]): Promise<PushTarget[]> {
      const t = pushSubscriptions;
      const selects = chunks(userIds).map((ids) =>
        db
          .select({ endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth })
          .from(t)
          .where(inArray(t.userId, ids)),
      );
      const [first, ...rest] = selects;
      if (!first) return [];
      return (await db.batch([first, ...rest])).flat();
    },
    /** Deletes dead subscriptions by endpoint, chunked into one batch. */
    async removeEndpoints(endpoints: string[]): Promise<void> {
      const t = pushSubscriptions;
      const deletes = chunks(endpoints).map((e) => db.delete(t).where(inArray(t.endpoint, e)));
      const [first, ...rest] = deletes;
      if (first) await db.batch([first, ...rest]);
    },
  };
}
