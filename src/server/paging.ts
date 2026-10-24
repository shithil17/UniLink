import { limits } from "./limits";

const CURSOR = /^[1-9]\d{0,15}$/;

/** The default and largest page size of a list, from `limits.ts`. */
export type PageSizes = { readonly defaultSize: number; readonly maxSize: number };

/**
 * The page size (capped) and decoded cursor of a list request, or null when the cursor is not valid.
 * A cursor is the id of the last row of the previous page.
 */
export function pageParams(
  query: { cursor?: string; limit?: number },
  sizes: PageSizes = limits.modPage,
): { size: number; cursor: number | null } | null {
  if (query.cursor !== undefined && !CURSOR.test(query.cursor)) return null;
  return {
    size: Math.min(query.limit ?? sizes.defaultSize, sizes.maxSize),
    cursor: query.cursor === undefined ? null : Number(query.cursor),
  };
}

/** Cuts a page fetched with `size + 1` rows: the extra row only says there is a next page. */
export function toPage<T extends { id: number }>(rows: T[], size: number) {
  const items = rows.slice(0, size);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > size && last ? String(last.id) : null };
}
