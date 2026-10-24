import { Hono } from "hono";
import type { z } from "zod";
import {
  facultyHideRequest,
  facultyInput,
  facultyPatch,
  modFacultyListQuery,
  type modFaculty,
  type modFacultyPage,
} from "../../../shared/schemas/faculty";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import type { AppEnv } from "../../middleware/types";
import { pageParams, toPage } from "../../paging";
import { facultyRepo, type FacultyRow } from "../../repos/faculty";
import { validateJson, validateQuery } from "../../validate";
import { actorOf, paramId } from "../mod/respond";
import { addFaculty, editFaculty, setFacultyHidden, type FacultyFailure } from "./actions";

const FAILURES: Record<FacultyFailure, { status: 404 | 409; message: string }> = {
  not_found: { status: 404, message: "That faculty member does not exist." },
  already_hidden: { status: 409, message: "That faculty member is already hidden." },
  not_hidden: { status: 409, message: "That faculty member is not hidden." },
  initials_taken: { status: 409, message: "Another faculty member already has these initials." },
  name_taken: {
    status: 409,
    message: "That name is already listed in this department.",
  },
};

const toModFaculty = (f: FacultyRow): z.infer<typeof modFaculty> => ({
  id: f.id,
  name: f.name,
  initials: f.initials,
  designation: f.designation,
  department: f.department as z.infer<typeof modFaculty>["department"],
  nsuPage: f.nsuPage,
  hidden: f.hidden,
});

/** Faculty management for mods and admins. Mounted under `/api/mod`, behind its role guard. */
export const facultyModRoutes = new Hono<AppEnv>()
  .get("/", validateQuery(modFacultyListQuery), async (c) => {
    const { cursor, limit, q, department, hidden } = c.req.valid("query");
    const params = pageParams({ cursor, limit }, limits.facultyPage);
    const rows =
      params &&
      (await facultyRepo(getDb(c.env.DB)).listPage({
        limit: params.size + 1,
        cursor: params.cursor,
        query: q,
        department,
        includeHidden: hidden === "include",
      }));
    if (!params || !rows) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const page = toPage(rows, params.size);
    return c.json({
      items: page.items.map(toModFaculty),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof modFacultyPage>);
  })
  .post("/", validateJson(facultyInput), async (c) => {
    const result = await addFaculty(getDb(c.env.DB), actorOf(c), c.req.valid("json"));
    if (result.ok) return c.json(toModFaculty(result.row), 201);
    const { status, message } = FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  })
  .patch("/:id", validateJson(facultyPatch), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const result = await editFaculty(getDb(c.env.DB), actorOf(c), id, c.req.valid("json"));
    if (result.ok) return c.json(toModFaculty(result.row));
    const { status, message } = FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  })
  .post("/:id/hide", validateJson(facultyHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const result = await setFacultyHidden(
      getDb(c.env.DB),
      actorOf(c),
      id,
      true,
      c.req.valid("json").reason,
    );
    if (result.ok) return c.json(toModFaculty(result.row));
    const { status, message } = FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  })
  .post("/:id/unhide", validateJson(facultyHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const result = await setFacultyHidden(
      getDb(c.env.DB),
      actorOf(c),
      id,
      false,
      c.req.valid("json").reason,
    );
    if (result.ok) return c.json(toModFaculty(result.row));
    const { status, message } = FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  });
