import { Hono, type Context } from "hono";
import type { z } from "zod";
import {
  courseHideRequest,
  courseInput,
  coursePatch,
  type modCourse,
  type modCurriculum,
} from "../../../shared/schemas/modCourses";
import { NSU_PROGRAM_CODES } from "../../../shared/studentId";
import { getDb } from "../../db/client";
import type { AppEnv } from "../../middleware/types";
import { curriculaRepo, type CourseRow } from "../../repos/curricula";
import { validateJson } from "../../validate";
import { actorOf, paramId } from "../mod/respond";
import { addCourse, editCourse, setCourseHidden, type CourseResult } from "./modActions";

const STATUS: Record<string, 400 | 404 | 409> = {
  not_found: 404,
  already_hidden: 409,
  not_hidden: 409,
  code_taken: 409,
  code_referenced: 409,
  prereq_unknown: 400,
  invalid: 400,
};

const MESSAGES: Record<string, string> = {
  not_found: "That course does not exist.",
  already_hidden: "That course is already hidden.",
  not_hidden: "That course is not hidden.",
  invalid: "That course is not valid.",
};

const toModCourse = (c: CourseRow): z.infer<typeof modCourse> => ({
  id: c.id,
  curriculumId: c.curriculumId,
  kind: c.kind,
  code: c.code,
  title: c.title,
  credits: c.credits,
  category: c.category,
  nonCredit: c.nonCredit,
  semester: c.semester,
  alternatives: c.alternatives,
  prereq: c.prereq,
  hidden: c.hidden,
});

/** The JSON answer for a finished action: the slot, or the refusal with its stable code. */
function respond(c: Context, result: CourseResult, okStatus: 200 | 201 = 200) {
  if (result.ok) return c.json(toModCourse(result.row), okStatus);
  const { reason, message, codes } = result;
  const status = STATUS[reason] ?? 409;
  // 400 for a refused value is an invalid request like any other; the code tells the form which field.
  const error = reason === "invalid" ? "invalid_request" : reason;
  return c.json({ error, message: message ?? MESSAGES[reason], ...(codes && { codes }) }, status);
}

/**
 * Curriculum course management for mods and admins. Mounted under `/api/mod`, behind its role guard.
 * `/curricula` lists what is imported; `/courses/:id` edits one slot.
 */
export const courseModRoutes = new Hono<AppEnv>()
  .get("/curricula", async (c) => {
    const rows = await curriculaRepo(getDb(c.env.DB)).listWithCounts();
    return c.json(
      rows.map((r) => ({
        id: r.id,
        programCode: r.programCode,
        programName: NSU_PROGRAM_CODES[r.programCode] ?? r.name,
        name: r.name,
        version: r.version,
        effectiveFromYear: r.effectiveFromYear,
        courseCount: r.courseCount,
      })) satisfies z.infer<typeof modCurriculum>[],
    );
  })
  .get("/curricula/:id/courses", async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const repo = curriculaRepo(getDb(c.env.DB));
    if (!(await repo.findById(id))) return c.json({ error: "not_found" }, 404);
    return c.json((await repo.listCourses(id)).map(toModCourse));
  })
  .post("/curricula/:id/courses", validateJson(courseInput), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    return respond(c, await addCourse(getDb(c.env.DB), actorOf(c), id, c.req.valid("json")), 201);
  })
  .patch("/courses/:id", validateJson(coursePatch), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    return respond(c, await editCourse(getDb(c.env.DB), actorOf(c), id, c.req.valid("json")));
  })
  .post("/courses/:id/hide", validateJson(courseHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const { reason } = c.req.valid("json");
    return respond(c, await setCourseHidden(getDb(c.env.DB), actorOf(c), id, true, reason));
  })
  .post("/courses/:id/unhide", validateJson(courseHideRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const { reason } = c.req.valid("json");
    return respond(c, await setCourseHidden(getDb(c.env.DB), actorOf(c), id, false, reason));
  });
