import { Hono, type Context } from "hono";
import { attemptInput } from "../../../shared/schemas/attempts";
import type { Attempt } from "../../../shared/schemas/attempts";
import {
  curriculumImportEnvelope,
  studentCourseInput,
  studentCourseUpdate,
  type ImportResult,
  type StudentCourse,
} from "../../../shared/schemas/courses";
import { audit } from "../../audit";
import { getDb, type Db } from "../../db/client";
import { limits } from "../../limits";
import { requireRole, requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { attemptsRepo, type AttemptRow } from "../../repos/attempts";
import { curriculaRepo, type CourseRow, type CurriculumRow } from "../../repos/curricula";
import { studentCoursesRepo, type StudentCourseRow } from "../../repos/studentCourses";
import { usersRepo } from "../../repos/users";
import { validateJson } from "../../validate";
import { checkImportRows, toCurriculumHeader, toNewCourse } from "./importRows";
import {
  allCurriculumCodes,
  buildCourseMap,
  courseCodes,
  EMPTY_COURSE_MAP,
  pickCurriculum,
} from "./map";

type Loaded = { curriculum: CurriculumRow; courses: CourseRow[] };

/** The student's curriculum: their program (last two digits of the student ID suffix) and admission year. */
async function loadCurriculum(db: Db, userId: number): Promise<Loaded | null> {
  const user = await usersRepo(db).findById(userId);
  if (!user) return null;
  const repo = curriculaRepo(db);
  const curriculum = pickCurriculum(
    await repo.listByProgram(user.studentSuffix.slice(-2)),
    user.admissionYear,
  );
  return curriculum ? { curriculum, courses: await repo.listCourses(curriculum.id) } : null;
}

const toAttempt = (a: AttemptRow): Attempt => ({
  id: a.id,
  courseCode: a.courseCode,
  grade: a.grade as Attempt["grade"],
  term:
    a.termYear !== null && a.termSeason !== null
      ? { year: a.termYear, season: a.termSeason }
      : null,
  createdAt: a.createdAt,
});

const toStudentCourse = (s: StudentCourseRow): StudentCourse => ({
  id: s.id,
  code: s.code,
  title: s.title,
  credits: s.credits,
  category: s.category,
  excluded: s.excluded,
  createdAt: s.createdAt,
});

/** The signed-in user's id. `requireUser` runs first, so a missing user cannot happen. */
const userId = (c: Context<AppEnv>) => c.get("user")?.id ?? 0;

const notFound = (c: Context) => c.json({ error: "not_found" }, 404);

function paramId(c: Context): number | null {
  const n = Number(c.req.param("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const courseRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/map", async (c) => {
    const db = getDb(c.env.DB);
    const loaded = await loadCurriculum(db, userId(c));
    if (!loaded) return c.json(EMPTY_COURSE_MAP);
    return c.json(
      buildCourseMap({
        ...loaded,
        attempts: await attemptsRepo(db, userId(c)).listOwn(),
        studentCourses: await studentCoursesRepo(db, userId(c)).listOwn(),
      }),
    );
  })
  .post("/import", requireRole("mod"), validateJson(curriculumImportEnvelope), async (c) => {
    const body = c.req.valid("json");
    if (body.courses.length > limits.courseImportMaxRows) {
      return c.json(
        {
          error: "too_many_rows",
          message: `A curriculum file holds at most ${limits.courseImportMaxRows} rows.`,
        },
        400,
      );
    }
    const { accepted, rejected } = checkImportRows(body.courses);
    // Replacing the courses with nothing would wipe a good curriculum, so refuse instead.
    if (accepted.length === 0) {
      return c.json({ error: "no_valid_rows", message: "Every row was rejected.", rejected }, 422);
    }

    const db = getDb(c.env.DB);
    const repo = curriculaRepo(db);
    const previous = await repo.findByProgramVersion(body.program, body.version);
    const previousCount = previous ? await repo.countCourses(previous.id) : 0;
    const curriculum = await repo.upsert(toCurriculumHeader(body), Date.now());
    await repo.replaceCourses(curriculum.id, accepted.map(toNewCourse));
    await audit(db, {
      actor: userId(c),
      action: "curriculum.import",
      targetType: "curriculum",
      targetId: curriculum.id,
      before: previous
        ? {
            name: previous.name,
            effectiveFromYear: previous.effectiveFromYear,
            totalCredits: previous.totalCredits,
            courseCount: previousCount,
          }
        : undefined,
      reason: `program ${body.program} version ${body.version}: ${accepted.length} imported, ${rejected.length} rejected`,
    });
    return c.json({
      curriculumId: curriculum.id,
      imported: accepted.length,
      rejected,
    } satisfies ImportResult);
  });

export const attemptRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const rows = await attemptsRepo(getDb(c.env.DB), userId(c)).listOwn();
    return c.json(rows.map(toAttempt));
  })
  .post("/", validateJson(attemptInput), async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const hit = await rateLimit(
      db,
      `attempts:user:${userId(c)}`,
      limits.attemptWrites.limit,
      limits.attemptWrites.windowMs,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const loaded = await loadCurriculum(db, userId(c));
    const known = loaded ? courseCodes(loaded.courses) : new Set<string>();
    if (!known.has(body.courseCode)) {
      const own = await studentCoursesRepo(db, userId(c)).listOwn();
      if (!own.some((s) => s.code === body.courseCode)) {
        return c.json(
          {
            error: "unknown_course",
            message: "That course is not in your curriculum or your own courses.",
          },
          400,
        );
      }
    }
    const row = await attemptsRepo(db, userId(c)).create({
      courseCode: body.courseCode,
      grade: body.grade,
      termYear: body.term?.year ?? null,
      termSeason: body.term?.season ?? null,
      createdAt: Date.now(),
    });
    return c.json(toAttempt(row), 201);
  });

export const studentCourseRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", async (c) => {
    const rows = await studentCoursesRepo(getDb(c.env.DB), userId(c)).listOwn();
    return c.json(rows.map(toStudentCourse));
  })
  .post("/", validateJson(studentCourseInput), async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const repo = studentCoursesRepo(db, userId(c));

    const loaded = await loadCurriculum(db, userId(c));
    if (!loaded) {
      return c.json(
        { error: "no_curriculum", message: "There is no course map for your program yet." },
        400,
      );
    }
    if (!loaded.courses.some((r) => r.category === body.category)) {
      return c.json(
        { error: "unknown_category", message: "Pick a category from your course map." },
        400,
      );
    }
    const own = await repo.listOwn();
    if (own.length >= limits.studentCoursesMax) {
      return c.json(
        {
          error: "student_course_limit",
          message: `You can add at most ${limits.studentCoursesMax} courses.`,
        },
        409,
      );
    }
    const codeTaken = {
      error: "code_taken",
      message: "That code is already in your course map or your own courses.",
    };
    if (
      allCurriculumCodes(loaded.courses).has(body.code) ||
      own.some((s) => s.code === body.code)
    ) {
      return c.json(codeTaken, 409);
    }
    try {
      const row = await repo.create({ ...body, createdAt: Date.now() });
      return c.json(toStudentCourse(row), 201);
    } catch (err) {
      // Two adds racing past the check above hit the unique index (user, code).
      if (/UNIQUE constraint failed/i.test(String((err as Error).cause ?? err))) {
        return c.json(codeTaken, 409);
      }
      throw err;
    }
  })
  .patch("/:id", validateJson(studentCourseUpdate), async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const patch = c.req.valid("json");
    const db = getDb(c.env.DB);
    const repo = studentCoursesRepo(db, userId(c));
    if (!(await repo.findOwn(id))) return notFound(c);

    if (patch.category !== undefined) {
      const loaded = await loadCurriculum(db, userId(c));
      if (!loaded?.courses.some((r) => r.category === patch.category)) {
        return c.json(
          { error: "unknown_category", message: "Pick a category from your course map." },
          400,
        );
      }
    }
    const row = await repo.update(id, patch);
    return row ? c.json(toStudentCourse(row)) : notFound(c);
  })
  .delete("/:id", async (c) => {
    const id = paramId(c);
    if (id === null || !(await studentCoursesRepo(getDb(c.env.DB), userId(c)).deleteOwn(id))) {
      return notFound(c);
    }
    return c.json({ ok: true });
  });
