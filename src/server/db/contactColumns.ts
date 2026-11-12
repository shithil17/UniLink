import { sql } from "drizzle-orm";
import { check, text, type SQLiteColumn } from "drizzle-orm/sqlite-core";

/**
 * The contact columns every post table with contacts spreads in, so `GET /api/<type>/:id/contact` works
 * on all of them through `postContactsRepo()`:
 *
 *   export const rides = sqliteTable("rides", { id, authorId, ...moderationColumns, ...contactColumns, ... },
 *     (t) => [...moderationConstraints("rides", t), contactConstraint("rides", t)]);
 *
 * The format of each value is checked by the shared schema (`src/shared/contact.ts`) before it is stored.
 */
export const contactColumns = {
  phone: text("contact_phone"),
  whatsapp: text("contact_whatsapp"),
  messenger: text("contact_messenger"),
};

/** A post keeps at least one contact, even if a write skips the shared schema. */
export function contactConstraint(
  tableName: string,
  t: { phone: SQLiteColumn; whatsapp: SQLiteColumn; messenger: SQLiteColumn },
) {
  return check(
    `${tableName}_contact_check`,
    sql`${t.phone} is not null or ${t.whatsapp} is not null or ${t.messenger} is not null`,
  );
}
