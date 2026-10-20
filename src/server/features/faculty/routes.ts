import { Hono } from "hono";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { facultyRepo } from "../../repos/faculty";

/**
 * The faculty list for the attempt picker: visible faculty only, by name. Read-only, for any signed-in
 * user. The browser may keep it for an hour; the client searches it locally.
 */
export const facultyRoutes = new Hono<AppEnv>().use(requireUser).get("/", async (c) => {
  const rows = await facultyRepo(getDb(c.env.DB)).listVisible();
  c.header("Cache-Control", `private, max-age=${limits.facultyListCacheSeconds}`);
  return c.json(rows);
});
