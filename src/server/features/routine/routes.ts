import { Hono, type Context } from "hono";
import {
  joinDays,
  minutesToTime,
  parseDays,
  timeToMinutes,
  type RoutineDay,
} from "../../../shared/routine";
import {
  routineInput,
  routineTermQuery,
  routineUpdate,
  type RoutineEntry,
} from "../../../shared/schemas/routine";
import { currentTerm, type Term } from "../../../shared/terms";
import { getDb, type Db } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { routineRepo, type RoutineRow } from "../../repos/routine";
import { validateJson, validateQuery } from "../../validate";
import { isKnownCourseCode, loadCurriculum } from "../courses/curriculum";

const toEntry = (r: RoutineRow): RoutineEntry => ({
  id: r.id,
  term: { year: r.termYear, season: r.termSeason },
  courseCode: r.courseCode,
  section: r.section,
  days: parseDays(r.days),
  start: minutesToTime(r.startMinutes),
  end: minutesToTime(r.endMinutes),
  room: r.room,
  initials: r.facultyInitials,
});

/** The signed-in user's id. `requireUser` runs first, so a missing user cannot happen. */
const userId = (c: Context<AppEnv>) => c.get("user")?.id ?? 0;

const notFound = (c: Context) => c.json({ error: "not_found" }, 404);

function paramId(c: Context): number | null {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

const termOf = (q: { year?: number; season?: Term["season"] }): Term =>
  q.year !== undefined && q.season !== undefined
    ? { year: q.year, season: q.season }
    : currentTerm();

/** One hit on the routine write limit, shared by every write. Null when within it. */
async function writeLimited(c: Context<AppEnv>, db: Db) {
  const hit = await rateLimit(
    db,
    `routine:user:${userId(c)}`,
    limits.routineWrites.limit,
    limits.routineWrites.windowMs,
  );
  return hit.allowed ? null : rateLimitedResponse(c, hit);
}

const unknownCourse = (c: Context) =>
  c.json(
    {
      error: "unknown_course",
      message: "That course is not in your curriculum or your own courses.",
    },
    400,
  );

const badTimes = (c: Context) =>
  c.json({ error: "invalid_request", message: "The class must end after it starts" }, 400);

/**
 * The routine is private: every repo call is bound to the signed-in student, and no route names
 * another user, so a mod or admin keeps their own routine but can never read a student's.
 * Overlapping classes are allowed; the client warns.
 */
export const routineRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validateQuery(routineTermQuery), async (c) => {
    const rows = await routineRepo(getDb(c.env.DB), userId(c)).listTerm(
      termOf(c.req.valid("query")),
    );
    return c.json(rows.map(toEntry));
  })
  .post("/", validateJson(routineInput), async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const limited = await writeLimited(c, db);
    if (limited) return limited;

    const term = body.term ?? currentTerm();
    const repo = routineRepo(db, userId(c));
    if ((await repo.countTerm(term)) >= limits.routineEntriesMax) {
      return c.json(
        {
          error: "routine_limit",
          message: `You can add at most ${limits.routineEntriesMax} classes to a term.`,
        },
        409,
      );
    }
    const loaded = await loadCurriculum(db, userId(c));
    if (!(await isKnownCourseCode(db, userId(c), loaded, body.courseCode))) {
      return unknownCourse(c);
    }
    const row = await repo.create({
      termYear: term.year,
      termSeason: term.season,
      courseCode: body.courseCode,
      section: body.section,
      days: joinDays(body.days),
      startMinutes: timeToMinutes(body.start) ?? 0,
      endMinutes: timeToMinutes(body.end) ?? 0,
      room: body.room ?? "",
      facultyInitials: body.initials ?? "",
      createdAt: Date.now(),
    });
    return c.json(toEntry(row), 201);
  })
  .patch("/:id", validateJson(routineUpdate), async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const patch = c.req.valid("json");
    const db = getDb(c.env.DB);
    const repo = routineRepo(db, userId(c));
    // Another user's entry is a 404, the same as one that does not exist.
    const current = await repo.findOwn(id);
    if (!current) return notFound(c);
    const limited = await writeLimited(c, db);
    if (limited) return limited;

    if (patch.courseCode !== undefined && patch.courseCode !== current.courseCode) {
      const loaded = await loadCurriculum(db, userId(c));
      if (!(await isKnownCourseCode(db, userId(c), loaded, patch.courseCode))) {
        return unknownCourse(c);
      }
    }
    // A new start or end is checked against the saved other half.
    const startMinutes = patch.start !== undefined ? timeToMinutes(patch.start) : null;
    const endMinutes = patch.end !== undefined ? timeToMinutes(patch.end) : null;
    const start = startMinutes ?? current.startMinutes;
    const end = endMinutes ?? current.endMinutes;
    if (end <= start) return badTimes(c);

    const row = await repo.update(id, {
      ...(patch.courseCode !== undefined && { courseCode: patch.courseCode }),
      ...(patch.section !== undefined && { section: patch.section }),
      ...(patch.days !== undefined && { days: joinDays(patch.days as RoutineDay[]) }),
      ...(startMinutes !== null && { startMinutes }),
      ...(endMinutes !== null && { endMinutes }),
      ...(patch.room !== undefined && { room: patch.room }),
      ...(patch.initials !== undefined && { facultyInitials: patch.initials }),
    });
    return row ? c.json(toEntry(row)) : notFound(c);
  })
  // Registered before "/:id" so it is never read as an id. Clears the whole term, the current one by default.
  .delete("/", validateQuery(routineTermQuery), async (c) => {
    const db = getDb(c.env.DB);
    const limited = await writeLimited(c, db);
    if (limited) return limited;
    const deleted = await routineRepo(db, userId(c)).clearTerm(termOf(c.req.valid("query")));
    return c.json({ deleted });
  })
  .delete("/:id", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const db = getDb(c.env.DB);
    const limited = await writeLimited(c, db);
    if (limited) return limited;
    if (!(await routineRepo(db, userId(c)).deleteOwn(id))) return notFound(c);
    return c.json({ ok: true });
  });
