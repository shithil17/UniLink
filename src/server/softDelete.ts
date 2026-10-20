import { auditActions } from "../shared/auditActions";
import { audit } from "./audit";
import type { Db } from "./db/client";
import { softDeleteRepo, type SoftDeletableTable } from "./repos/softDelete";

/** Content tables by audit target type. */
export type SoftDeleteTargets = Readonly<Record<string, SoftDeletableTable>>;

/**
 * Every table mods can soft-delete from, keyed by the target type written to the audit log. A content
 * type adds one line here when it ships (its table needs `id`, `deleted_at`, `deleted_by`); `softDelete()`
 * and `reverse()` then work on it with no other change. Empty until the first post type exists.
 */
export const softDeleteTargets: SoftDeleteTargets = {};

export type SoftDeleteInput = {
  /** The mod's user id. */
  actor: number;
  targetType: string;
  targetId: number;
  reason: string;
};

export type SoftDeleteResult =
  | { ok: true }
  | { ok: false; reason: "unknown_target" | "not_found" | "already_deleted" };

/**
 * The one way content is removed by a mod: sets `deleted_at` and `deleted_by`, and writes an audit
 * row holding the before-snapshot and the reason, so an admin can reverse it. The row stays in the
 * table; hard deletion only happens in the expiry cron.
 */
export async function softDelete(
  db: Db,
  input: SoftDeleteInput,
  opts: { targets?: SoftDeleteTargets; now?: number } = {},
): Promise<SoftDeleteResult> {
  const table = (opts.targets ?? softDeleteTargets)[input.targetType];
  if (!table) return { ok: false, reason: "unknown_target" };
  const now = opts.now ?? Date.now();

  const repo = softDeleteRepo(db, table);
  const before = await repo.state(input.targetId);
  if (!before) return { ok: false, reason: "not_found" };
  // The UPDATE is guarded on `deleted_at is null`, so two mods racing delete it once and audit once.
  if (before.deletedAt !== null || !(await repo.markDeleted(input.targetId, input.actor, now))) {
    return { ok: false, reason: "already_deleted" };
  }
  await audit(
    db,
    {
      actor: input.actor,
      action: auditActions.softDelete,
      targetType: input.targetType,
      targetId: input.targetId,
      before,
      reason: input.reason,
    },
    now,
  );
  return { ok: true };
}
