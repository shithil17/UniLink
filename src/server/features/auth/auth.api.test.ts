import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { limits } from "../../limits";
import { requireRole, requireUser } from "../../middleware/auth";
import { canPost } from "../../middleware/canPost";
import { hashPassword } from "../../password";
import { SESSION_COOKIE, sessionLoader } from "../../middleware/session";
import type { AppEnv } from "../../middleware/types";
import { dhakaYear } from "../../../shared/time";
import { authRoutes } from "./routes";

const PASSWORD = "correct horse";
// This year's admission year, so the IDs below stay valid as years pass.
const YY = String(dhakaYear() % 100);
let serial = 0;
let ipSerial = 0;

/** A valid, unique student ID (suffix 042). */
function nextStudentId() {
  serial += 1;
  return `${YY}11${String(serial).padStart(3, "0")}042`;
}

function cookieOf(res: Response): string | null {
  const m = new RegExp(`${SESSION_COOKIE}=([^;]*)`).exec(res.headers.get("set-cookie") ?? "");
  return m ? m[1] : null;
}

type Opts = { token?: string | null; ip?: string };

async function send(
  target: { request: typeof app.request },
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  opts: Opts = {},
) {
  const headers: Record<string, string> = { "CF-Connecting-IP": opts.ip ?? `10.0.0.${++ipSerial}` };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  return target.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
  );
}

const post = (path: string, body?: unknown, opts?: Opts) => send(app, "POST", path, body, opts);
const get = (path: string, opts?: Opts) => send(app, "GET", path, undefined, opts);

async function signup(overrides: Record<string, unknown> = {}, opts?: Opts) {
  serial += 1;
  const body = {
    username: `student${serial}`,
    fullName: `Student Number ${serial}`,
    email: `student.${serial}@northsouth.edu`,
    studentId: nextStudentId(),
    password: PASSWORD,
    ...overrides,
  };
  const res = await post("/api/auth/signup", body, opts);
  return { res, body, token: cookieOf(res) };
}

async function count(table: string) {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
  return row?.n ?? 0;
}

