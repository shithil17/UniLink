import { Hono, type Context } from "hono";
import { retakeRefusal } from "../../../shared/grading";
import {
  attemptInput,
  attemptListQuery,
  attemptUpdate,
  type Attempt,
} from "../../../shared/schemas/attempts";
import { getDb, type Db } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { attemptsRepo, type AttemptRow } from "../../repos/attempts";
import { facultyRepo } from "../../repos/faculty";
import { studentCoursesRepo } from "../../repos/studentCourses";
import { validateJson, validateQuery } from "../../validate";
import { isKnownCourseCode, loadCurriculum } from "../courses/curriculum";
import { buildCourseMap, EMPTY_COURSE_MAP } from "../courses/map";
import { buildCgpaSummary } from "./summary";

type FacultyLabels = Awaited<ReturnType<ReturnType<typeof facultyRepo>["labelsByIds"]>>;

/** Rows become responses with the faculty name looked up apart from the picker list, so a hidden faculty member still shows. */
async function toAttempts(db: Db, rows: readonly AttemptRow[]): Promise<Attempt[]> {
  const ids = [...new Set(rows.flatMap((a) => (a.facultyId === null ? [] : [a.facultyId])))];
  const labels = ids.length > 0 ? await facultyRepo(db).labelsByIds(ids) : new Map();
  return rows.map((a) => toAttempt(a, labels));
}

const toAttempt = (a: AttemptRow, labels: FacultyLabels): Attempt => ({
  id: a.id,
  courseCode: a.courseCode,
  grade: a.grade as Attempt["grade"],
  term:
    a.termYear !== null && a.termSeason !== null
      ? { year: a.termYear, season: a.termSeason }
      : null,
  facultyId: a.facultyId,
  faculty: (a.facultyId !== null && labels.get(a.facultyId)) || null,
  createdAt: a.createdAt,
});

/** The signed-in user's id. `requireUser` runs first, so a missing user cannot happen. */
const userId = (c: Context<AppEnv>) => c.get("user")?.id ?? 0;

const notFound = (c: Context) => c.json({ error: "not_found" }, 404);

function paramId(c: Context): number | null {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The 409 for a retake the policy refuses, or null when it is allowed. `others` are the course's other attempts. */
function retakeRefused(c: Context, courseCode: string, others: readonly AttemptRow[]) {
  const message = retakeRefusal(courseCode, others);
  return message ? c.json({ error: "retake_not_allowed", message }, 409) : null;
}

const facultyMissing = (c: Context) =>
  c.json({ error: "unknown_faculty", message: "Pick a faculty member from the list." }, 400);

/** One hit on the attempt write limit, shared by create, edit and delete. Null when within it. */
async function writeLimited(c: Context<AppEnv>, db: Db) {
  const hit = await rateLimit(
    db,
    `attempts:user:${userId(c)}`,
    limits.attemptWrites.limit,
    limits.attemptWrites.windowMs,
  );
  return hit.allowed ? null : rateLimitedResponse(c, hit);
}

const termColumns = (term: { year: number; season: "spring" | "summer" | "fall" } | null) => ({
  termYear: term?.year ?? null,
  termSeason: term?.season ?? null,
});

/**
 * Attempts are private: every repo call is bound to the signed-in user, and no route names another
 * user. Mods and admins get the same view as students: their own.
 */
export const attemptRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validateQuery(attemptListQuery), async (c) => {
    const { courseCode } = c.req.valid("query");
    const db = getDb(c.env.DB);
    const rows = await attemptsRepo(db, userId(c)).listOwn(courseCode);
    return c.json(await toAttempts(db, rows));
  })
  .get("/summary", async (c) => {
    const db = getDb(c.env.DB);
    const loaded = await loadCurriculum(db, userId(c));
    const own = await attemptsRepo(db, userId(c)).listOwn();
    const map = loaded
      ? buildCourseMap({
          ...loaded,
          attempts: own,
          studentCourses: await studentCoursesRepo(db, userId(c)).listOwn(),
        })
      : EMPTY_COURSE_MAP;
    return c.json(buildCgpaSummary(map, own));
  })
  .post("/", validateJson(attemptInput), async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const limited = await writeLimited(c, db);
    if (limited) return limited;

    const loaded = await loadCurriculum(db, userId(c));
    if (!(await isKnownCourseCode(db, userId(c), loaded, body.courseCode))) {
      return c.json(
        {
          error: "unknown_course",
          message: "That course is not in your curriculum or your own courses.",
        },
        400,
      );
    }
    if (body.facultyId != null && !(await facultyRepo(db).exists(body.facultyId))) {
      return facultyMissing(c);
    }
    const repo = attemptsRepo(db, userId(c));
    const refused = retakeRefused(c, body.courseCode, await repo.listOwn(body.courseCode));
    if (refused) return refused;

    const row = await repo.create({
      courseCode: body.courseCode,
      grade: body.grade,
      ...termColumns(body.term ?? null),
      facultyId: body.facultyId ?? null,
      createdAt: Date.now(),
    });
    return c.json((await toAttempts(db, [row]))[0], 201);
  })
  .patch("/:id", validateJson(attemptUpdate), async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const patch = c.req.valid("json");
    const db = getDb(c.env.DB);
    const repo = attemptsRepo(db, userId(c));
    // Another user's attempt is a 404, the same as one that does not exist.
    const current = await repo.findOwn(id);
    if (!current) return notFound(c);
    const limited = await writeLimited(c, db);
    if (limited) return limited;

    if (patch.facultyId != null && !(await facultyRepo(db).exists(patch.facultyId))) {
      return facultyMissing(c);
    }
    // Only a new grade can change what is allowed, so fixing a term or faculty is never refused.
    if (patch.grade !== undefined && patch.grade !== current.grade) {
      const others = (await repo.listOwn(current.courseCode)).filter((a) => a.id !== id);
      const refused = retakeRefused(c, current.courseCode, others);
      if (refused) return refused;
    }
    const row = await repo.update(id, {
      ...(patch.grade !== undefined && { grade: patch.grade }),
      ...(patch.term !== undefined && termColumns(patch.term)),
      ...(patch.facultyId !== undefined && { facultyId: patch.facultyId }),
    });
    return row ? c.json((await toAttempts(db, [row]))[0]) : notFound(c);
  })
  .delete("/:id", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const db = getDb(c.env.DB);
    const limited = await writeLimited(c, db);
    if (limited) return limited;
    if (!(await attemptsRepo(db, userId(c)).deleteOwn(id))) return notFound(c);
    return c.json({ ok: true });
  });
