import { z } from "zod";
import { auditActions, reversibleActions } from "../shared/auditActions";
import { role } from "../shared/schemas/auth";
import { instant } from "../shared/schemas/common";
import type { Db } from "./db/client";
import { auditLogRepo, type AuditRow } from "./repos/auditLog";
import { softDeleteRepo } from "./repos/softDelete";
import { usersRepo, type UserState } from "./repos/users";
import { softDeleteTargets, type SoftDeleteTargets } from "./softDelete";

/*
 * Reversal rules. An admin reverses an audit row by id; the stored before-snapshot is written back and
 * the reversal is logged as its own row (action "reverse", `reverses_id` = the row it undoes).
 *
 * | action       | snapshot                    | reversal                                              |
 * | ------------ | --------------------------- | ----------------------------------------------------- |
 * | ban          | { bannedAt }                | puts `banned_at` back (the user can log in again)     |
 * | unban        | { bannedAt }                | puts `banned_at` back (the user is banned again)      |
 * | role_change  | { role }                    | puts `role` back                                      |
 * | release_key  | { studentKey, bannedAt }    | puts the key and `banned_at` back; refused if someone |
 * |              |                             | has taken the key since (`key_in_use`)                |
 * | soft_delete  | { deletedAt, deletedBy }    | puts both columns back (the post is live again)       |
 * | clear_probing_flag | { postingBlockedUntil, probingFlaggedAt } | puts both back (flagged again, cooldown as it was) |
 *
 * Not reversible: a password reset (the old hash is never stored), a report resolution, an ID lookup,
 * automatic actions and a reversal itself. To undo a reversal, repeat the original action. Each row
 * is reversed at most once. A user who has become an admin since is never touched.
 */

const userSnapshot = {
  [auditActions.ban]: z.strictObject({ bannedAt: instant.nullable() }),
  [auditActions.unban]: z.strictObject({ bannedAt: instant.nullable() }),
  [auditActions.roleChange]: z.strictObject({ role }),
  [auditActions.releaseKey]: z.strictObject({
    studentKey: z.string().min(1),
    bannedAt: instant.nullable(),
  }),
  [auditActions.clearProbingFlag]: z.strictObject({
    postingBlockedUntil: instant.nullable(),
    probingFlaggedAt: instant.nullable(),
  }),
} as const;

const softDeleteSnapshot = z.strictObject({
  deletedAt: instant.nullable(),
  deletedBy: z.number().int().nullable(),
});

export type ReverseFailure =
  | "not_found"
  | "not_reversible"
  | "is_reversal"
  | "already_reversed"
  | "target_missing"
  | "target_protected"
  | "key_in_use";

export type ReverseResult = { ok: true; id: number } | { ok: false; reason: ReverseFailure };

type Plan = {
  /** The target's current values for the snapshot's columns, kept in the reversal row. */
  current: Record<string, unknown>;
  restore: Parameters<ReturnType<typeof auditLogRepo>["insertWithRestore"]>[1];
};

/** True if a unique-constraint failure on `column` ("table.column") is anywhere in the error chain. */
function failedUnique(err: unknown, column: string): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes(`UNIQUE constraint failed: ${column}`)) return true;
  }
  return false;
}

function parseSnapshot(row: AuditRow): unknown {
  if (row.before === null) return null;
  try {
    return JSON.parse(row.before);
  } catch {
    return null;
  }
}

async function planUserReversal(
  db: Db,
  row: AuditRow,
  snapshot: unknown,
): Promise<Plan | ReverseFailure> {
  const parsed = userSnapshot[row.action as keyof typeof userSnapshot]?.safeParse(snapshot);
  const userId = Number(row.targetId);
  if (!parsed?.success || !Number.isSafeInteger(userId)) return "not_reversible";

  const users = usersRepo(db);
  const state = await users.findState(userId);
  if (!state) return "target_missing";
  if (state.role === "admin") return "target_protected";

  const restore: Partial<UserState> = parsed.data;
  if (restore.studentKey !== undefined && restore.studentKey !== state.studentKey) {
    const holder = await users.findByStudentKey(restore.studentKey);
    if (holder && holder.id !== userId) return "key_in_use";
  }
  const current = Object.fromEntries(
    Object.keys(restore).map((k) => [k, state[k as keyof typeof state]]),
  );
  return { current, restore: users.restoreStatement(userId, restore) };
}

async function planSoftDeleteReversal(
  db: Db,
  row: AuditRow,
  snapshot: unknown,
  targets: SoftDeleteTargets,
): Promise<Plan | ReverseFailure> {
  const table = targets[row.targetType];
  const parsed = softDeleteSnapshot.safeParse(snapshot);
  const targetId = Number(row.targetId);
  if (!table || !parsed.success || !Number.isSafeInteger(targetId)) return "not_reversible";

  const repo = softDeleteRepo(db, table);
  const state = await repo.state(targetId);
  if (!state) return "target_missing";
  return { current: state, restore: repo.restoreStatement(targetId, parsed.data) };
}

/**
 * Reverses one audit row from its snapshot and logs the reversal. Admin only: the caller checks the
 * role. The reversal row and the restore run as one D1 batch, so a failed restore leaves no row and a
 * second reversal of the same row is refused by the unique index even when two admins race.
 */
export async function reverse(
  db: Db,
  input: { auditId: number; actor: number; reason: string },
  opts: { targets?: SoftDeleteTargets; now?: number } = {},
): Promise<ReverseResult> {
  const log = auditLogRepo(db);
  const row = await log.findById(input.auditId);
  if (!row) return { ok: false, reason: "not_found" };
  if (row.action === auditActions.reverse || row.reversesId !== null) {
    return { ok: false, reason: "is_reversal" };
  }
  if (!reversibleActions.includes(row.action)) return { ok: false, reason: "not_reversible" };
  if ((await log.reversalsOf([row.id])).has(row.id)) {
    return { ok: false, reason: "already_reversed" };
  }

  const snapshot = parseSnapshot(row);
  const plan =
    row.action === auditActions.softDelete
      ? await planSoftDeleteReversal(db, row, snapshot, opts.targets ?? softDeleteTargets)
      : await planUserReversal(db, row, snapshot);
  if (typeof plan === "string") return { ok: false, reason: plan };

  try {
    const id = await log.insertWithRestore(
      {
        actor: String(input.actor),
        action: auditActions.reverse,
        targetType: row.targetType,
        targetId: row.targetId,
        before: JSON.stringify(plan.current),
        reason: input.reason,
        reversesId: row.id,
        createdAt: opts.now ?? Date.now(),
      },
      plan.restore,
    );
    return { ok: true, id };
  } catch (err) {
    if (failedUnique(err, "audit_log.reverses_id"))
      return { ok: false, reason: "already_reversed" };
    if (failedUnique(err, "users.student_key")) return { ok: false, reason: "key_in_use" };
    throw err;
  }
}
