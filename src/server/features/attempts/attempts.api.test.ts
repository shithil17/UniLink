import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { Attempt, CgpaSummary } from "../../../shared/schemas/attempts";
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

async function signedIn(role: "student" | "mod" | "admin" = "student") {
  const user = await createTestUser(db(), { role });
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

const curriculum = {
  program: "42",
  name: "Test CSE",
  version: "2022",
  effectiveFromYear: 22,
  totalCredits: 12,
  courses: [
    course("CSE115"),
    course("CSE173"),
    course("CSE225", { category: "Major" }),
    course("MAT100", { nonCredit: true }),
    course("ELECT1", { kind: "elective", category: "Electives", semester: null }),
  ],
};

const create = (token: string, courseCode: string, grade: string, extra = {}) =>
  call("POST", "/api/attempts", token, { courseCode, grade, ...extra });

const summary = async (token: string) => {
  const res = await call("GET", "/api/attempts/summary", token);
  expect(res.status).toBe(200);
  return res.json<CgpaSummary>();
};

let facultyId: number;

beforeEach(async () => {
  for (const table of [
    "attempts",
    "student_courses",
    "courses",
    "curricula",
    "faculty",
    "sessions",
    "users",
    "rate_limits",
    "audit_log",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  const mod = await signedIn("mod");
  expect((await call("POST", "/api/courses/import", mod.token, curriculum)).status).toBe(200);
  await env.DB.prepare(
    "INSERT INTO faculty (name, initials, designation) VALUES ('Test Faculty', 'TF', 'Lecturer')",
  ).run();
  facultyId = (await env.DB.prepare("SELECT id FROM faculty").first<{ id: number }>())!.id;
});

describe("POST /api/attempts", () => {
  it("records an attempt with a term and a faculty member", async () => {
    const { token } = await signedIn();
    const res = await create(token, "CSE115", "B", {
      term: { year: 2024, season: "fall" },
      facultyId,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      courseCode: "CSE115",
      grade: "B",
      term: { year: 2024, season: "fall" },
      facultyId,
      faculty: { name: "Test Faculty", initials: "TF" },
    });
  });

  it("keeps the quick form working: no term and no faculty", async () => {
    const { token } = await signedIn();
    const res = await create(token, "CSE115", "B");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ term: null, facultyId: null });
  });

  it("refuses a faculty member that does not exist", async () => {
    const { token } = await signedIn();
    const res = await create(token, "CSE115", "B", { facultyId: facultyId + 100 });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_faculty" });
  });

  it("refuses a course outside the student's curriculum and their own courses", async () => {
    const { token } = await signedIn();
    expect((await create(token, "ZZZ999", "A")).status).toBe(400);
    expect((await create(token, "ELECT1", "A")).status).toBe(400);
  });

  it("allows retakes below B+ without limit, and says why one is refused", async () => {
    const { token } = await signedIn();
    for (const grade of ["F", "F", "D", "C", "B"]) {
      expect((await create(token, "CSE115", grade)).status).toBe(201);
    }
    expect((await create(token, "CSE115", "B+")).status).toBe(201);
    const refused = await create(token, "CSE115", "A");
    expect(refused.status).toBe(409);
    const body = await refused.json<{ error: string; message: string }>();
    expect(body.error).toBe("retake_not_allowed");
    expect(body.message).toMatch(/CSE115/);
    expect(body.message).toMatch(/B\+/);
    expect((await call("GET", "/api/attempts?courseCode=CSE115", token)).status).toBe(200);
    const kept = await (
      await call("GET", "/api/attempts?courseCode=CSE115", token)
    ).json<Attempt[]>();
    expect(kept).toHaveLength(6);
  });

  it("is blocked at A- and A too, but the retake rule is per course", async () => {
    const { token } = await signedIn();
    expect((await create(token, "CSE115", "A-")).status).toBe(201);
    expect((await create(token, "CSE115", "F")).status).toBe(409);
    expect((await create(token, "CSE173", "F")).status).toBe(201);
  });

  it("never lets I, W or a waiver block a retake", async () => {
    const { token } = await signedIn();
    for (const grade of ["I", "W", "WV", "C"]) {
      expect((await create(token, "CSE115", grade)).status).toBe(201);
    }
  });

  it("limits writes per user", async () => {
    const { user, token } = await signedIn();
    const { limit, windowMs } = limits.attemptWrites;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)")
      .bind(`attempts:user:${user.id}`, windowStart, limit)
      .run();
    expect((await create(token, "CSE115", "B")).status).toBe(429);
  });
});

