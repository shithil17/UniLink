import { auditActions } from "../../../shared/auditActions";
import type { FacultyInput, FacultyPatch } from "../../../shared/schemas/faculty";
import { audit } from "../../audit";
import type { Db } from "../../db/client";
import {
  facultyRepo,
  type FacultyConflict,
  type FacultyRow,
  type FacultyState,
} from "../../repos/faculty";
import type { Actor } from "../mod/actions";

// Each action changes state, then writes its audit row with the before-snapshot a reversal needs.
// The snapshot holds only the columns the action changed.

export type FacultyFailure = "not_found" | "already_hidden" | "not_hidden" | FacultyConflict;
export type FacultyResult = { ok: true; row: FacultyRow } | { ok: false; reason: FacultyFailure };

const STATE_KEYS = ["name", "initials", "designation", "department", "nsuPage", "hidden"] as const;

export async function addFaculty(
  db: Db,
  actor: Actor,
  input: FacultyInput,
  now: number = Date.now(),
): Promise<FacultyResult> {
  const written = await facultyRepo(db).create(input);
  if (!written.ok) return { ok: false, reason: written.conflict };
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.facultyAdd,
      targetType: "faculty",
      targetId: written.row.id,
    },
    now,
  );
  return { ok: true, row: written.row };
}

export async function editFaculty(
  db: Db,
  actor: Actor,
  id: number,
  patch: FacultyPatch,
  now: number = Date.now(),
): Promise<FacultyResult> {
  const repo = facultyRepo(db);
  const current = await repo.findById(id);
  if (!current) return { ok: false, reason: "not_found" };
  const written = await repo.update(id, patch);
  if (!written) return { ok: false, reason: "not_found" };
  if (!written.ok) return { ok: false, reason: written.conflict };
  const before: Partial<FacultyState> = {};
  for (const key of STATE_KEYS) {
    if (key in patch) Object.assign(before, { [key]: current[key] });
  }
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.facultyEdit,
      targetType: "faculty",
      targetId: id,
      before,
    },
    now,
  );
  return { ok: true, row: written.row };
}

/** Hides or shows a faculty member again. Nothing is deleted: attempts keep pointing at the row. */
export async function setFacultyHidden(
  db: Db,
  actor: Actor,
  id: number,
  hidden: boolean,
  reason: string,
  now: number = Date.now(),
): Promise<FacultyResult> {
  const repo = facultyRepo(db);
  const row = await repo.setHidden(id, hidden);
  if (!row) {
    const exists = await repo.exists(id);
    if (!exists) return { ok: false, reason: "not_found" };
    return { ok: false, reason: hidden ? "already_hidden" : "not_hidden" };
  }
  await audit(
    db,
    {
      actor: actor.id,
      action: hidden ? auditActions.facultyHide : auditActions.facultyUnhide,
      targetType: "faculty",
      targetId: id,
      before: { hidden: !hidden },
      reason,
    },
    now,
  );
  return { ok: true, row };
}
