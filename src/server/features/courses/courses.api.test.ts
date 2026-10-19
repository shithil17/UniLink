import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);

async function call(method: string, path: string, token: string | null, body?: unknown) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  return app.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

type Overrides = {
  role?: "student" | "mod" | "admin";
  studentSuffix?: string;
  admissionYear?: number;
};

async function signedIn(overrides: Overrides = {}) {
  const user = await createTestUser(db(), overrides);
  return { user, token: await createTestSession(db(), user.id) };
}

const course = (code: string, extra: Record<string, unknown> = {}) => ({
  kind: "course",
  code,
  title: `${code} title`,
  credits: 3,
  category: "Core",
  nonCredit: false,
  semester: 1,
  alternatives: [],
  prereq: null,
  ...extra,
});
const elective = (code: string, extra: Record<string, unknown> = {}) =>
  course(code, { kind: "elective", category: "Electives", semester: null, ...extra });
const pick = (code: string) =>
  course(code, {
    category: "Picks",
    alternatives: [
      { code: "AAA101", title: "A" },
      { code: "BBB101", title: "B" },
      { code: "CCC101", title: "C" },
    ],
  });

/** A small CSE-shaped curriculum: a prerequisite chain, alternatives, "choose any three" and two electives. */
function fixture(overrides: Record<string, unknown> = {}) {
  return {
    program: "42",
    name: "Test CSE",
    version: "2022",
    effectiveFromYear: 22,
    totalCredits: 12,
    courses: [
      course("CSE115"),
      course("CSE173", { prereq: { course: "CSE115" } }),
      course("CSE225", { prereq: { all: [{ course: "CSE173" }, { credits: 6 }] } }),
      course("MAT100", { nonCredit: true }),
      course("POL101", { category: "GED", alternatives: [{ code: "POL104", title: "Politics" }] }),
      pick("CHO101"),
      pick("CHO102"),
      pick("CHO103"),
      elective("ELECT1"),
      elective("ELECT2"),
    ],
    ...overrides,
  };
}

async function importFixture(token: string, body: unknown = fixture()) {
  const res = await call("POST", "/api/courses/import", token, body);
  expect(res.status).toBe(200);
  return res.json<{ curriculumId: number; imported: number }>();
}

const attempt = (token: string, courseCode: string, grade = "A") =>
  call("POST", "/api/attempts", token, { courseCode, grade });

async function getMap(token: string) {
  const res = await call("GET", "/api/courses/map", token);
  expect(res.status).toBe(200);
  return res.json<CourseMap>();
}

const slot = (map: CourseMap, code: string) => {
  const found = map.categories.flatMap((c) => c.slots).find((s) => s.code === code);
  if (!found) throw new Error(`no slot ${code}`);
  return found;
};

const addStudentCourse = (token: string, code: string, extra: Record<string, unknown> = {}) =>
  call("POST", "/api/student-courses", token, {
    code,
    title: `${code} title`,
    credits: 3,
    category: "Electives",
    ...extra,
  });

