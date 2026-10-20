import { eq, or, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import type { Role } from "../middleware/types";

/** A post table with the moderation columns and an `author_id`. */
export type ModeratedTable = { status: SQLiteColumn; authorId: SQLiteColumn };

export type Viewer = { id: number; role: Role } | null;

/**
 * The one visibility filter for every post query: published posts are visible to everyone; a post
 * waiting for review or rejected is visible only to its author and to mods and admins. Returns
 * `undefined` for a mod (no filter), which `and()` and `.where()` ignore. Every feed, detail and
 * contact query on a post table goes through this.
 */
export function visibleTo(table: ModeratedTable, viewer: Viewer): SQL | undefined {
  if (viewer && (viewer.role === "mod" || viewer.role === "admin")) return undefined;
  const published = eq(table.status, "published");
  return viewer ? or(published, eq(table.authorId, viewer.id)) : published;
}
