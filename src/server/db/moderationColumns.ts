import { sql } from "drizzle-orm";
import { check, index, integer, real, text, type SQLiteColumn } from "drizzle-orm/sqlite-core";
import { postStatus, reasonCategory } from "../../shared/schemas/common.ts";

/** Zod lists enum values as a plain array; Drizzle's `enum` option wants a non-empty tuple. */
const values = <T extends string>(options: T[]) => options as [T, ...T[]];

/**
 * The moderation columns every post table spreads in, so each post type stores the screening result
 * the same way and `visibleTo()` and the mod queue work on all of them:
 *
 *   export const rides = sqliteTable("rides", { id, authorId, ...moderationColumns, ... },
 *     (t) => [...moderationConstraints("rides", t)]);
 *
 * The table also needs an integer `id`, `author_id` and the soft-delete columns `deleted_at` and
 * `deleted_by`. `status` defaults to `pending_review`, so a row written without a screening result is
 * held, never published.
 */
export const moderationColumns = {
  status: text("status", { enum: values(postStatus.options) })
    .notNull()
    .default("pending_review"),
  // The reason category of the latest automatic decision. Shown to the author for a rejection.
  moderationCategory: text("moderation_category", { enum: values(reasonCategory.options) }),
  // JSON array of rule names that fired, for the mod queue.
  moderationFlags: text("moderation_flags"),
  // The model's confidence, 0 to 1. Null when the rules decided or the model gave none.
  moderationConfidence: real("moderation_confidence"),
  moderationModel: text("moderation_model"),
  // When the author tapped "Ask a moderator to look" on a rejected post. Cleared by the next screening.
  moderationAppealedAt: integer("moderation_appealed_at"),
};

const statusList = sql.raw(postStatus.options.map((s) => `'${s}'`).join(", "));

/** The check on `status` and the index the queue pages by (status, then newest first). */
export function moderationConstraints(
  tableName: string,
  t: { id: SQLiteColumn; status: SQLiteColumn },
) {
  return [
    check(`${tableName}_status_check`, sql`${t.status} in (${statusList})`),
    index(`${tableName}_status_id_idx`).on(t.status, t.id),
  ];
}
