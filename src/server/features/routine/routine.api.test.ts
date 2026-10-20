import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { RoutineEntry } from "../../../shared/schemas/routine";
import { currentTerm } from "../../../shared/terms";
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
  totalCredits: 6,
  courses: [course("CSE115"), course("CSE173")],
};

const entry = (extra: Record<string, unknown> = {}) => ({
  courseCode: "CSE115",
  section: 3,
  days: ["M", "W"],
  start: "08:00",
  end: "09:30",
  room: "NAC 501",
  initials: "ABC",
  ...extra,
});

const add = (token: string, extra: Record<string, unknown> = {}) =>
  call("POST", "/api/routine", token, entry(extra));

const list = async (token: string, query = "") => {
  const res = await call("GET", `/api/routine${query}`, token);
  expect(res.status).toBe(200);
  return res.json<RoutineEntry[]>();
};

beforeEach(async () => {
  for (const table of [
    "routine_entries",
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
  const mod = await signedIn("mod");
  expect((await call("POST", "/api/courses/import", mod.token, curriculum)).status).toBe(200);
});

describe("routine", () => {
  it("adds, lists, edits and deletes an entry for its owner", async () => {
    const { token } = await signedIn();
    const created = await add(token);
    expect(created.status).toBe(201);
    const made = await created.json<RoutineEntry>();
    expect(made).toMatchObject({
      courseCode: "CSE115",
      section: 3,
      days: ["M", "W"],
      start: "08:00",
      end: "09:30",
      room: "NAC 501",
      initials: "ABC",
      term: currentTerm(),
    });

    expect(await list(token)).toHaveLength(1);

    const edited = await call("PATCH", `/api/routine/${made.id}`, token, {
      days: ["W", "S"],
      end: "10:00",
      room: "",
    });
    expect(edited.status).toBe(200);
    expect(await edited.json()).toMatchObject({ days: ["S", "W"], end: "10:00", room: "" });

    expect((await call("DELETE", `/api/routine/${made.id}`, token)).status).toBe(200);
    expect(await list(token)).toEqual([]);
  });

  it("saves overlapping classes without blocking", async () => {
    const { token } = await signedIn();
    expect((await add(token)).status).toBe(201);
    expect((await add(token, { courseCode: "CSE173", start: "09:00", end: "10:30" })).status).toBe(
      201,
    );
    expect(await list(token)).toHaveLength(2);
  });

  it("refuses an end that is not after the start, on create and on edit", async () => {
    const { token } = await signedIn();
    expect((await add(token, { start: "10:00", end: "10:00" })).status).toBe(400);
    const made = await (await add(token)).json<RoutineEntry>();
    const res = await call("PATCH", `/api/routine/${made.id}`, token, { end: "07:00" });
    expect(res.status).toBe(400);
    expect((await list(token))[0].end).toBe("09:30");
  });

  it("refuses a course that is not in the curriculum or the student's own courses", async () => {
    const { token } = await signedIn();
    expect((await add(token, { courseCode: "XYZ999" })).status).toBe(400);
  });

  it("keeps each term apart and lists the current term by default", async () => {
    const { token } = await signedIn();
    await add(token);
    await add(token, { term: { year: 2020, season: "spring" } });
    expect(await list(token)).toHaveLength(1);
    const old = await list(token, "?year=2020&season=spring");
    expect(old).toHaveLength(1);
    expect(old[0].term).toEqual({ year: 2020, season: "spring" });
    expect((await call("GET", "/api/routine?year=2020", token)).status).toBe(400);
  });

  it("stops at the per-term cap", async () => {
    const { user, token } = await signedIn();
    const term = currentTerm();
    const rows = Array.from({ length: limits.routineEntriesMax }, () =>
      env.DB.prepare(
        `INSERT INTO routine_entries (user_id, term_year, term_season, course_code, section, days, start_minutes, end_minutes, created_at)
         VALUES (?, ?, ?, 'CSE115', 1, 'M', 480, 540, 0)`,
      ).bind(user.id, term.year, term.season),
    );
    await env.DB.batch(rows);
    expect((await add(token)).status).toBe(409);
  });
});

describe("clear term", () => {
  it("clears only the named term of the caller", async () => {
    const a = await signedIn();
    const b = await signedIn();
    await add(a.token);
    await add(a.token, { courseCode: "CSE173" });
    await add(a.token, { term: { year: 2020, season: "fall" } });
    await add(b.token);

    const res = await call("DELETE", "/api/routine", a.token);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });

    expect(await list(a.token)).toEqual([]);
    expect(await list(a.token, "?year=2020&season=fall")).toHaveLength(1);
    expect(await list(b.token)).toHaveLength(1);

    const named = await call("DELETE", "/api/routine?year=2020&season=fall", a.token);
    expect(await named.json()).toEqual({ deleted: 1 });
  });
});

describe("owner only", () => {
  it("needs a signed-in user", async () => {
    expect((await call("GET", "/api/routine", null)).status).toBe(401);
  });

  it("lets a mod and an admin keep their own routine but never read or change a student's", async () => {
    const student = await signedIn();
    const made = await (await add(student.token)).json<RoutineEntry>();
    for (const role of ["mod", "admin"] as const) {
      const staff = await signedIn(role);
      // Their own routine works like a student's.
      expect((await add(staff.token)).status, `${role} adds`).toBe(201);
      expect(await list(staff.token), `${role} lists only their own`).toHaveLength(1);
      // The student's entry is not theirs: not found, and left untouched.
      expect(
        (await call("PATCH", `/api/routine/${made.id}`, staff.token, { room: "X" })).status,
      ).toBe(404);
      expect((await call("DELETE", `/api/routine/${made.id}`, staff.token)).status).toBe(404);
      // Clearing a term clears only the caller's own entries.
      expect(await (await call("DELETE", "/api/routine", staff.token)).json()).toEqual({
        deleted: 1,
      });
    }
    expect(await list(student.token)).toEqual([made]);
  });

  it("treats another student's entry as not found and leaves it untouched", async () => {
    const owner = await signedIn();
    const other = await signedIn();
    const made = await (await add(owner.token)).json<RoutineEntry>();

    expect(await list(other.token)).toEqual([]);
    expect(
      (await call("PATCH", `/api/routine/${made.id}`, other.token, { room: "X" })).status,
    ).toBe(404);
    expect((await call("DELETE", `/api/routine/${made.id}`, other.token)).status).toBe(404);
    expect((await list(owner.token))[0].room).toBe("NAC 501");
  });
});
