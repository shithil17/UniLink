import type { Db } from "../db/client";
import { auditLog } from "../db/schema";

export type NewAuditRow = typeof auditLog.$inferInsert;

export function auditLogRepo(db: Db) {
  return {
    async insert(row: NewAuditRow) {
      await db.insert(auditLog).values(row);
    },
  };
}