beforeEach(async () => {
  for (const table of [
    "attempts",
    "student_courses",
    "courses",
    "curricula",
    "sessions",
    "users",
    "rate_limits",
    "audit_log",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("POST /api/courses/import", () => {
  it("is for mods and admins only", async () => {
    const student = await signedIn();
    const mod = await signedIn({ role: "mod" });
    const admin = await signedIn({ role: "admin" });
    expect((await call("POST", "/api/courses/import", null, fixture())).status).toBe(401);
    expect((await call("POST", "/api/courses/import", student.token, fixture())).status).toBe(403);
    expect((await call("POST", "/api/courses/import", mod.token, fixture())).status).toBe(200);
    expect((await call("POST", "/api/courses/import", admin.token, fixture())).status).toBe(200);
  });

  it("imports good rows, reports bad ones with their index and reason, and writes an audit row", async () => {
    const mod = await signedIn({ role: "mod" });
    const body = fixture({
      courses: [
        course("CSE115"),
        course("cse173"), // 1: bad code
        course("CSE115"), // 2: duplicate
        course("CSE225", { credits: 1.3 }), // 3: not a multiple of 0.5
        course("CSE226", { prereq: { course: "CSE999" } }), // 4: prerequisite not in the file
        course("CSE227", { prereq: { course: "CSE226" } }), // 5: its prerequisite was rejected
        elective("ELECT1", { alternatives: [{ code: "POL104", title: "x" }] }), // 6
        elective("ELECT2"),
        course("POL101", { prereq: { any: [{ credits: 30 }, { course: "CSE115" }] } }),
        { nonsense: true }, // 9
      ],
    });
    const res = await call("POST", "/api/courses/import", mod.token, body);
    expect(res.status).toBe(200);
    const result = await res.json<{
      curriculumId: number;
      imported: number;
      rejected: { index: number; code: string | null; reason: string }[];
    }>();
    expect(result.imported).toBe(3);
    expect(result.rejected.map((r) => [r.index, r.code])).toEqual([
      [1, "cse173"],
      [2, "CSE115"],
      [3, "CSE225"],
      [4, "CSE226"],
      [5, "CSE227"],
      [6, "ELECT1"],
      [9, null],
    ]);
    expect(result.rejected[1].reason).toMatch(/duplicate/i);
    expect(result.rejected[2].reason).toMatch(/0\.5/);
    expect(result.rejected[3].reason).toMatch(/CSE999/);

    const rows = await env.DB.prepare("SELECT code FROM courses ORDER BY position").all<{
      code: string;
    }>();
    expect(rows.results.map((r) => r.code)).toEqual(["CSE115", "ELECT2", "POL101"]);
    const log = await env.DB.prepare("SELECT actor, action, target_id FROM audit_log").first();
    expect(log).toEqual({
      actor: String(mod.user.id),
      action: "curriculum.import",
      target_id: String(result.curriculumId),
    });
  });

  it("checks the header strictly", async () => {
    const mod = await signedIn({ role: "mod" });
    for (const bad of [
      fixture({ program: "99" }),
      fixture({ effectiveFromYear: 2022 }),
      fixture({ totalCredits: 0 }),
      fixture({ surprise: true }),
      { ...fixture(), version: undefined },
    ]) {
      expect((await call("POST", "/api/courses/import", mod.token, bad)).status).toBe(400);
    }
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM curricula").first<{ n: number }>())?.n,
    ).toBe(0);
  });

  it("re-importing the same program and version replaces its courses", async () => {
    const mod = await signedIn({ role: "mod" });
    const first = await importFixture(mod.token);
    const second = await importFixture(
      mod.token,
      fixture({ totalCredits: 99, courses: [course("CSE115"), course("CSE999")] }),
    );
    expect(second.curriculumId).toBe(first.curriculumId);
    const rows = await env.DB.prepare("SELECT code FROM courses ORDER BY position").all<{
      code: string;
    }>();
    expect(rows.results.map((r) => r.code)).toEqual(["CSE115", "CSE999"]);
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM curricula").first<{ n: number }>())?.n,
    ).toBe(1);
    expect(
      (await env.DB.prepare("SELECT total_credits AS t FROM curricula").first<{ t: number }>())?.t,
    ).toBe(99);
  });

  it("refuses a file with no valid row instead of wiping the curriculum, and caps the rows", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const none = await call(
      "POST",
      "/api/courses/import",
      mod.token,
      fixture({ courses: [{ x: 1 }] }),
    );
    expect(none.status).toBe(422);
    expect(
      (await env.DB.prepare("SELECT COUNT(*) AS n FROM courses").first<{ n: number }>())?.n,
    ).toBe(10);

    const big = Array.from({ length: limits.courseImportMaxRows + 1 }, () => ({}));
    expect(
      (await call("POST", "/api/courses/import", mod.token, fixture({ courses: big }))).status,
    ).toBe(400);
  });
});

describe("GET /api/courses/map", () => {
  it("answers with an empty state when the program has no curriculum", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token); // program 42 only
    const llb = await signedIn({ studentSuffix: "011" });
    expect(await getMap(llb.token)).toEqual({
      curriculum: null,
      degree: { required: 0, earned: 0 },
      categories: [],
      extras: [],
    });
    expect((await call("GET", "/api/courses/map", null)).status).toBe(401);
  });

  it("follows attempts: done, available and locked, with F, I and W not counting", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();

    let map = await getMap(token);
    expect(map.curriculum).toMatchObject({ programCode: "42", version: "2022" });
    expect(slot(map, "CSE115").status).toBe("available");
    expect(slot(map, "CSE173").status).toBe("locked");

    for (const grade of ["F", "I", "W"]) await attempt(token, "CSE115", grade);
    expect(slot(await getMap(token), "CSE115").status).toBe("available");

    await attempt(token, "CSE115", "D");
    map = await getMap(token);
    expect(slot(map, "CSE115").status).toBe("done");
    expect(slot(map, "CSE173").status).toBe("available");
    // CSE225 also needs 6 earned credits (a credits leaf).
    await attempt(token, "CSE173");
    expect(slot(await getMap(token), "CSE225").status).toBe("available");
  });

  it("a waiver makes a course done and earns its credits, and a real pass replaces it", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();

    await attempt(token, "CSE115", "WV");
    let map = await getMap(token);
    expect(slot(map, "CSE115")).toMatchObject({ status: "done", waived: true });
    expect(slot(map, "CSE173").status).toBe("available");
    expect(map.degree.earned).toBe(slot(map, "CSE115").credits);

    await attempt(token, "CSE115", "B");
    map = await getMap(token);
    expect(slot(map, "CSE115")).toMatchObject({ status: "done", waived: false });
    expect(map.degree.earned).toBe(slot(map, "CSE115").credits);
  });

  it("holds a credits leaf back until enough credits are earned", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(
      mod.token,
      fixture({
        courses: [
          course("CSE115"),
          course("CSE173"),
          course("CSE225", { prereq: { all: [{ course: "CSE173" }, { credits: 6 }] } }),
        ],
      }),
    );
    const { token } = await signedIn();
    await attempt(token, "CSE173");
    expect(slot(await getMap(token), "CSE225").status).toBe("locked");
    await attempt(token, "CSE115");
    expect(slot(await getMap(token), "CSE225").status).toBe("available");
  });

  it("an alternative fills the slot and says which code did", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    await attempt(token, "POL104");
    const pol = slot(await getMap(token), "POL101");
    expect(pol).toMatchObject({ status: "done", filledBy: "POL104" });
  });

  it("a passing attempt fills one slot, in order, for choose-any-three rows", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    await attempt(token, "BBB101");
    await attempt(token, "BBB101", "A"); // the same course twice is still one course
    await attempt(token, "AAA101");
    const map = await getMap(token);
    expect(slot(map, "CHO101")).toMatchObject({ status: "done", filledBy: "AAA101" });
    expect(slot(map, "CHO102")).toMatchObject({ status: "done", filledBy: "BBB101" });
    expect(slot(map, "CHO103")).toMatchObject({ status: "available", filledBy: null });
    expect(map.categories.find((c) => c.name === "Picks")).toMatchObject({
      required: 9,
      earned: 6,
    });
  });

  it("non-credit courses add no credits", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    await attempt(token, "MAT100");
    const map = await getMap(token);
    expect(slot(map, "MAT100").status).toBe("done");
    expect(map.degree.earned).toBe(0);
    expect(map.categories.find((c) => c.name === "Core")?.required).toBe(9);
  });

  it("follows the program code and the admission year", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token, fixture({ version: "old", name: "Old", effectiveFromYear: 18 }));
    await importFixture(mod.token, fixture({ version: "new", name: "New", effectiveFromYear: 22 }));
    await importFixture(
      mod.token,
      fixture({ program: "11", version: "llb", name: "LLB", effectiveFromYear: 10 }),
    );

    const versionFor = async (overrides: Overrides) =>
      (await getMap((await signedIn(overrides)).token)).curriculum?.version;
    expect(await versionFor({ admissionYear: 20 })).toBe("old");
    expect(await versionFor({ admissionYear: 22 })).toBe("new");
    expect(await versionFor({ admissionYear: 25 })).toBe("new");
    // Before every version: the oldest.
    expect(await versionFor({ admissionYear: 15 })).toBe("old");
    // Another program uses its own curriculum.
    expect(await versionFor({ studentSuffix: "011", admissionYear: 24 })).toBe("llb");
    // The verification digit in the suffix does not matter, only the last two digits.
    expect(await versionFor({ studentSuffix: "642", admissionYear: 24 })).toBe("new");
  });
});

