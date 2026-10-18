import type { Db } from "./db/client";
import { auditLogRepo } from "./repos/auditLog";

export type AuditActor = number | "automod" | "system";

export type AuditEntry = {
  /** A user id, or "automod" / "system" for automatic actions. */
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string | number;
  /** Snapshot of the target before the action, so an admin can reverse it. */
  before?: unknown;
  reason?: string;
};

/** Writes one audit row. Every mod and automatic action calls this. Reversal comes later. */
export async function audit(db: Db, entry: AuditEntry, now: number = Date.now()): Promise<void> {
  await auditLogRepo(db).insert({
    actor: String(entry.actor),
    action: entry.action,
    targetType: entry.targetType,
    targetId: String(entry.targetId),
    before: entry.before === undefined ? null : JSON.stringify(entry.before),
    reason: entry.reason ?? null,
    createdAt: now,
  });
}
