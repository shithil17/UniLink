import { env } from "cloudflare:workers";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "../db/client";
import { createTestSession, createTestUser } from "../test/factories";
import { requireRole, requireUser, requireUserAllowingPasswordChange } from "./auth";
import { SESSION_COOKIE, sessionLoader, setSessionCookie } from "./session";
import type { AppEnv } from "./types";

const db = () => getDb(env.DB);

const app = new Hono<AppEnv>()
  .use(sessionLoader)
  .get("/open", (c) => c.json({ user: c.get("user")?.username ?? null }))
  .get("/set-cookie", (c) => {
    setSessionCookie(c, "abc");
    return c.json({});
  })
  .get("/user", requireUser, (c) => c.json({ ok: true }))
  .get("/me", requireUserAllowingPasswordChange, (c) => c.json({ ok: true }))
  .get("/mod", requireRole("mod"), (c) => c.json({ ok: true }))
  .get("/admin", requireRole("admin"), (c) => c.json({ ok: true }));

const get = (path: string, token?: string) =>
  app.request(path, token ? { headers: { cookie: `${SESSION_COOKIE}=${token}` } } : {}, env);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sessions").run();
  await env.DB.prepare("DELETE FROM users").run();
});

describe("session loader", () => {
  it("loads the user for a valid token and stores only its hash", async () => {
    const user = await createTestUser(db());
    const token = await createTestSession(db(), user.id);
    const res = await get("/open", token);
    expect(await res.json()).toEqual({ user: user.username });
    const stored = await env.DB.prepare("SELECT token_hash FROM sessions").first<{
      token_hash: string;
    }>();
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token_hash).not.toBe(token);
  });

  it("treats no cookie, an unknown token and an expired session as signed out", async () => {
    const user = await createTestUser(db());
    const expired = await createTestSession(db(), user.id, {
      createdAt: Date.now() - 2000,
      expiresAt: Date.now() - 1000,
    });
    expect(await (await get("/open")).json()).toEqual({ user: null });
    expect(await (await get("/open", "nope")).json()).toEqual({ user: null });
    expect(await (await get("/open", expired)).json()).toEqual({ user: null });
    const left = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("refuses a banned user's session", async () => {
    const user = await createTestUser(db(), { bannedAt: Date.now() });
    const token = await createTestSession(db(), user.id);
    expect(await (await get("/open", token)).json()).toEqual({ user: null });
    expect((await get("/user", token)).status).toBe(401);
  });

  it("sets the cookie HttpOnly, Secure, SameSite=Lax", async () => {
    const cookie = (await get("/set-cookie")).headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=abc`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});

describe("requireUser", () => {
  it("answers 401 when signed out", async () => {
    expect((await get("/user")).status).toBe(401);
  });

  it("answers 403 password_change_required while the flag is set, except on opt-in routes", async () => {
    const user = await createTestUser(db(), { mustChangePassword: true });
    const token = await createTestSession(db(), user.id);
    const blocked = await get("/user", token);
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ error: "password_change_required" });
    expect((await get("/me", token)).status).toBe(200);
    expect((await get("/mod", token)).status).toBe(403);
  });
});

describe("requireRole", () => {
  it("gives students 403 on mod routes and mods 403 on admin routes", async () => {
    const student = await createTestSession(db(), (await createTestUser(db())).id);
    const mod = await createTestSession(db(), (await createTestUser(db(), { role: "mod" })).id);
    const admin = await createTestSession(db(), (await createTestUser(db(), { role: "admin" })).id);
    expect((await get("/mod")).status).toBe(401);
    expect((await get("/mod", student)).status).toBe(403);
    expect((await get("/mod", mod)).status).toBe(200);
    expect((await get("/admin", mod)).status).toBe(403);
    expect((await get("/mod", admin)).status).toBe(200);
    expect((await get("/admin", admin)).status).toBe(200);
  });
});
