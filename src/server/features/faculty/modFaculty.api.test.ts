import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { getDb } from "../../db/client";
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

async function signedIn(role: "student" | "mod" | "admin") {
  const user = await createTestUser(db(), { role });
  return { user, token: await createTestSession(db(), user.id) };
}

type Row = {
  id: number;
  name: string;
  initials: string | null;
  designation: string;
  department: string;
  nsuPage: string | null;
  hidden: boolean;
};

const NEW = {
  name: "Sabbir Rahman",
  initials: "SfR1",
  designation: "Lecturer",
  department: "ECE",
  nsuPage: "https://ece.northsouth.edu/people/sabbir-rahman/",
};

/** The rows of a list page, whichever list answered. */
async function listed(path: string, token: string) {
  const res = await call("GET", path, token);
  expect(res.status).toBe(200);
  return ((await res.json()) as { items: Row[] }).items;
}

const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log ORDER BY id").all<{
    id: number;
    actor: string;
    action: string;
    target_type: string;
    target_id: string;
    before: string | null;
    reason: string | null;
  }>();

beforeEach(async () => {
  for (const table of ["audit_log", "attempts", "faculty", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

async function add(token: string, over: Record<string, unknown> = {}) {
  return call("POST", "/api/mod/faculty", token, { ...NEW, ...over });
}

describe("mod faculty routes", () => {
  it("answers 401 signed out and 403 to students on every route", async () => {
    const student = await signedIn("student");
    for (const [method, path] of [
      ["GET", "/api/mod/faculty"],
      ["POST", "/api/mod/faculty"],
      ["PATCH", "/api/mod/faculty/1"],
      ["POST", "/api/mod/faculty/1/hide"],
      ["POST", "/api/mod/faculty/1/unhide"],
    ] as const) {
      expect((await call(method, path, null, method === "GET" ? undefined : {})).status).toBe(401);
      expect(
        (await call(method, path, student.token, method === "GET" ? undefined : {})).status,
      ).toBe(403);
    }
  });

  it("adds a faculty member, audits it, and lists it for mods and students", async () => {
    const mod = await signedIn("mod");
    const res = await add(mod.token);
    expect(res.status).toBe(201);
    const row = (await res.json()) as Row;
    expect(row).toMatchObject({ ...NEW, hidden: false });

    expect(await listed("/api/mod/faculty", mod.token)).toHaveLength(1);
    const student = await signedIn("student");
    const visible = await listed("/api/faculty", student.token);
    expect(visible).toEqual([
      {
        id: row.id,
        name: NEW.name,
        initials: NEW.initials,
        designation: NEW.designation,
        department: "ECE",
      },
    ]);

    const log = (await auditRows()).results;
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actor: String(mod.user.id),
      action: "faculty_add",
      target_type: "faculty",
      target_id: String(row.id),
    });
  });

  it("treats empty initials and page as none, allows many without initials, and trims text", async () => {
    const mod = await signedIn("mod");
    const res = await add(mod.token, { name: "  Plain Name ", initials: "", nsuPage: "  " });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "Plain Name", initials: null, nsuPage: null });
    // Empty initials are no initials, so they never collide.
    expect((await add(mod.token, { name: "Other Plain", initials: "" })).status).toBe(201);
  });

  it("refuses duplicate initials without regard to case, in any department", async () => {
    const mod = await signedIn("mod");
    expect((await add(mod.token)).status).toBe(201);
    const dup = await add(mod.token, { name: "Someone Else", initials: "sfr1", department: "LAW" });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ error: "initials_taken" });
    expect((await auditRows()).results).toHaveLength(1);
  });

  it("refuses the same name twice in a department, but not across departments", async () => {
    const mod = await signedIn("mod");
    expect((await add(mod.token)).status).toBe(201);
    const dup = await add(mod.token, { initials: "NeW" });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toMatchObject({ error: "name_taken" });
    expect((await add(mod.token, { initials: "NeW", department: "LAW" })).status).toBe(201);
  });

  it("validates the fields", async () => {
    const mod = await signedIn("mod");
    for (const bad of [
      { name: "" },
      { initials: "A" },
      { initials: "TOOLONGX" },
      { initials: "a-b" },
      { designation: "" },
      { department: "XXX" },
      { nsuPage: "http://ece.northsouth.edu/people/x/" },
      { nsuPage: "https://evilnorthsouth.edu/x" },
      { nsuPage: "https://northsouth.edu.evil.com/x" },
      { nsuPage: "not a url" },
    ]) {
      expect((await add(mod.token, bad)).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await add(mod.token, { nsuPage: "https://northsouth.edu/people/x" })).status).toBe(201);
  });

  it("edits fields, logs only what changed, and reports conflicts", async () => {
    const mod = await signedIn("mod");
    const a = (await (await add(mod.token)).json()) as Row;
    const b = (await (
      await add(mod.token, { name: "Other Person", initials: "OtP" })
    ).json()) as Row;

    const res = await call("PATCH", `/api/mod/faculty/${a.id}`, mod.token, {
      designation: "Professor",
      initials: "",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ designation: "Professor", initials: null });
    const edit = (await auditRows()).results.at(-1)!;
    expect(edit.action).toBe("faculty_edit");
    expect(JSON.parse(edit.before!)).toEqual({ designation: "Lecturer", initials: "SfR1" });

    const taken = await call("PATCH", `/api/mod/faculty/${a.id}`, mod.token, { initials: "OTP" });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: "initials_taken" });
    const clash = await call("PATCH", `/api/mod/faculty/${b.id}`, mod.token, { name: NEW.name });
    expect(clash.status).toBe(409);
    expect(await clash.json()).toMatchObject({ error: "name_taken" });

    expect((await call("PATCH", `/api/mod/faculty/${a.id}`, mod.token, {})).status).toBe(400);
    expect(
      (await call("PATCH", "/api/mod/faculty/9999", mod.token, { name: "Nobody" })).status,
    ).toBe(404);
  });

  it("hides and shows again with a reason, keeping attempts and hiding from students", async () => {
    const mod = await signedIn("mod");
    const student = await signedIn("student");
    const row = (await (await add(mod.token)).json()) as Row;
    await env.DB.prepare(
      "INSERT INTO attempts (user_id, course_code, grade, faculty_id, created_at) VALUES (?, 'CSE115', 'B', ?, 0)",
    )
      .bind(student.user.id, row.id)
      .run();

    expect((await call("POST", `/api/mod/faculty/${row.id}/hide`, mod.token, {})).status).toBe(400);
    const hide = await call("POST", `/api/mod/faculty/${row.id}/hide`, mod.token, {
      reason: "Left the university",
    });
    expect(hide.status).toBe(200);
    expect(await hide.json()).toMatchObject({ hidden: true });
    expect(
      (await call("POST", `/api/mod/faculty/${row.id}/hide`, mod.token, { reason: "again" }))
        .status,
    ).toBe(409);

    expect(await listed("/api/faculty", student.token)).toEqual([]);
    expect(await listed("/api/mod/faculty", mod.token)).toEqual([]);
    expect((await listed("/api/mod/faculty?hidden=include", mod.token))[0]).toMatchObject({
      id: row.id,
      hidden: true,
    });
    expect(
      await env.DB.prepare("SELECT faculty_id FROM attempts").first<{ faculty_id: number }>(),
    ).toEqual({ faculty_id: row.id });

    const show = await call("POST", `/api/mod/faculty/${row.id}/unhide`, mod.token, {
      reason: "Back again",
    });
    expect(show.status).toBe(200);
    expect(await listed("/api/faculty", student.token)).toHaveLength(1);
    expect(
      (await call("POST", `/api/mod/faculty/${row.id}/unhide`, mod.token, { reason: "twice" }))
        .status,
    ).toBe(409);

    const log = (await auditRows()).results.slice(1);
    expect(log.map((r) => r.action)).toEqual(["faculty_hide", "faculty_unhide"]);
    expect(log.map((r) => r.reason)).toEqual(["Left the university", "Back again"]);
    expect(JSON.parse(log[0].before!)).toEqual({ hidden: false });
    expect(JSON.parse(log[1].before!)).toEqual({ hidden: true });
  });

  it("lets an admin reverse an edit and a hide, and refuses when the old value was taken", async () => {
    const mod = await signedIn("mod");
    const admin = await signedIn("admin");
    const a = (await (await add(mod.token)).json()) as Row;
    await call("PATCH", `/api/mod/faculty/${a.id}`, mod.token, { name: "Renamed Person" });
    await call("POST", `/api/mod/faculty/${a.id}/hide`, mod.token, { reason: "Test hide" });
    const [, edit, hide] = (await auditRows()).results;

    const undoHide = await call("POST", `/api/admin/audit/${hide.id}/reverse`, admin.token, {
      reason: "Hid the wrong person",
    });
    expect(undoHide.status).toBe(201);
    const undoEdit = await call("POST", `/api/admin/audit/${edit.id}/reverse`, admin.token, {
      reason: "Name was right",
    });
    expect(undoEdit.status).toBe(201);
    const now = await listed("/api/mod/faculty?hidden=include", mod.token);
    expect(now[0]).toMatchObject({ name: NEW.name, hidden: false });

    // Someone else takes the old name; reversing an edit that would bring it back is refused.
    await call("PATCH", `/api/mod/faculty/${a.id}`, mod.token, { name: "Second Name" });
    const second = (await auditRows()).results.at(-1)!;
    await add(mod.token, { initials: "Zzz" });
    const refused = await call("POST", `/api/admin/audit/${second.id}/reverse`, admin.token, {
      reason: "Try restoring",
    });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ error: "value_in_use" });
  });
});
