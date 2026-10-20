import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { SESSION_COOKIE } from "../../middleware/session";
import { createTestSession, createTestUser } from "../../test/factories";

beforeEach(async () => {
  for (const table of ["attempts", "faculty", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

async function signedIn() {
  const user = await createTestUser(getDb(env.DB));
  return { user, token: await createTestSession(getDb(env.DB), user.id) };
}

const get = (path: string, token: string) =>
  app.request(path, { headers: { cookie: `${SESSION_COOKIE}=${token}` } }, env);

describe("GET /api/faculty", () => {
  it("needs a signed-in user and lists visible faculty by name with initials and department", async () => {
    await env.DB.prepare(
      "INSERT INTO faculty (name, initials, designation, department) VALUES ('Zed Zee', 'ZZ', 'Lecturer', 'ECE'), ('Amy Ay', 'AA', 'Professor', 'LAW'), ('Bob Bee', NULL, 'Lecturer', 'MGT')",
    ).run();
    expect((await app.request("/api/faculty", {}, env)).status).toBe(401);

    const { token } = await signedIn();
    const res = await get("/api/faculty", token);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(await res.json()).toEqual([
      {
        id: expect.any(Number),
        name: "Amy Ay",
        initials: "AA",
        designation: "Professor",
        department: "LAW",
      },
      {
        id: expect.any(Number),
        name: "Bob Bee",
        initials: null,
        designation: "Lecturer",
        department: "MGT",
      },
      {
        id: expect.any(Number),
        name: "Zed Zee",
        initials: "ZZ",
        designation: "Lecturer",
        department: "ECE",
      },
    ]);
  });

  it("leaves hidden faculty out of the list but not out of an attempt that names them", async () => {
    await env.DB.prepare(
      "INSERT INTO faculty (name, initials, designation, department, hidden) VALUES ('Shown One', 'SO', 'Lecturer', 'ECE', 0), ('Hidden One', 'HO', 'Lecturer', 'ECE', 1)",
    ).run();
    const hidden = (await env.DB.prepare("SELECT id FROM faculty WHERE hidden = 1").first<{
      id: number;
    }>())!.id;
    const { user, token } = await signedIn();
    await env.DB.prepare(
      "INSERT INTO attempts (user_id, course_code, grade, faculty_id, created_at) VALUES (?, 'CSE115', 'B', ?, 0)",
    )
      .bind(user.id, hidden)
      .run();

    const list = (await (await get("/api/faculty", token)).json()) as { name: string }[];
    expect(list.map((f) => f.name)).toEqual(["Shown One"]);

    const attempts = (await (await get("/api/attempts", token)).json()) as unknown[];
    expect(attempts).toEqual([
      expect.objectContaining({
        facultyId: hidden,
        faculty: { name: "Hidden One", initials: "HO" },
      }),
    ]);
  });
});
