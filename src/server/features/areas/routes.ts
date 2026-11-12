import { Hono } from "hono";
import type { z } from "zod";
import type { areaList } from "../../../shared/schemas/areas";
import { getDb } from "../../db/client";
import { requireUser } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { areasRepo } from "../../repos/areas";

type Option = z.infer<typeof areaList>[number];

/**
 * The areas for ride pickers and filters: every visible top-level area in list order (Bashundhara
 * first), each with its visible sub-areas. One small list, so no paging. Read-only, for any signed-in
 * user. Cached privately for a minute: a hide or a new area shows up within it.
 */
export const areaRoutes = new Hono<AppEnv>().use(requireUser).get("/", async (c) => {
  const rows = await areasRepo(getDb(c.env.DB)).listVisible();
  const tops = new Map<number, Option>();
  for (const r of rows) {
    if (r.parentId === null) tops.set(r.id, { id: r.id, slug: r.slug, name: r.name, children: [] });
  }
  for (const r of rows) {
    if (r.parentId !== null) {
      tops.get(r.parentId)?.children.push({ id: r.id, slug: r.slug, name: r.name });
    }
  }
  c.header("Cache-Control", "private, max-age=60");
  return c.json([...tops.values()] satisfies z.infer<typeof areaList>);
});
