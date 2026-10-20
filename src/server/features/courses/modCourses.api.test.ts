import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { CourseMap } from "../../../shared/schemas/courses";
import type { ModCourse, ModCurriculum } from "../../../shared/schemas/modCourses";
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

async function signedIn(role: "student" | "mod" | "admin" = "student") {
  const user = await createTestUser(db(), { role, studentSuffix: "042", admissionYear: 22 });
  return { user, token: await createTestSession(db(), user.id) };
}

const row = (code: string, extra: Record<string, unknown> = {}) => ({
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

const CURRICULUM = {
  program: "42",
  name: "Test CSE",
  version: "2022",
  effectiveFromYear: 22,
  totalCredits: 12,
  courses: [
    row("CSE115"),
    row("CSE173", { prereq: { course: "CSE115" } }),
    row("CSE225", { prereq: { all: [{ course: "CSE173" }, { credits: 6 }] } }),
    row("ENG115", {
      category: "GED",
      alternatives: [{ code: "BEN205", title: "Bangla Language" }],
    }),
  ],
};

/** A mod imports the curriculum; returns its id. */
async function setup() {
  const mod = await signedIn("mod");
  const res = await call("POST", "/api/courses/import", mod.token, CURRICULUM);
  expect(res.status).toBe(200);
  const { curriculumId } = await res.json<{ curriculumId: number }>();
  return { mod, curriculumId };
}

const listCourses = async (token: string, curriculumId: number) =>
  (await (
    await call("GET", `/api/mod/curricula/${curriculumId}/courses`, token)
  ).json()) as ModCourse[];
const byCode = (rows: ModCourse[], code: string) => {
  const found = rows.find((r) => r.code === code);
  if (!found) throw new Error(`no course ${code}`);
  return found;
};
const add = (token: string, curriculumId: number, over: Record<string, unknown> = {}) =>
  call("POST", `/api/mod/curricula/${curriculumId}/courses`, token, {
    ...row("CSE311", { prereq: "" }),
    ...over,
  });
const patch = (token: string, id: number, body: Record<string, unknown>) =>
  call("PATCH", `/api/mod/courses/${id}`, token, body);
const getMap = async (token: string) =>
  (await (await call("GET", "/api/courses/map", token)).json()) as CourseMap;
const mapCodes = (map: CourseMap) => map.categories.flatMap((c) => c.slots.map((s) => s.code));

/** The course audit rows (the import in each test's setup writes its own row, which is left out). */
const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log WHERE target_type = 'course' ORDER BY id").all<{
    id: number;
    actor: string;
    action: string;
    target_type: string;
    target_id: string;
    before: string | null;
    reason: string | null;
  }>();

beforeEach(async () => {
  for (const table of [
    "audit_log",
    "attempts",
    "student_courses",
    "courses",
    "curricula",
    "sessions",
    "users",
    "rate_limits",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("mod course routes", () => {
  it("answers 401 signed out and 403 to students on every route", async () => {
    const student = await signedIn();
    for (const [method, path] of [
      ["GET", "/api/mod/curricula"],
      ["GET", "/api/mod/curricula/1/courses"],
      ["POST", "/api/mod/curricula/1/courses"],
      ["PATCH", "/api/mod/courses/1"],
      ["POST", "/api/mod/courses/1/hide"],
      ["POST", "/api/mod/courses/1/unhide"],
    ] as const) {
      const body = method === "GET" ? undefined : {};
      expect((await call(method, path, null, body)).status).toBe(401);
      expect((await call(method, path, student.token, body)).status).toBe(403);
    }
  });

  it("lists curricula with their course counts, and a curriculum's slots in order", async () => {
    const { mod, curriculumId } = await setup();
    const curricula = (await (
      await call("GET", "/api/mod/curricula", mod.token)
    ).json()) as ModCurriculum[];
    expect(curricula).toEqual([
      expect.objectContaining({
        id: curriculumId,
        programCode: "42",
        version: "2022",
        courseCount: 4,
      }),
    ]);
    const rows = await listCourses(mod.token, curriculumId);
    expect(rows.map((r) => r.code)).toEqual(["CSE115", "CSE173", "CSE225", "ENG115"]);
    expect(rows[3]).toMatchObject({ hidden: false, alternatives: [{ code: "BEN205" }] });
    expect((await call("GET", "/api/mod/curricula/9999/courses", mod.token)).status).toBe(404);
  });

  it("adds a course at the end, audits it, and students see it on their next load", async () => {
    const { mod, curriculumId } = await setup();
    const student = await signedIn();
    expect(mapCodes(await getMap(student.token))).not.toContain("CSE311");

    const res = await add(mod.token, curriculumId, {
      prereq: "CSE225 and 60 credits completed",
      credits: 1.5,
      title: "  Databases ",
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as ModCourse;
    expect(created).toMatchObject({
      code: "CSE311",
      title: "Databases",
      credits: 1.5,
      hidden: false,
      prereq: { all: [{ course: "CSE225" }, { credits: 60 }] },
    });

    const rows = await listCourses(mod.token, curriculumId);
    expect(rows.at(-1)?.code).toBe("CSE311");
    const map = await getMap(student.token);
    expect(mapCodes(map)).toContain("CSE311");
    expect(map.categories.find((c) => c.name === "Core")?.slots.at(-1)).toMatchObject({
      code: "CSE311",
      status: "locked",
    });

    const log = (await auditRows()).results.filter((r) => r.action === "course_add");
    expect(log).toEqual([
      expect.objectContaining({
        actor: String(mod.user.id),
        target_type: "course",
        target_id: String(created.id),
      }),
    ]);
  });

  it("refuses a code another course already uses, as its code or as an alternative", async () => {
    const { mod, curriculumId } = await setup();
    for (const code of ["CSE115", "BEN205"]) {
      const res = await add(mod.token, curriculumId, { code });
      expect(res.status).toBe(409);
      expect(await res.json()).toMatchObject({ error: "code_taken" });
    }
    expect((await listCourses(mod.token, curriculumId)).length).toBe(4);
  });

  it("refuses a prerequisite that names a course the curriculum does not have", async () => {
    const { mod, curriculumId } = await setup();
    const typo = await add(mod.token, curriculumId, { prereq: "CSE115 and CSE17" });
    expect(typo.status).toBe(400);
    expect(await typo.json()).toMatchObject({ error: "invalid_request" });

    const missing = await add(mod.token, curriculumId, { prereq: "CSE115 or CSE999" });
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({
      error: "prereq_unknown",
      codes: ["CSE999"],
      message: expect.stringContaining("CSE999"),
    });

    // A course cannot need itself, and an alternative code counts as part of the curriculum.
    expect((await add(mod.token, curriculumId, { prereq: "CSE311" })).status).toBe(400);
    expect((await add(mod.token, curriculumId, { prereq: "BEN205" })).status).toBe(201);
  });

  it("validates the shape: credits in halves, code pattern by kind, no alternatives on an elective", async () => {
    const { mod, curriculumId } = await setup();
    expect((await add(mod.token, curriculumId, { credits: 1.3 })).status).toBe(400);
    expect((await add(mod.token, curriculumId, { code: "nope" })).status).toBe(400);
    expect(
      (
        await add(mod.token, curriculumId, {
          kind: "elective",
          code: "ELECT1",
          alternatives: [{ code: "AAA101", title: "A" }],
        })
      ).status,
    ).toBe(400);
    const elective = await add(mod.token, curriculumId, { kind: "elective", code: "elect1" });
    expect(elective.status).toBe(201);
    expect(await elective.json()).toMatchObject({ kind: "elective", code: "ELECT1" });
  });

  it("edits only the fields given and writes a before-snapshot of just those", async () => {
    const { mod, curriculumId } = await setup();
    const rows = await listCourses(mod.token, curriculumId);
    const eng = byCode(rows, "ENG115");

    const res = await patch(mod.token, eng.id, {
      title: "Composition",
      alternatives: [
        { code: "BEN205", title: "Bangla Language" },
        { code: "ENG111", title: "Communication" },
      ],
      semester: null,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      title: "Composition",
      semester: null,
      credits: 3,
      alternatives: [{ code: "BEN205" }, { code: "ENG111" }],
    });
    const [edit] = (await auditRows()).results.filter((r) => r.action === "course_edit");
    expect(edit).toMatchObject({ target_type: "course", target_id: String(eng.id) });
    expect(JSON.parse(edit.before!)).toEqual({
      title: "ENG115 title",
      alternatives: [{ code: "BEN205", title: "Bangla Language" }],
      semester: 1,
    });
    expect((await patch(mod.token, eng.id, {})).status).toBe(400);
    expect((await patch(mod.token, 99999, { title: "x" })).status).toBe(404);
  });

  it("refuses an edit that would reuse a code, or strand another course's prerequisite", async () => {
    const { mod, curriculumId } = await setup();
    const rows = await listCourses(mod.token, curriculumId);

    const taken = await patch(mod.token, byCode(rows, "CSE225").id, { code: "BEN205" });
    expect(taken.status).toBe(409);
    expect(await taken.json()).toMatchObject({ error: "code_taken" });

    // CSE173 lists CSE115 as its prerequisite, so CSE115 cannot be renamed away.
    const referenced = await patch(mod.token, byCode(rows, "CSE115").id, { code: "CSE116" });
    expect(referenced.status).toBe(409);
    expect(await referenced.json()).toMatchObject({
      error: "code_referenced",
      message: expect.stringContaining("CSE173"),
    });

    // Renaming a course nothing depends on is fine, and the same code is not a conflict with itself.
    expect((await patch(mod.token, byCode(rows, "CSE225").id, { code: "CSE226" })).status).toBe(
      200,
    );
    expect((await patch(mod.token, byCode(rows, "CSE115").id, { code: "CSE115" })).status).toBe(
      200,
    );
    // The kind decides the code pattern.
    const wrongKind = await patch(mod.token, byCode(rows, "ENG115").id, { kind: "elective" });
    expect(wrongKind.status).toBe(400);
  });

  it("edits a prerequisite from text and rejects an unknown code", async () => {
    const { mod, curriculumId } = await setup();
    const rows = await listCourses(mod.token, curriculumId);
    const id = byCode(rows, "CSE225").id;
    const ok = await patch(mod.token, id, { prereq: "CSE115 or (CSE173 and 30 credits)" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      prereq: { any: [{ course: "CSE115" }, { all: [{ course: "CSE173" }, { credits: 30 }] }] },
    });
    expect((await patch(mod.token, id, { prereq: "CSE999" })).status).toBe(400);
    const cleared = await patch(mod.token, id, { prereq: "" });
    expect(await cleared.json()).toMatchObject({ prereq: null });
  });

  it("hides and shows a course with a reason, and the map follows", async () => {
    const { mod, curriculumId } = await setup();
    const student = await signedIn();
    const id = byCode(await listCourses(mod.token, curriculumId), "CSE225").id;

    expect(
      (await call("POST", `/api/mod/courses/${id}/hide`, mod.token, { reason: "x" })).status,
    ).toBe(400);
    const hide = await call("POST", `/api/mod/courses/${id}/hide`, mod.token, {
      reason: "Dropped from the curriculum",
    });
    expect(hide.status).toBe(200);
    expect(await hide.json()).toMatchObject({ code: "CSE225", hidden: true });
    expect(
      (await call("POST", `/api/mod/courses/${id}/hide`, mod.token, { reason: "again twice" }))
        .status,
    ).toBe(409);

    expect(mapCodes(await getMap(student.token))).not.toContain("CSE225");
    // Still listed for mods, flagged hidden.
    expect(byCode(await listCourses(mod.token, curriculumId), "CSE225").hidden).toBe(true);

    const show = await call("POST", `/api/mod/courses/${id}/unhide`, mod.token, {
      reason: "Hid the wrong one",
    });
    expect(show.status).toBe(200);
    expect(mapCodes(await getMap(student.token))).toContain("CSE225");
    expect(
      (await call("POST", `/api/mod/courses/${id}/unhide`, mod.token, { reason: "twice more" }))
        .status,
    ).toBe(409);

    const log = (await auditRows()).results;
    expect(log.map((r) => r.action)).toEqual(["course_hide", "course_unhide"]);
    expect(log.map((r) => r.reason)).toEqual(["Dropped from the curriculum", "Hid the wrong one"]);
    expect(JSON.parse(log[0].before!)).toEqual({ hidden: false });
    expect(JSON.parse(log[1].before!)).toEqual({ hidden: true });
  });

  it("hides a course from students without grades, but never from the map of one who has them", async () => {
    const { mod, curriculumId } = await setup();
    const taker = await signedIn();
    const other = await signedIn();
    const rows = await listCourses(mod.token, curriculumId);
    expect(
      (await call("POST", "/api/attempts", taker.token, { courseCode: "CSE115", grade: "A" }))
        .status,
    ).toBe(201);
    // A grade on an alternative keeps the whole slot in play.
    expect(
      (await call("POST", "/api/attempts", taker.token, { courseCode: "BEN205", grade: "B" }))
        .status,
    ).toBe(201);
    for (const code of ["CSE115", "ENG115"]) {
      await call("POST", `/api/mod/courses/${byCode(rows, code).id}/hide`, mod.token, {
        reason: "Hidden for the test",
      });
    }

    const kept = await getMap(taker.token);
    expect(mapCodes(kept)).toEqual(expect.arrayContaining(["CSE115", "ENG115"]));
    expect(kept.degree.earned).toBe(6);
    expect(kept.categories.flatMap((c) => c.slots).find((s) => s.code === "CSE173")?.status).toBe(
      "available",
    );
    // They can even add a retake; their grades also still count in the summary.
    const summary = await call("GET", "/api/attempts/summary", taker.token);
    expect(await summary.json()).toMatchObject({ earnedCredits: 6, gradedCredits: 6 });

    const fresh = await getMap(other.token);
    expect(mapCodes(fresh)).not.toContain("CSE115");
    expect(mapCodes(fresh)).not.toContain("ENG115");
    const refused = await call("POST", "/api/attempts", other.token, {
      courseCode: "BEN205",
      grade: "A",
    });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ error: "unknown_course" });
  });

  it("reports which code of a choice slot the student took", async () => {
    await setup();
    const student = await signedIn();
    const slotOf = async () =>
      (await getMap(student.token)).categories
        .flatMap((c) => c.slots)
        .find((x) => x.code === "ENG115")!;
    expect((await slotOf()).chosenCode).toBeNull();
    await call("POST", "/api/attempts", student.token, { courseCode: "BEN205", grade: "B" });
    expect(await slotOf()).toMatchObject({ chosenCode: "BEN205", filledBy: "BEN205" });
  });

  it("keeps a hidden code taken, so a student course cannot reuse it", async () => {
    const { mod, curriculumId } = await setup();
    const student = await signedIn();
    const id = byCode(await listCourses(mod.token, curriculumId), "CSE225").id;
    await call("POST", `/api/mod/courses/${id}/hide`, mod.token, { reason: "Hidden for the test" });
    const res = await call("POST", "/api/student-courses", student.token, {
      code: "CSE225",
      title: "Mine",
      credits: 3,
      category: "Core",
    });
    expect(res.status).toBe(409);
  });

  it("lets an admin reverse an edit and a hide, and refuses when the old code was taken", async () => {
    const { mod, curriculumId } = await setup();
    const admin = await signedIn("admin");
    const rows = await listCourses(mod.token, curriculumId);
    const id = byCode(rows, "CSE225").id;
    await patch(mod.token, id, { title: "Renamed", credits: 4 });
    await call("POST", `/api/mod/courses/${id}/hide`, mod.token, { reason: "Test hide" });
    const [edit, hide] = (await auditRows()).results;

    const undoHide = await call("POST", `/api/admin/audit/${hide.id}/reverse`, admin.token, {
      reason: "Hid the wrong one",
    });
    expect(undoHide.status).toBe(201);
    const undoEdit = await call("POST", `/api/admin/audit/${edit.id}/reverse`, admin.token, {
      reason: "It was right before",
    });
    expect(undoEdit.status).toBe(201);
    expect(byCode(await listCourses(mod.token, curriculumId), "CSE225")).toMatchObject({
      title: "CSE225 title",
      credits: 3,
      hidden: false,
    });

    // The code the edit replaced is taken by a new course; restoring it would clash.
    await patch(mod.token, id, { code: "CSE226" });
    const rename = (await auditRows()).results.at(-1)!;
    expect(rename.action).toBe("course_edit");
    await add(mod.token, curriculumId, { code: "CSE225" });
    const refused = await call("POST", `/api/admin/audit/${rename.id}/reverse`, admin.token, {
      reason: "Try restoring",
    });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ error: "value_in_use" });

    // The audit log names the course.
    const log = await call("GET", "/api/admin/audit?targetType=course", admin.token);
    const items = ((await log.json()) as { items: { targetLabel: string | null }[] }).items;
    expect(items.some((i) => i.targetLabel === "CSE226")).toBe(true);
  });

  it("is wiped by a re-import of the same version, as documented", async () => {
    const { mod, curriculumId } = await setup();
    const id = byCode(await listCourses(mod.token, curriculumId), "CSE225").id;
    await patch(mod.token, id, { title: "Edited" });
    await call("POST", `/api/mod/courses/${id}/hide`, mod.token, { reason: "Hidden for the test" });
    await call("POST", "/api/courses/import", mod.token, CURRICULUM);
    const after = await listCourses(mod.token, curriculumId);
    expect(byCode(after, "CSE225")).toMatchObject({ title: "CSE225 title", hidden: false });
  });
});
