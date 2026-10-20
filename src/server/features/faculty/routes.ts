import { Hono } from "hono";
import { getDb } from "../../db/client";
import { requireUser } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { facultyRepo } from "../../repos/faculty";

/** The faculty list for the attempt picker. Read-only, for any signed-in user. */
export const facultyRoutes = new Hono<AppEnv>().use(requireUser).get("/", async (c) => {
  const rows = await facultyRepo(getDb(c.env.DB)).list();
  return c.json(
    rows.map((f) => ({
      id: f.id,
      name: f.name,
      initials: f.initials,
      designation: f.designation,
    })),
  );
});