beforeEach(async () => {
  for (const table of ["sessions", "users", "rate_limits", "audit_log"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("POST /api/auth/signup", () => {
  it("creates the user, signs them in and answers with the me shape only", async () => {
    const { res, body } = await signup({ username: "  Alice_1 " });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      username: "alice_1",
      role: "student",
      admissionYear: Number(YY),
      mustChangePassword: false,
    });
    const row = await env.DB.prepare("SELECT username, student_key FROM users").first<{
      username: string;
      student_key: string;
    }>();
    expect(row?.username).toBe("alice_1");
    expect(row?.student_key).toBe(body.studentId.slice(0, 7));
  });

  it("stores the full name and NSU email, tidied, without returning them", async () => {
    const { res } = await signup({
      fullName: "  Rahim   Uddin ",
      email: " Rahim.Uddin.242@NorthSouth.edu ",
    });
    expect(res.status).toBe(201);
    expect(await res.text()).not.toMatch(/rahim/i);
    const row = await env.DB.prepare(
      "SELECT full_name, email, email_verified_at FROM users",
    ).first();
    expect(row).toEqual({
      full_name: "Rahim Uddin",
      email: "rahim.uddin.242@northsouth.edu",
      email_verified_at: null,
    });
  });

  it("rejects an email already registered, ignoring case", async () => {
    await signup({ email: "taken@northsouth.edu" });
    const { res } = await signup({ email: "Taken@NorthSouth.edu" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "email_registered",
      message: "This email is already registered. Contact a mod.",
    });
    expect(await count("users")).toBe(1);
  });

  it("sets an HttpOnly, Secure, SameSite=Lax cookie and stores only the token hash", async () => {
    const { res, token } = await signup();
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const stored = await env.DB.prepare("SELECT token_hash FROM sessions").first<{
      token_hash: string;
    }>();
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token_hash).not.toBe(token);
    expect(await count("sessions")).toBe(1);
  });

  it("rejects a duplicate 7-digit key with the generic message, however the ID is written", async () => {
    const first = await signup({ studentId: `${YY}1 1234 042` });
    expect(first.res.status).toBe(201);
    for (const studentId of [`${YY}11234042`, `${YY}1-1234-642`]) {
      const { res } = await signup({ studentId });
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({
        error: "student_id_registered",
        message: "This ID is already registered. Contact a mod.",
      });
    }
    expect(await count("users")).toBe(1);
  });

  it("lets only one of two simultaneous signups with the same key through", async () => {
    const studentId = nextStudentId();
    const results = await Promise.all([
      signup({ studentId }),
      signup({ studentId }),
      signup({ studentId }),
    ]);
    const statuses = results.map((r) => r.res.status).sort((a, b) => a - b);
    expect(statuses).toEqual([201, 409, 409]);
    expect(await count("users")).toBe(1);
  });

  it("rejects a duplicate username, ignoring case", async () => {
    await signup({ username: "dupe_name" });
    const { res } = await signup({ username: "DUPE_Name" });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "username_taken" });
    expect(await count("users")).toBe(1);
  });

  it("rejects invalid input", async () => {
    for (const bad of [
      { username: "ab" },
      { username: "has space" },
      { studentId: "1234567890" },
      { fullName: " " },
      { fullName: "x".repeat(81) },
      { email: "someone@gmail.com" },
      { email: "someone@northsouth.edu.evil.com" },
      { email: "someone@cse.northsouth.edu" },
      { email: "not-an-email" },
      // Next year's admission year and an unknown program code.
      { studentId: `${Number(YY) + 1}11234042` },
      { studentId: `${YY}11234099` },
      { password: "short" },
    ]) {
      const { res } = await signup(bad);
      expect(res.status).toBe(400);
    }
    expect(await count("users")).toBe(0);
  });

  it("is rate limited per IP before doing any work", async () => {
    const ip = "203.0.113.9";
    const { limit } = limits.signupPerIp;
    for (let i = 0; i < limit; i++) expect((await signup({}, { ip })).res.status).toBe(201);
    const { res } = await signup({}, { ip });
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another IP is unaffected.
    expect((await signup({}, { ip: "203.0.113.10" })).res.status).toBe(201);
    expect(await count("users")).toBe(limit + 1);
  });

  it("starts the new-account cooldown, so canPost refuses", async () => {
    await signup();
    const row = await env.DB.prepare("SELECT created_at FROM users").first<{
      created_at: number;
    }>();
    const check = canPost({ createdAt: row?.created_at ?? 0 });
    expect(check.ok).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with any casing of the username and sets the session cookie", async () => {
    const { body } = await signup({ username: "mixed_case" });
    const res = await post("/api/auth/login", { username: "MIXED_case", password: PASSWORD });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ username: body.username });
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly; Secure; SameSite=Lax");
    expect(await count("sessions")).toBe(2);
  });

  it("gives the same answer for a wrong password and an unknown username", async () => {
    const { body } = await signup();
    const wrong = await post("/api/auth/login", { username: body.username, password: "nope-nope" });
    const unknown = await post("/api/auth/login", {
      username: "ghost_user",
      password: "nope-nope",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrong.json()).toEqual(await unknown.json());
    expect(cookieOf(wrong)).toBeNull();
  });

  it("refuses a banned user and starts no session", async () => {
    const { body } = await signup();
    await env.DB.prepare("UPDATE users SET banned_at = ?").bind(Date.now()).run();
    const before = await count("sessions");
    const res = await post("/api/auth/login", { username: body.username, password: PASSWORD });
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: "account_banned" });
    expect(cookieOf(res)).toBeNull();
    expect(await count("sessions")).toBe(before);
  });

  it("does not reveal a ban to someone who has the wrong password", async () => {
    const { body } = await signup();
    await env.DB.prepare("UPDATE users SET banned_at = ?").bind(Date.now()).run();
    const res = await post("/api/auth/login", { username: body.username, password: "nope-nope" });
    expect(res.status).toBe(401);
    const unknown = await post("/api/auth/login", {
      username: "ghost_user",
      password: "nope-nope",
    });
    expect(await res.json()).toEqual(await unknown.json());
    expect(cookieOf(res)).toBeNull();
  });

  it("is rate limited per username", async () => {
    const credentials = { username: "target_user", password: "whatever-1" };
    const { limit } = limits.loginPerUsername;
    for (let i = 0; i < limit; i++) {
      expect((await post("/api/auth/login", credentials)).status).toBe(401);
    }
    const res = await post("/api/auth/login", credentials);
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    // Another username is unaffected.
    expect((await post("/api/auth/login", { ...credentials, username: "other_user" })).status).toBe(
      401,
    );
  });

  it("re-hashes a password stored with old settings", async () => {
    const { body } = await signup();
    // Store the password as an older, cheaper hash.
    const old = await hashPassword(PASSWORD, 1000);
    await env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = ?",
    )
      .bind(old.hash, old.salt, old.iterations)
      .run();
    const res = await post("/api/auth/login", { username: body.username, password: PASSWORD });
    expect(res.status).toBe(200);
    const row = await env.DB.prepare("SELECT password_iterations AS n FROM users").first<{
      n: number;
    }>();
    expect(row?.n).toBe(limits.pbkdf2Iterations);
  });
});

