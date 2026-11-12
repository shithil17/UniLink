import { auditActions } from "../../../shared/auditActions";
import type { AreaInput } from "../../../shared/schemas/areas";
import { audit } from "../../audit";
import type { Db } from "../../db/client";
import { areasRepo, type AreaRow, type AreaState } from "../../repos/areas";
import type { Actor } from "../mod/actions";

// Each action changes state, then writes its audit row with the before-snapshot a reversal needs.
// The snapshot holds only the columns the action changed. Nothing is ever deleted: rides keep pointing
// at a hidden area.

export type AreaFailure =
  | "not_found"
  | "invalid_parent"
  | "already_hidden"
  | "not_hidden"
  | "name_taken";
export type AreaResult = { ok: true; row: AreaRow } | { ok: false; reason: AreaFailure };

/** Lowercase kebab-case ASCII, "Old Dhaka / Sadarghat" becomes "old-dhaka-sadarghat". Empty for a name with no ASCII letter or digit. */
export const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/**
 * Adds a top-level area, or a sub-area when `parentId` is set. A sub-area's parent must be a top-level
 * area (one level only). The slug is set here and never changes: sub-areas are prefixed with their
 * parent's so two areas can share a name under different parents.
 */
export async function addArea(
  db: Db,
  actor: Actor,
  input: AreaInput,
  now: number = Date.now(),
): Promise<AreaResult> {
  const repo = areasRepo(db);
  let prefix = "";
  if (input.parentId !== undefined) {
    const parent = await repo.findById(input.parentId);
    if (!parent || parent.parentId !== null) return { ok: false, reason: "invalid_parent" };
    prefix = `${parent.slug}-`;
  }
  // A name with no ASCII letter or digit (Bangla, say) still needs a unique slug.
  const slug = `${prefix}${slugify(input.name) || String(now)}`;
  const fields = { name: input.name, parentId: input.parentId ?? null };
  let written = await repo.create({ slug, ...fields }, now);
  // A rename keeps its slug, so a new area can land on an old slug while its own name is free.
  if (!written.ok && written.conflict === "slug_taken") {
    written = await repo.create({ slug: `${slug}-${now}`, ...fields }, now);
  }
  if (!written.ok) return { ok: false, reason: "name_taken" };
  await audit(
    db,
    {
      actor: actor.id,
      action: auditActions.areaAdd,
      targetType: "area",
      targetId: written.row.id,
    },
    now,
  );
  return { ok: true, row: written.row };
}

export async function renameArea(
  db: Db,
  actor: Actor,
  id: number,
  name: string,
  now: number = Date.now(),
): Promise<AreaResult> {
  const repo = areasRepo(db);
  const current = await repo.findById(id);
  if (!current) return { ok: false, reason: "not_found" };
  const written = await repo.rename(id, name, now);
  if (!written) return { ok: false, reason: "not_found" };
  if (!written.ok) return { ok: false, reason: "name_taken" };
  const before: Partial<AreaState> = { name: current.name };
  await audit(
    db,
    { actor: actor.id, action: auditActions.areaRename, targetType: "area", targetId: id, before },
    now,
  );
  return { ok: true, row: written.row };
}

/** Hides or shows an area again. Rides that already use it keep it; new rides can't pick a hidden one. */
export async function setAreaHidden(
  db: Db,
  actor: Actor,
  id: number,
  hidden: boolean,
  reason: string,
  now: number = Date.now(),
): Promise<AreaResult> {
  const repo = areasRepo(db);
  const current = await repo.findById(id);
  if (!current) return { ok: false, reason: "not_found" };
  const row = await repo.setHidden(id, hidden, reason, now);
  if (!row) return { ok: false, reason: hidden ? "already_hidden" : "not_hidden" };
  const before: Partial<AreaState> = { hidden: current.hidden, hiddenReason: current.hiddenReason };
  await audit(
    db,
    {
      actor: actor.id,
      action: hidden ? auditActions.areaHide : auditActions.areaUnhide,
      targetType: "area",
      targetId: id,
      before,
      reason,
    },
    now,
  );
  return { ok: true, row };
}