describe("PATCH /api/attempts/:id", () => {
  async function make(token: string, courseCode: string, grade: string) {
    const res = await create(token, courseCode, grade);
    return (await res.json<Attempt>()).id;
  }

  it("changes the grade, term and faculty", async () => {
    const { token } = await signedIn();
    const id = await make(token, "CSE115", "C");
    const res = await call("PATCH", `/api/attempts/${id}`, token, {
      grade: "B",
      term: { year: 2023, season: "spring" },
      facultyId,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      grade: "B",
      term: { year: 2023, season: "spring" },
      facultyId,
    });
    const cleared = await call("PATCH", `/api/attempts/${id}`, token, {
      term: null,
      facultyId: null,
    });
    expect(await cleared.json()).toMatchObject({ grade: "B", term: null, facultyId: null });
  });

  it("checks the retake rule against the course's other attempts, not the one being edited", async () => {
    const { token } = await signedIn();
    const first = await make(token, "CSE115", "C");
    const second = await make(token, "CSE115", "D");
    // The best of the others is D: raising this one to A is fine.
    expect((await call("PATCH", `/api/attempts/${second}`, token, { grade: "A" })).status).toBe(
      200,
    );
    // The other is now an A, so a new grade on the first would be a retake of an A.
    const refused = await call("PATCH", `/api/attempts/${first}`, token, { grade: "B" });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ error: "retake_not_allowed" });
    // The refused edit changed nothing.
    const list = await (await call("GET", "/api/attempts", token)).json<Attempt[]>();
    expect(list.find((a) => a.id === first)?.grade).toBe("C");
  });

  it("does not refuse a term or faculty fix", async () => {
    const { token } = await signedIn();
    const first = await make(token, "CSE115", "C");
    await make(token, "CSE115", "A");
    const res = await call("PATCH", `/api/attempts/${first}`, token, {
      term: { year: 2022, season: "fall" },
      facultyId,
    });
    expect(res.status).toBe(200);
  });

  it("refuses an unknown faculty member and an empty edit", async () => {
    const { token } = await signedIn();
    const id = await make(token, "CSE115", "C");
    expect(
      (await call("PATCH", `/api/attempts/${id}`, token, { facultyId: facultyId + 100 })).status,
    ).toBe(400);
    expect((await call("PATCH", `/api/attempts/${id}`, token, {})).status).toBe(400);
  });
});

describe("DELETE /api/attempts/:id", () => {
  it("deletes the owner's attempt and then it is gone", async () => {
    const { token } = await signedIn();
    const { id } = await (await create(token, "CSE115", "A")).json<Attempt>();
    expect((await call("DELETE", `/api/attempts/${id}`, token)).status).toBe(200);
    expect((await call("DELETE", `/api/attempts/${id}`, token)).status).toBe(404);
    // Deleting the A makes a retake possible again.
    expect((await create(token, "CSE115", "B")).status).toBe(201);
  });
});