describe("signed-out access", () => {
  it.each([
    ["GET", "/api/auth/me", undefined],
    ["POST", "/api/auth/logout", undefined],
    [
      "POST",
      "/api/auth/change-password",
      { currentPassword: PASSWORD, newPassword: "a brand new one" },
    ],
  ] as const)("answers 401 on %s %s", async (method, path, body) => {
    expect((await send(app, method, path, body)).status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("never contains the student ID, key, suffix, full name or email", async () => {
    const { token, body } = await signup({ studentId: `${YY}1 7654 642` });
    const res = await get("/api/auth/me", { token });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(Object.keys(JSON.parse(text)).sort()).toEqual([
      "admissionYear",
      "mustChangePassword",
      "role",
      "username",
    ]);
    for (const secret of [
      `${YY}17654`,
      "642",
      "student_key",
      "studentId",
      String(body.studentId),
      body.fullName,
      body.email,
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("POST /api/auth/logout", () => {
  it("deletes the session row and clears the cookie", async () => {
    const { token } = await signup();
    expect(await count("sessions")).toBe(1);
    const res = await post("/api/auth/logout", undefined, { token });
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(`${SESSION_COOKIE}=;`);
    expect(await count("sessions")).toBe(0);
    expect((await get("/api/auth/me", { token })).status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  const NEW_PASSWORD = "a brand new one";

  it("deletes all the user's sessions, clears the flag and issues a fresh session", async () => {
    const { token, body } = await signup();
    // A second device and an unrelated user's session.
    const second = cookieOf(
      await post("/api/auth/login", { username: body.username, password: PASSWORD }),
    );
    const other = (await signup()).token;
    await env.DB.prepare("UPDATE users SET must_change_password = 1 WHERE username = ?")
      .bind(body.username)
      .run();

    const res = await post(
      "/api/auth/change-password",
      { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      { token },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ mustChangePassword: false });

    const fresh = cookieOf(res);
    expect(fresh).toMatch(/^[0-9a-f]{64}$/);
    expect(fresh).not.toBe(token);
    expect((await get("/api/auth/me", { token })).status).toBe(401);
    expect((await get("/api/auth/me", { token: second })).status).toBe(401);
    expect((await get("/api/auth/me", { token: fresh })).status).toBe(200);
    expect((await get("/api/auth/me", { token: other })).status).toBe(200);

    const flag = await env.DB.prepare(
      "SELECT must_change_password AS f FROM users WHERE username = ?",
    )
      .bind(body.username)
      .first<{ f: number }>();
    expect(flag?.f).toBe(0);
    expect(
      (await post("/api/auth/login", { username: body.username, password: PASSWORD })).status,
    ).toBe(401);
    expect(
      (await post("/api/auth/login", { username: body.username, password: NEW_PASSWORD })).status,
    ).toBe(200);
  });

  it("refuses a wrong current password and keeps the old one", async () => {
    const { token, body } = await signup();
    const res = await post(
      "/api/auth/change-password",
      { currentPassword: "not it at all", newPassword: NEW_PASSWORD },
      { token },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "wrong_password" });
    expect(
      (await post("/api/auth/login", { username: body.username, password: PASSWORD })).status,
    ).toBe(200);
  });

  // The strength rules are the shared `newPassword` schema, covered by the signup input table.
  it("refuses a new password equal to the current one", async () => {
    const { token } = await signup();
    const same = await post(
      "/api/auth/change-password",
      { currentPassword: PASSWORD, newPassword: PASSWORD },
      { token },
    );
    expect(same.status).toBe(400);
  });
});

describe("roles and the forced password change", () => {
  // The real app has no other routes yet, so mount probes behind the same session loader.
  const probe = new Hono<AppEnv>()
    .use(sessionLoader)
    .route("/auth", authRoutes)
    .get("/user", requireUser, (c) => c.json({ ok: true }))
    .get("/mod", requireRole("mod"), (c) => c.json({ ok: true }));
  const probeGet = (path: string, token: string | null) =>
    send(probe, "GET", path, undefined, { token });

  it("gives a student 403 on a mod route", async () => {
    const { token } = await signup();
    expect((await probeGet("/user", token)).status).toBe(200);
    const res = await probeGet("/mod", token);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
  });

  it("blocks every route but me, logout and change-password while the flag is set", async () => {
    const { token } = await signup();
    await env.DB.prepare("UPDATE users SET must_change_password = 1").run();

    const blocked = await probeGet("/user", token);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: "password_change_required" });
    expect((await probeGet("/mod", token)).status).toBe(403);

    const me = await probeGet("/auth/me", token);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ mustChangePassword: true });

    const changed = await send(
      probe,
      "POST",
      "/auth/change-password",
      { currentPassword: PASSWORD, newPassword: "something new 1" },
      { token },
    );
    expect(changed.status).toBe(200);
    expect((await probeGet("/user", cookieOf(changed))).status).toBe(200);
  });

  it("treats a banned user's existing session as signed out", async () => {
    const { token } = await signup();
    await env.DB.prepare("UPDATE users SET banned_at = ?").bind(Date.now()).run();
    expect((await get("/api/auth/me", { token })).status).toBe(401);
  });
});