describe("attempts", () => {
  it("rejects a course that is not in the curriculum or the student's courses", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    expect((await attempt(token, "EEE101")).status).toBe(400);
    // An elective placeholder is not a course.
    expect((await attempt(token, "ELECT1")).status).toBe(400);
    expect(
      (await call("POST", "/api/attempts", token, { courseCode: "CSE115", grade: "Z" })).status,
    ).toBe(400);
    const ok = await call("POST", "/api/attempts", token, {
      courseCode: "cse115",
      grade: "A-",
      term: { year: 2026, season: "fall" },
    });
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({
      courseCode: "CSE115",
      grade: "A-",
      term: { year: 2026, season: "fall" },
    });
  });

  it("rejects everything for a student whose program has no curriculum", async () => {
    const { token } = await signedIn({ studentSuffix: "011" });
    expect((await attempt(token, "CSE115")).status).toBe(400);
  });

  it("only ever shows the owner their own attempts, mods and admins included", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const alice = await signedIn();
    const bob = await signedIn();
    const admin = await signedIn({ role: "admin" });
    await attempt(alice.token, "CSE115");

    const list = async (token: string) =>
      (await (await call("GET", "/api/attempts", token)).json()) as unknown[];
    expect(await list(alice.token)).toHaveLength(1);
    expect(await list(bob.token)).toHaveLength(0);
    expect(await list(mod.token)).toHaveLength(0);
    expect(await list(admin.token)).toHaveLength(0);
    expect(slot(await getMap(bob.token), "CSE115").status).toBe("available");
  });
});

