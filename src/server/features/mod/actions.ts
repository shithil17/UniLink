import { auditActions } from "../../../shared/auditActions";
import { canActOn } from "../../../shared/modPolicy";
import { audit } from "../../audit";
import type { Db } from "../../db/client";
import { probingKey } from "../../moderation/probing";
import type { Role } from "../../middleware/types";
import { hashPassword } from "../../password";
import { reportsRepo, type ReportRow, type ReportStatus } from "../../repos/reports";
import { rateLimitsRepo } from "../../repos/rateLimits";
import { sessionsRepo } from "../../repos/sessions";
import { RELEASED_KEY_PREFIX, usersRepo, type ModUserRow } from "../../repos/users";
import { generateTemporaryPassword } from "../../tempPassword";

// Each action changes state, then writes its audit row with the before-snapshot a reversal needs.
// The snapshot holds only the columns the action changed, and never a password or hash.

export type Actor = { id: number; role: Role };

export type ActionFailure =
  | "not_found"
  | "forbidden_target"
  | "already_banned"
  | "not_banned"
  | "key_already_released"
  | "role_unchanged"
  | "conflict"
  | "already_resolved"
  | "not_flagged";

export type ActionResult<T = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; reason: ActionFailure };

type Target = { ok: true; target: ModUserRow } | { ok: false; reason: ActionFailure };

/** Loads the target and applies the who-may-act-on-whom rule. */
async function loadTarget(db: Db, actor: Actor, targetId: number): Promise<Target> {
  const target = await usersRepo(db).findForMods(targetId);
  if (!target) return { ok: false, reason: "not_found" };
  if (!canActOn(actor, target)) return { ok: false, reason: "forbidden_target" };
  return { ok: true, target };
}

export async function banUser(
  db: Db,
  actor: Actor,
  targetId: number,
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  if (!(await usersRepo(db).ban(targetId, now))) return { ok: false, reason: "already_banned" };
  // A banned user's cookie is already refused by the session loader; the rows go too.
  await sessionsRepo(db).deleteAllForUser(targetId);
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.ban,
      targetType: "user",
      targetId,
      before: { bannedAt: null },
      reason,
    },
    now,
  );
  return { ok: true };
}

export async function unbanUser(
  db: Db,
  actor: Actor,
  targetId: number,
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  if (!(await usersRepo(db).unban(targetId))) return { ok: false, reason: "not_banned" };
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.unban,
      targetType: "user",
      targetId,
      before: { bannedAt: loaded.target.bannedAt },
      reason,
    },
    now,
  );
  return { ok: true };
}

/**
 * Releases a student ID key held by an account that should not have it: the key becomes a tombstone
 * (so the real owner can sign up) and the holder is banned. One logged action; an admin can reverse
 * it while nobody else has taken the key.
 */
export async function releaseKey(
  db: Db,
  actor: Actor,
  targetId: number,
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  const state = await usersRepo(db).findState(targetId);
  if (!state) return { ok: false, reason: "not_found" };
  if (state.studentKey.startsWith(RELEASED_KEY_PREFIX)) {
    return { ok: false, reason: "key_already_released" };
  }
  if (!(await usersRepo(db).releaseKey(targetId, state.studentKey, now))) {
    return { ok: false, reason: "conflict" };
  }
  await sessionsRepo(db).deleteAllForUser(targetId);
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.releaseKey,
      targetType: "user",
      targetId,
      before: { studentKey: state.studentKey, bannedAt: state.bannedAt },
      reason,
    },
    now,
  );
  return { ok: true };
}

/**
 * Issues a random temporary password and returns it once. The user is signed out everywhere and must
 * choose a new password at the next login. The snapshot has the flag only: the old hash is never kept,
 * so this cannot be reversed.
 */
export async function resetPassword(
  db: Db,
  actor: Actor,
  targetId: number,
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult<{ temporaryPassword: string }>> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  const temporaryPassword = generateTemporaryPassword();
  await usersRepo(db).setTemporaryPassword(targetId, await hashPassword(temporaryPassword));
  await sessionsRepo(db).deleteAllForUser(targetId);
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.resetPassword,
      targetType: "user",
      targetId,
      before: { mustChangePassword: loaded.target.mustChangePassword },
      reason,
    },
    now,
  );
  return { ok: true, temporaryPassword };
}

/** Promotes a student to mod or demotes a mod to student. The caller checks the actor is an admin. */
export async function changeRole(
  db: Db,
  actor: Actor,
  targetId: number,
  to: "mod" | "student",
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  const from = loaded.target.role;
  if (from === to) return { ok: false, reason: "role_unchanged" };
  if (!(await usersRepo(db).setRole(targetId, from, to))) return { ok: false, reason: "conflict" };
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.roleChange,
      targetType: "user",
      targetId,
      before: { role: from },
      reason,
    },
    now,
  );
  return { ok: true };
}

/**
 * Clears the probing flag and lifts any cooldown still running. The rejection count restarts too, so
 * the next rejection is the first again. The snapshot holds both user columns, so an admin can reverse
 * it (the restored flag and cooldown; the count is not brought back).
 */
export async function clearProbingFlag(
  db: Db,
  actor: Actor,
  targetId: number,
  reason: string,
  now: number = Date.now(),
): Promise<ActionResult> {
  const loaded = await loadTarget(db, actor, targetId);
  if (!loaded.ok) return loaded;
  const before = await usersRepo(db).probingState(targetId);
  if (!before || !(await usersRepo(db).clearProbing(targetId))) {
    return { ok: false, reason: "not_flagged" };
  }
  await rateLimitsRepo(db).reset(probingKey(targetId));
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.clearProbingFlag,
      targetType: "user",
      targetId,
      before,
      reason,
    },
    now,
  );
  return { ok: true };
}

/** Logs that a mod looked up a student ID key. The key itself is not written, only the holder's id. */
export async function logIdLookup(
  db: Db,
  actor: Actor,
  holderId: number,
  now: number = Date.now(),
): Promise<void> {
  await audit(
    db,
    { actor: actor.id, action: auditActions.idLookup, targetType: "user", targetId: holderId },
    now,
  );
}

export async function resolveReport(
  db: Db,
  actor: Actor,
  reportId: number,
  outcome: Exclude<ReportStatus, "open">,
  note: string | null,
  now: number = Date.now(),
): Promise<ActionResult<{ report: ReportRow }>> {
  const reports = reportsRepo(db);
  const report = await reports.resolve(reportId, outcome, actor.id, note, now);
  if (!report) {
    return {
      ok: false,
      reason: (await reports.findById(reportId)) ? "already_resolved" : "not_found",
    };
  }
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.resolveReport,
      targetType: "report",
      targetId: reportId,
      before: { status: "open" },
      reason: note ?? outcome,
    },
    now,
  );
  return { ok: true, report };
}
