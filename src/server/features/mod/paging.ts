import { limits } from "../../limits";

const CURSOR = /^[1-9]\d{0,15}$/;

/** The page size (capped) and decoded cursor of a list request, or null when the cursor is not valid. */
export function pageParams(query: {
  cursor?: string;
  limit?: number;
}): { size: number; cursor: number | null } | null {
  if (query.cursor !== undefined && !CURSOR.test(query.cursor)) return null;
  return {
    size: Math.min(query.limit ?? limits.modPage.defaultSize, limits.modPage.maxSize),
    cursor: query.cursor === undefined ? null : Number(query.cursor),
  };
}

/** Cuts a page fetched with `size + 1` rows: the extra row only says there is a next page. */
export function toPage<T extends { id: number }>(rows: T[], size: number) {
  const items = rows.slice(0, size);
  const last = items.at(-1);
  return { items, nextCursor: rows.length > size && last ? String(last.id) : null };
}
