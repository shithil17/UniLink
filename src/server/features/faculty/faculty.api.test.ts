import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { SESSION_COOKIE } from "../../middleware/session";
import { createTestSession, createTestUser } from "../../test/factories";

beforeEach(async () => {
  for (const table of ["faculty", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("GET /api/faculty", () => {
  it("needs a signed-in user and lists the faculty by name", async () => {
    await env.DB.prepare(
      "INSERT INTO faculty (name, initials, designation) VALUES ('Zed Zee', 'ZZ', 'Lecturer'), ('Amy Ay', 'AA', 'Professor')",
    ).run();
    expect((await app.request("/api/faculty", {}, env)).status).toBe(401);

    const user = await createTestUser(getDb(env.DB));
    const token = await createTestSession(getDb(env.DB), user.id);
    const res = await app.request(
      "/api/faculty",
      { headers: { cookie: `${SESSION_COOKIE}=${token}` } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { id: expect.any(Number), name: "Amy Ay", initials: "AA", designation: "Professor" },
      { id: expect.any(Number), name: "Zed Zee", initials: "ZZ", designation: "Lecturer" },
    ]);
  });
});
