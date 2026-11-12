import { auditActions } from "../shared/auditActions";
import { removedContentKind } from "../shared/schemas/inbox";
import type { PushSender } from "./adapters/push";
import { audit } from "./audit";
import type { Db } from "./db/client";
import { resourceRequests, resourceSubmissions, rides } from "./db/schema";
import { notify } from "./notify";
import { softDeleteRepo, type SoftDeletableTable } from "./repos/softDelete";

/** Content tables by audit target type. */
export type SoftDeleteTargets = Readonly<Record<string, SoftDeletableTable>>;

/**
 * Every table mods can soft-delete from, keyed by the target type written to the audit log. A content
 * type adds one line here when it ships (its table needs `id`, `deleted_at`, `deleted_by`); `softDelete()`
 * and `reverse()` then work on it with no other change.
 */
export const softDeleteTargets: SoftDeleteTargets = {
  resource_request: resourceRequests,
  resource_submission: resourceSubmissions,
  ride: rides,
};

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
 * table; hard deletion only happens in the expiry cron. Then the author is told through `notify()`
 * (the type, never the content, and the mod's reason), unless the author removed it themself. This is
 * the one place that runs for every mod removal, so no caller has to remember it. The expiry cron
 * deletes rows directly and never comes through here.
 */
export async function softDelete(
  db: Db,
  input: SoftDeleteInput,
  opts: { targets?: SoftDeleteTargets; now?: number; push?: PushSender | null } = {},
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
  await tellAuthor(db, repo, input, now, opts.push);
  return { ok: true };
}

/** Best effort: the removal and its audit row already stand, so a failed notice is logged, not thrown. */
async function tellAuthor(
  db: Db,
  repo: ReturnType<typeof softDeleteRepo>,
  input: SoftDeleteInput,
  now: number,
  push?: PushSender | null,
): Promise<void> {
  const kind = removedContentKind.safeParse(input.targetType);
  if (!kind.success) return;
  try {
    const author = await repo.authorOf(input.targetId);
    if (author === null || author === input.actor) return;
    await notify(
      db,
      [author],
      "content_removed",
      { kind: kind.data, reason: input.reason },
      { now, push },
    );
  } catch (err) {
    console.error("removal notice failed", err instanceof Error ? err.name : "unknown");
  }
}