describe("privacy", () => {
  it("another user's attempt is a 404 to edit or delete, mods and admins included", async () => {
    const alice = await signedIn();
    const { id } = await (await create(alice.token, "CSE115", "C")).json<Attempt>();
    for (const other of [await signedIn(), await signedIn("mod"), await signedIn("admin")]) {
      expect((await call("PATCH", `/api/attempts/${id}`, other.token, { grade: "A" })).status).toBe(
        404,
      );
      expect((await call("DELETE", `/api/attempts/${id}`, other.token)).status).toBe(404);
    }
    const kept = await (await call("GET", "/api/attempts", alice.token)).json<Attempt[]>();
    expect(kept).toEqual([expect.objectContaining({ id, grade: "C" })]);
  });

  it("lists and summarises only the caller's own data", async () => {
    const alice = await signedIn();
    const mod = await signedIn("mod");
    await create(alice.token, "CSE115", "A");
    await create(mod.token, "CSE173", "B");

    expect(await (await call("GET", "/api/attempts", mod.token)).json<Attempt[]>()).toEqual([
      expect.objectContaining({ courseCode: "CSE173" }),
    ]);
    const modSummary = await summary(mod.token);
    expect(modSummary.cgpa).toBeCloseTo(3.0);
    expect(modSummary.gradedCredits).toBe(3);
    expect((await summary(alice.token)).cgpa).toBeCloseTo(4.0);
    // Nobody can name another user: a user id in the query is ignored.
    const spoof = await call("GET", `/api/attempts?userId=${alice.user.id}`, mod.token);
    expect(await spoof.json<Attempt[]>()).toEqual([
      expect.objectContaining({ courseCode: "CSE173" }),
    ]);
    const spoofSummary = await call(
      "GET",
      `/api/attempts/summary?userId=${alice.user.id}`,
      mod.token,
    );
    expect((await spoofSummary.json<CgpaSummary>()).cgpa).toBeCloseTo(3.0);
  });

  it("needs a signed-in user", async () => {
    expect((await call("GET", "/api/attempts", null)).status).toBe(401);
    expect((await call("GET", "/api/attempts/summary", null)).status).toBe(401);
    expect((await call("PATCH", "/api/attempts/1", null, { grade: "A" })).status).toBe(401);
    expect((await call("DELETE", "/api/attempts/1", null)).status).toBe(401);
  });
});

describe("GET /api/attempts/summary", () => {
  it("is empty for a student with nothing recorded", async () => {
    const { token } = await signedIn();
    expect(await summary(token)).toMatchObject({
      cgpa: null,
      gradedCredits: 0,
      earnedCredits: 0,
      requiredCredits: 12,
    });
  });

  it("matches a hand calculation: best grade, F, waiver, non-credit and remaining credits", async () => {
    const { token } = await signedIn();
    await create(token, "CSE115", "F");
    await create(token, "CSE115", "B"); // best B (3.0), earns 3
    await create(token, "CSE173", "F"); // F counts 0.0, earns nothing
    await create(token, "MAT100", "A"); // non-credit: nothing
    await create(token, "CSE225", "WV"); // waived: earns 3, no CGPA

    const s = await summary(token);
    // (3.0 * 3 + 0.0 * 3) / 6
    expect(s.cgpa).toBeCloseTo(1.5);
    expect(s.gradedCredits).toBe(6);
    expect(s.earnedCredits).toBe(6);
    expect(s.requiredCredits).toBe(12);
    expect(s.remainingCredits).toBe(6);
    expect(s.categories).toEqual([
      { name: "Core", required: 6, earned: 3, remaining: 3 },
      { name: "Major", required: 3, earned: 3, remaining: 0 },
      { name: "Electives", required: 3, earned: 0, remaining: 3 },
    ]);
  });

  it("counts an excluded student course toward nothing", async () => {
    const { token } = await signedIn();
    const added = await call("POST", "/api/student-courses", token, {
      code: "XYZ301",
      title: "Extra",
      credits: 3,
      category: "Electives",
    });
    const { id } = await added.json<{ id: number }>();
    await create(token, "CSE115", "A");
    await create(token, "XYZ301", "F");
    expect((await summary(token)).cgpa).toBeCloseTo(2.0);

    await call("PATCH", `/api/student-courses/${id}`, token, { excluded: true });
    const s = await summary(token);
    expect(s.cgpa).toBeCloseTo(4.0);
    expect(s.gradedCredits).toBe(3);
  });
});
