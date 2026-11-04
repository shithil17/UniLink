import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
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
  courses: [course("CSE115"), course("CSE173")],
};

const putTarget = (token: string | null, targetCgpa: unknown) =>
  call("PUT", "/api/attempts/target", token, { targetCgpa });
const getTarget = (token: string | null) => call("GET", "/api/attempts/target", token);

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
  const mod = await signedIn("mod");
  expect((await call("POST", "/api/courses/import", mod.token, curriculum)).status).toBe(200);
});

describe("/api/attempts/target", () => {
  it("needs a signed-in user", async () => {
    expect((await getTarget(null)).status).toBe(401);
    expect((await putTarget(null, 3.5)).status).toBe(401);
  });

  it("is null until set, then the owner can set and read it", async () => {
    const { token } = await signedIn();
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: null });
    const res = await putTarget(token, 3.5);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ targetCgpa: 3.5 });
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: 3.5 });
  });

  it("stores integer hundredths", async () => {
    const { user, token } = await signedIn();
    expect((await putTarget(token, 3.57)).status).toBe(200);
    const row = await env.DB.prepare("SELECT target_cgpa AS t FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ t: number }>();
    expect(row?.t).toBe(357);
  });

  it("replaces an earlier target", async () => {
    const { token } = await signedIn();
    await putTarget(token, 3.2);
    await putTarget(token, 3.8);
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: 3.8 });
  });

  it.each([0, -1, 4.01, 5, 3.555, "3.5", null])("refuses %j", async (value) => {
    const { token } = await signedIn();
    const res = await putTarget(token, value);
    expect(res.status).toBe(400);
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: null });
  });

  it("accepts the ends of the range when above the CGPA", async () => {
    const { token } = await signedIn();
    expect((await putTarget(token, 0.01)).status).toBe(200);
    expect((await putTarget(token, 4)).status).toBe(200);
  });

  it("refuses a target at or below the real CGPA", async () => {
    const { token } = await signedIn();
    // B (3.0) in CSE115 and A (4.0) in CSE173: CGPA 3.5.
    await call("POST", "/api/attempts", token, { courseCode: "CSE115", grade: "B" });
    await call("POST", "/api/attempts", token, { courseCode: "CSE173", grade: "A" });
    for (const target of [3.5, 3.49, 2]) {
      const res = await putTarget(token, target);
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "target_not_above_current" });
    }
    expect((await putTarget(token, 3.51)).status).toBe(200);
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: 3.51 });
  });

  it("never reads another user's target", async () => {
    const owner = await signedIn();
    const other = await signedIn();
    await putTarget(owner.token, 3.9);
    // Each user sees only their own; there is no route that names another user.
    expect(await (await getTarget(other.token)).json()).toEqual({ targetCgpa: null });
    expect((await getTarget(owner.token)).status).toBe(200);
    expect((await call("GET", `/api/attempts/target/${owner.user.id}`, other.token)).status).toBe(
      404,
    );
    expect(
      (await call("GET", `/api/attempts/target?userId=${owner.user.id}`, other.token)).status,
    ).toBe(200);
    expect(await (await getTarget(other.token)).json()).toEqual({ targetCgpa: null });
  });

  it("is not in any mod or admin read of users", async () => {
    const owner = await signedIn();
    await putTarget(owner.token, 3.9);
    for (const role of ["mod", "admin"] as const) {
      const viewer = await signedIn(role);
      const res = await call("GET", "/api/mod/users", viewer.token);
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain(owner.user.username);
      expect(text).not.toMatch(/target/i);
      expect(text).not.toContain("3.9");
    }
  });

  it("limits writes per user", async () => {
    const { user, token } = await signedIn();
    const { limit, windowMs } = limits.targetWrites;
    const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, ?)")
      .bind(`attempts-target:user:${user.id}`, windowStart, limit)
      .run();
    expect((await putTarget(token, 3.5)).status).toBe(429);
    expect(await (await getTarget(token)).json()).toEqual({ targetCgpa: null });
  });
});