describe("student courses", () => {
  it("fill elective slots in the order added, then show as extra", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    for (const code of ["XYZ301", "XYZ302", "XYZ303"]) {
      expect((await addStudentCourse(token, code)).status).toBe(201);
    }
    const map = await getMap(token);
    expect(slot(map, "ELECT1").studentCourse?.code).toBe("XYZ301");
    expect(slot(map, "ELECT2").studentCourse?.code).toBe("XYZ302");
    expect(slot(map, "ELECT1").status).toBe("available");
    expect(map.extras.map((e) => e.code)).toEqual(["XYZ303"]);

    await attempt(token, "XYZ301");
    expect(slot(await getMap(token), "ELECT1").status).toBe("done");
  });

  it("totals can exceed the degree total, and an excluded course counts toward nothing", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    for (const code of ["CSE115", "CSE173", "CSE225", "POL101", "AAA101", "BBB101", "CCC101"]) {
      await attempt(token, code);
    }
    const extra = await (await addStudentCourse(token, "XYZ301")).json<{ id: number }>();
    await addStudentCourse(token, "XYZ302");
    await addStudentCourse(token, "XYZ303");
    for (const code of ["XYZ301", "XYZ302", "XYZ303"]) await attempt(token, code);

    let map = await getMap(token);
    expect(map.degree).toEqual({ required: 12, earned: 30 });
    expect(map.degree.earned).toBeGreaterThan(map.degree.required);
    expect(map.categories.find((c) => c.name === "Electives")).toMatchObject({
      required: 6,
      earned: 9,
    });
    expect(map.extras.map((e) => e.code)).toEqual(["XYZ303"]);

    // Excluding the third (extra) course takes its credits off every total.
    const third = map.extras[0];
    const patched = await call("PATCH", `/api/student-courses/${third.id}`, token, {
      excluded: true,
    });
    expect(patched.status).toBe(200);
    map = await getMap(token);
    expect(map.degree.earned).toBe(21 + 6);
    expect(map.categories.find((c) => c.name === "Electives")?.earned).toBe(6);
    expect(map.extras).toMatchObject([{ code: "XYZ303", excluded: true, done: true }]);

    // Excluding one that fills a slot frees the slot for nothing, and its credits go too.
    await call("PATCH", `/api/student-courses/${extra.id}`, token, { excluded: true });
    map = await getMap(token);
    expect(map.categories.find((c) => c.name === "Electives")?.earned).toBe(3);
    expect(slot(map, "ELECT1").studentCourse?.code).toBe("XYZ302");
  });

  it("an excluded course adds nothing to a credits prerequisite", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(
      mod.token,
      fixture({
        courses: [
          course("CSE115"),
          course("CSE225", { prereq: { credits: 3 } }),
          elective("ELECT1"),
        ],
      }),
    );
    const { token } = await signedIn();
    const added = await (await addStudentCourse(token, "XYZ301")).json<{ id: number }>();
    await attempt(token, "XYZ301");
    expect(slot(await getMap(token), "CSE225").status).toBe("available");
    await call("PATCH", `/api/student-courses/${added.id}`, token, { excluded: true });
    expect(slot(await getMap(token), "CSE225").status).toBe("locked");
  });

  it("refuses codes that clash, unknown categories, and anything past the cap", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { user, token } = await signedIn();
    expect((await addStudentCourse(token, "CSE115")).status).toBe(409);
    expect((await addStudentCourse(token, "POL104")).status).toBe(409);
    expect((await addStudentCourse(token, "XYZ301")).status).toBe(201);
    expect((await addStudentCourse(token, "xyz301")).status).toBe(409);
    expect((await addStudentCourse(token, "XYZ302", { category: "Nope" })).status).toBe(400);
    expect((await addStudentCourse(token, "XYZ302", { credits: 1.2 })).status).toBe(400);
    expect((await addStudentCourse(token, "XYZ302", { credits: 1.5 })).status).toBe(201);

    for (let i = 3; i <= limits.studentCoursesMax; i++) {
      await env.DB.prepare(
        "INSERT INTO student_courses (user_id, code, title, credits, category, created_at) VALUES (?, ?, 't', 3, 'Electives', ?)",
      )
        .bind(user.id, `FIL${String(i).padStart(3, "0")}`, i)
        .run();
    }
    expect((await addStudentCourse(token, "XYZ399")).status).toBe(409);
  });

  it("is private to its owner: another user's id is a 404", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const alice = await signedIn();
    const bob = await signedIn();
    const made = await (await addStudentCourse(alice.token, "XYZ301")).json<{ id: number }>();

    expect(
      (await call("PATCH", `/api/student-courses/${made.id}`, bob.token, { title: "mine" })).status,
    ).toBe(404);
    expect((await call("DELETE", `/api/student-courses/${made.id}`, bob.token)).status).toBe(404);
    expect(await (await call("GET", "/api/student-courses", bob.token)).json()).toEqual([]);
    expect(await (await call("GET", "/api/student-courses", mod.token)).json()).toEqual([]);
    // Bob cannot record an attempt against Alice's course either.
    expect((await attempt(bob.token, "XYZ301")).status).toBe(400);
    const still = await call("GET", "/api/student-courses", alice.token);
    expect(await still.json()).toHaveLength(1);
  });

  it("edits fields and deleting a course deletes its attempts", async () => {
    const mod = await signedIn({ role: "mod" });
    await importFixture(mod.token);
    const { token } = await signedIn();
    const made = await (await addStudentCourse(token, "XYZ301")).json<{ id: number }>();
    const edited = await call("PATCH", `/api/student-courses/${made.id}`, token, {
      title: "New",
      credits: 4.5,
    });
    expect(await edited.json()).toMatchObject({ code: "XYZ301", title: "New", credits: 4.5 });
    expect((await call("PATCH", `/api/student-courses/${made.id}`, token, {})).status).toBe(400);
    // An edit that leaves `excluded` out keeps it.
    await call("PATCH", `/api/student-courses/${made.id}`, token, { excluded: true });
    const kept = await call("PATCH", `/api/student-courses/${made.id}`, token, { title: "Newer" });
    expect(await kept.json()).toMatchObject({ title: "Newer", excluded: true });

    await attempt(token, "XYZ301");
    await attempt(token, "CSE115");
    expect((await call("DELETE", `/api/student-courses/${made.id}`, token)).status).toBe(200);
    const left = await (await call("GET", "/api/attempts", token)).json<{ courseCode: string }[]>();
    expect(left.map((a) => a.courseCode)).toEqual(["CSE115"]);
    expect((await call("DELETE", `/api/student-courses/${made.id}`, token)).status).toBe(404);
  });
});
