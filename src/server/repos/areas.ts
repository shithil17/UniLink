import { and, asc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Db } from "../db/client";
import { areas } from "../db/schema";
import { limits } from "../limits";

export type AreaRow = typeof areas.$inferSelect;
/** The columns an edit or a hide changes: what a before-snapshot holds and a reversal puts back. */
export type AreaState = Pick<AreaRow, "name" | "hidden" | "hiddenReason">;

export type AreaConflict = "name_taken" | "slug_taken";
export type AreaWrite = { ok: true; row: AreaRow } | { ok: false; conflict: AreaConflict };

/** Which unique index a D1 error names, anywhere in its cause chain; null for any other error. */
export function areaConflictOf(err: unknown): AreaConflict | null {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if (e.message.includes("areas_top_name_idx") || e.message.includes("areas_sub_name_idx")) {
      return "name_taken";
    }
    if (e.message.includes("areas.slug")) return "slug_taken";
  }
  return null;
}

async function guarded(write: () => Promise<AreaRow | undefined>): Promise<AreaWrite | null> {
  try {
    const row = await write();
    return row ? { ok: true, row } : null;
  } catch (err) {
    const conflict = areaConflictOf(err);
    if (conflict) return { ok: false, conflict };
    throw err;
  }
}

const parent = alias(areas, "parent_area");

/** Pinned areas first (Bashundhara), then by name. */
const listOrder = [asc(areas.sortOrder), asc(areas.name), asc(areas.id)] as const;

/** Areas are public reference data, so these reads are not scoped to a user. */
export function areasRepo(db: Db) {
  return {
    /**
     * Every area a student may pick: not hidden, and not under a hidden parent. At most
     * `limits.areaListMax` rows, in list order; the caller groups sub-areas under their parents.
     */
    async listVisible(): Promise<AreaRow[]> {
      const rows = await db
        .select({ area: areas })
        .from(areas)
        .leftJoin(parent, eq(parent.id, areas.parentId))
        .where(and(eq(areas.hidden, false), or(isNull(areas.parentId), eq(parent.hidden, false))))
        .orderBy(...listOrder)
        .limit(limits.areaListMax)
        .all();
      return rows.map((r) => r.area);
    },
    /** Every area for the mod screen, hidden ones included, at most `limits.areaListMax`. */
    async listAll(): Promise<AreaRow[]> {
      return db
        .select()
        .from(areas)
        .orderBy(...listOrder)
        .limit(limits.areaListMax)
        .all();
    },
    async findById(id: number): Promise<AreaRow | null> {
      return (await db.select().from(areas).where(eq(areas.id, id)).get()) ?? null;
    },
    /** Names by id, hidden areas included, so the audit log can say which area an action was on. */
    async namesByIds(ids: readonly number[]): Promise<Map<number, string>> {
      const names = new Map<number, string>();
      for (let i = 0; i < ids.length; i += limits.d1MaxBoundParams) {
        const rows = await db
          .select({ id: areas.id, name: areas.name })
          .from(areas)
          .where(inArray(areas.id, ids.slice(i, i + limits.d1MaxBoundParams)))
          .all();
        for (const r of rows) names.set(r.id, r.name);
      }
      return names;
    },
    /** Which of `ids` a new or edited ride may use: the area is not hidden and its parent, if any, is not either. */
    async usableIds(ids: readonly number[]): Promise<Set<number>> {
      if (ids.length === 0) return new Set();
      const rows = await db
        .select({ id: areas.id })
        .from(areas)
        .leftJoin(parent, eq(parent.id, areas.parentId))
        .where(
          and(
            inArray(areas.id, [...ids]),
            eq(areas.hidden, false),
            or(isNull(areas.parentId), eq(parent.hidden, false)),
          ),
        )
        .all();
      return new Set(rows.map((r) => r.id));
    },
    /** Adds a visible area. A name taken among its siblings, or a slug taken, is a conflict. */
    async create(
      input: { slug: string; name: string; parentId: number | null },
      now: number,
    ): Promise<AreaWrite> {
      const written = await guarded(() =>
        db
          .insert(areas)
          .values({ ...input, createdAt: now, updatedAt: now })
          .returning()
          .get(),
      );
      if (!written) throw new Error("area insert returned no row");
      return written;
    },
    /** Null when the row does not exist. */
    async rename(id: number, name: string, now: number): Promise<AreaWrite | null> {
      return guarded(() =>
        db.update(areas).set({ name, updatedAt: now }).where(eq(areas.id, id)).returning().get(),
      );
    },
    /** Flips the flag and keeps or clears the reason. Null when the row is missing or already in that state. */
    async setHidden(
      id: number,
      hidden: boolean,
      reason: string | null,
      now: number,
    ): Promise<AreaRow | null> {
      return (
        (await db
          .update(areas)
          .set({ hidden, hiddenReason: hidden ? reason : null, updatedAt: now })
          .where(and(eq(areas.id, id), ne(areas.hidden, hidden)))
          .returning()
          .get()) ?? null
      );
    },
    /** The update that puts a snapshot back (not run here, so a reversal can batch it with its audit row). */
    restoreStatement(id: number, snapshot: Partial<AreaState>) {
      return db.update(areas).set(snapshot).where(eq(areas.id, id));
    },
  };
}
