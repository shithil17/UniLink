import { Hono } from "hono";
import type { z } from "zod";
import { facultyListQuery, type facultyOptionPage } from "../../../shared/schemas/faculty";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { pageParams, toPage } from "../../paging";
import { facultyRepo } from "../../repos/faculty";
import { validateQuery } from "../../validate";

/**
 * The faculty list for the attempt picker, a cursor page at a time: visible faculty only. `q` searches
 * names and initials across the whole directory and `department` narrows it. Read-only, for any
 * signed-in user. A name for an attempt that already has one comes with the attempt, not from here.
 */
export const facultyRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validateQuery(facultyListQuery), async (c) => {
    const { cursor, limit, q, department } = c.req.valid("query");
    const params = pageParams({ cursor, limit }, limits.facultyPage);
    if (!params) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const rows = await facultyRepo(getDb(c.env.DB)).listPage({
      limit: params.size + 1,
      cursor: params.cursor,
      query: q,
      department,
    });
    if (!rows) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const page = toPage(rows, params.size);
    return c.json({
      items: page.items.map((f) => ({
        id: f.id,
        name: f.name,
        initials: f.initials,
        designation: f.designation,
        department: f.department as z.infer<
          typeof facultyOptionPage
        >["items"][number]["department"],
      })),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof facultyOptionPage>);
  });
