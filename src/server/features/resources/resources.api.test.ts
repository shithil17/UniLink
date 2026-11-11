import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  MyResourceRequest,
  ResourceRequest,
  ResourceRequestDetail,
} from "../../../shared/schemas/resources";
import { app } from "../../app";
import { cronJobs, runCronJobs } from "../../cron";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { softDelete } from "../../softDelete";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

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

type Person = { id: number; token: string; username: string };

/** A student whose account is old enough to post. */
async function person(
  opts: { role?: "student" | "mod" | "admin"; fresh?: boolean; banned?: boolean } = {},
): Promise<Person> {
  const user = await createTestUser(db(), {
    role: opts.role ?? "student",
    createdAt: opts.fresh ? Date.now() : Date.now() - 2 * DAY,
    ...(opts.banned ? { bannedAt: Date.now() } : {}),
  });
  return { id: user.id, token: await createTestSession(db(), user.id), username: user.username };
}

const addAttempt = (userId: number, courseCode: string, facultyId: number | null = null) =>
  env.DB.prepare(
    "INSERT INTO attempts (user_id, course_code, grade, faculty_id, created_at) VALUES (?, ?, 'B', ?, ?)",
  )
    .bind(userId, courseCode, facultyId, Date.now())
    .run();

const addFaculty = async (name: string, initials: string) =>
  (await env.DB.prepare(
    "INSERT INTO faculty (name, initials, designation) VALUES (?, ?, 'Lecturer') RETURNING id",
  )
    .bind(name, initials)
    .first<{ id: number }>())!.id;

const inbox = async (userId: number) =>
  (
    await env.DB.prepare("SELECT type, payload FROM notifications WHERE user_id = ? ORDER BY id")
      .bind(userId)
      .all<{ type: string; payload: string }>()
  ).results;

const typesFor = async (userId: number) => (await inbox(userId)).map((n) => n.type);

const driveLink = "https://drive.google.com/file/d/abc123/view";

const requestBody = (extra: Record<string, unknown> = {}) => ({
  courseCode: "CSE115",
  expiresAt: Date.now() + 7 * DAY,
  ...extra,
});

async function makeRequest(who: Person, extra: Record<string, unknown> = {}) {
  const res = await call("POST", "/api/resources/requests", who.token, requestBody(extra));
  expect(res.status).toBe(201);
  return res.json<ResourceRequest>();
}

async function sendLink(who: Person, requestId: number, url = driveLink, note?: string) {
  return call("POST", `/api/resources/requests/${requestId}/submissions`, who.token, {
    url,
    ...(note ? { note } : {}),
  });
}

const stateOf = (id: number) =>
  env.DB.prepare("SELECT * FROM resource_requests WHERE id = ?")
    .bind(id)
    .first<{ fulfilled_at: number | null; accepted_submission_id: number | null }>();

const count = async (table: string) =>
  (await env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())!.n;

let faculty1: number;
let faculty2: number;

beforeEach(async () => {
  for (const table of [
    "resource_submissions",
    "resource_requests",
    "notifications",
    "reports",
    "attempts",
    "faculty",
    "sessions",
    "users",
    "rate_limits",
    "audit_log",
  ]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  faculty1 = await addFaculty("First Faculty", "FF");
  faculty2 = await addFaculty("Second Faculty", "SF");
});

describe("request fan-out", () => {
  it("tells students who took the course, and nobody else", async () => {
    const requester = await person();
    const took = await person();
    const tookOther = await person();
    const noAttempts = await person();
    await addAttempt(requester.id, "CSE115");
    await addAttempt(took.id, "CSE115");
    await addAttempt(tookOther.id, "CSE225");

    await makeRequest(requester);

    expect(await typesFor(took.id)).toEqual(["resource_requested"]);
    expect(await typesFor(tookOther.id)).toEqual([]);
    expect(await typesFor(noAttempts.id)).toEqual([]);
    // The requester is excluded even though they took the course.
    expect(await typesFor(requester.id)).toEqual([]);
  });

  it("tells students who were taught by the faculty member", async () => {
    const requester = await person();
    const taught = await person();
    const otherTeacher = await person();
    await addAttempt(taught.id, "CSE225", faculty1);
    await addAttempt(otherTeacher.id, "CSE225", faculty2);

    await makeRequest(requester, { courseCode: undefined, facultyId: faculty1 });

    expect(await typesFor(taught.id)).toEqual(["resource_requested"]);
    expect(await typesFor(otherTeacher.id)).toEqual([]);
  });

  it("with a course and a faculty, needs one attempt that matches both", async () => {
    const requester = await person();
    const both = await person();
    const splitAcrossAttempts = await person();
    const courseOnly = await person();
    await addAttempt(both.id, "CSE115", faculty1);
    await addAttempt(splitAcrossAttempts.id, "CSE115", faculty2);
    await addAttempt(splitAcrossAttempts.id, "CSE225", faculty1);
    await addAttempt(courseOnly.id, "CSE115");

    await makeRequest(requester, { facultyId: faculty1 });

    expect(await typesFor(both.id)).toEqual(["resource_requested"]);
    expect(await typesFor(splitAcrossAttempts.id)).toEqual([]);
    expect(await typesFor(courseOnly.id)).toEqual([]);
  });

  it("skips banned students and tells a student once however many attempts match", async () => {
    const requester = await person();
    const banned = await person({ banned: true });
    const retaker = await person();
    await addAttempt(banned.id, "CSE115");
    await addAttempt(retaker.id, "CSE115");
    await addAttempt(retaker.id, "CSE115");

    await makeRequest(requester);

    expect(await typesFor(banned.id)).toEqual([]);
    expect(await typesFor(retaker.id)).toEqual(["resource_requested"]);
  });

  it("puts only the request id in the notification", async () => {
    const requester = await person();
    const took = await person();
    await addAttempt(took.id, "CSE115");
    const request = await makeRequest(requester);

    const [note] = await inbox(took.id);
    expect(JSON.parse(note.payload)).toEqual({ requestId: request.id });
  });

  it("does not tell anyone about a request a moderator has not approved yet", async () => {
    const requester = await person();
    const mod = await person({ role: "mod" });
    const took = await person();
    await addAttempt(took.id, "CSE115");
    const held = await env.DB.prepare(
      "INSERT INTO resource_requests (author_id, course_code, expires_at, created_at) VALUES (?, 'CSE115', ?, ?) RETURNING id",
    )
      .bind(requester.id, Date.now() + DAY, Date.now())
      .first<{ id: number }>();
    expect(await typesFor(took.id)).toEqual([]);

    const res = await call(
      "POST",
      `/api/mod/posts/resource_request/${held!.id}/approve`,
      mod.token,
      {},
    );
    expect(res.status).toBe(200);

    // Approval runs the fan-out the screen would have: the matching student, and the requester hears the decision.
    expect(await typesFor(took.id)).toEqual(["resource_requested"]);
    expect(await typesFor(requester.id)).toEqual(["post_approved"]);
  });

  it("holds back a request whose note the screen rejects, and tells nobody", async () => {
    const requester = await person();
    const took = await person();
    await addAttempt(took.id, "CSE115");

    const res = await call("POST", "/api/resources/requests", requester.token, {
      ...requestBody(),
      note: "send it to my whatsapp, call 01712345678 or visit https://evil.example.com/buy",
    });
    expect(res.status).toBe(201);
    expect((await res.json<ResourceRequest>()).status).toBe("rejected");
    expect(await typesFor(took.id)).toEqual([]);
  });
});

describe("creating a request", () => {
  it("needs a course, a faculty, or both", async () => {
    const who = await person();
    const res = await call("POST", "/api/resources/requests", who.token, {
      expiresAt: Date.now() + DAY,
    });
    expect(res.status).toBe(400);
  });

  it("refuses an expiry that is too soon or too far away", async () => {
    const who = await person();
    for (const expiresAt of [
      Date.now() + limits.resourceExpiry.minMs / 2,
      Date.now() + limits.resourceExpiry.maxMs + DAY,
    ]) {
      const res = await call("POST", "/api/resources/requests", who.token, {
        ...requestBody(),
        expiresAt,
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        error: "invalid_expiry",
        message: "Pick an expiry between an hour and 60 days away.",
      });
    }
  });

  it("refuses a faculty member that does not exist", async () => {
    const who = await person();
    const res = await call(
      "POST",
      "/api/resources/requests",
      who.token,
      requestBody({ courseCode: undefined, facultyId: faculty2 + 100 }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_faculty" });
  });

  it("blocks a new account until the cooldown has passed", async () => {
    const fresh = await person({ fresh: true });
    const res = await call("POST", "/api/resources/requests", fresh.token, requestBody());
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "new_account" });
    expect(res.headers.get("Retry-After")).not.toBeNull();
    expect(await count("resource_requests")).toBe(0);
  });

  it("needs a signed-in user", async () => {
    expect((await call("POST", "/api/resources/requests", null, requestBody())).status).toBe(401);
  });

  it("applies the creation rate limit", async () => {
    const who = await person();
    for (let i = 0; i < limits.resourceRequestCreate.limit; i++) await makeRequest(who);
    const res = await call("POST", "/api/resources/requests", who.token, requestBody());
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "rate_limited" });
  });
});

describe("sending a link", () => {
  it("is refused for a new account", async () => {
    const requester = await person();
    const helper = await person({ fresh: true });
    const request = await makeRequest(requester);
    const res = await sendLink(helper, request.id);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "new_account" });
    expect(await count("resource_submissions")).toBe(0);
  });

  it("is refused for a link off the allowlist or on http", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    for (const url of [
      "https://drive.google.com.evil.io/file/d/abc",
      "http://drive.google.com/file/d/abc",
      "https://example.com/notes.pdf",
    ]) {
      expect((await sendLink(helper, request.id, url)).status).toBe(400);
    }
    expect(await count("resource_submissions")).toBe(0);
  });

  it("is refused for the requester's own request", async () => {
    const requester = await person();
    const request = await makeRequest(requester);
    const res = await sendLink(requester, request.id);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "own_request" });
  });

  it("tells the requester, once the link is screened in", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    const res = await sendLink(helper, request.id, driveLink, "Lecture notes, weeks 1 to 8");
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      status: "published",
      decision: "open",
      url: driveLink,
    });
    expect(await typesFor(requester.id)).toEqual(["resource_submitted"]);
    expect(JSON.parse((await inbox(requester.id))[0].payload)).toEqual({ requestId: request.id });
  });

  it("caps the links one student can send to a request", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    for (let i = 0; i < limits.resourceSubmissionsPerUser; i++) {
      expect((await sendLink(helper, request.id)).status).toBe(201);
    }
    const res = await sendLink(helper, request.id);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "too_many_links" });
  });

  it("is a 404 for a request still waiting for review", async () => {
    const requester = await person();
    const helper = await person();
    const held = await env.DB.prepare(
      "INSERT INTO resource_requests (author_id, course_code, expires_at, created_at) VALUES (?, 'CSE115', ?, ?) RETURNING id",
    )
      .bind(requester.id, Date.now() + DAY, Date.now())
      .first<{ id: number }>();
    expect((await sendLink(helper, held!.id)).status).toBe(404);
  });
});

describe("who sees the link", () => {
  it("shows the requester the link and the uploader, and nobody else", async () => {
    const requester = await person();
    const helper = await person();
    const other = await person();
    const request = await makeRequest(requester);
    expect((await sendLink(helper, request.id, driveLink, "my notes")).status).toBe(201);

    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    expect(mine.status).toBe(200);
    const { items } = await mine.json<{ items: MyResourceRequest[] }>();
    expect(items).toHaveLength(1);
    expect(items[0].submissions).toEqual([
      expect.objectContaining({
        url: driveLink,
        note: "my notes",
        uploader: helper.username,
        decision: "open",
      }),
    ]);

    // The detail view for another student never carries a link, theirs or anyone's.
    const asOther = await call("GET", `/api/resources/requests/${request.id}`, other.token);
    expect(asOther.status).toBe(200);
    const otherText = await asOther.text();
    expect(otherText).not.toContain("drive.google.com");
    expect(otherText).not.toContain(helper.username);
    expect(JSON.parse(otherText)).toMatchObject({ mine: false, mySubmissions: [] });

    // The uploader sees only their own link, with no other helper's.
    const asHelper = await call("GET", `/api/resources/requests/${request.id}`, helper.token);
    expect((await asHelper.json<ResourceRequestDetail>()).mySubmissions).toHaveLength(1);

    // Nobody else's "my requests" shows it.
    const otherMine = await call("GET", "/api/resources/requests/mine", other.token);
    expect((await otherMine.json<{ items: unknown[] }>()).items).toEqual([]);
    const helperMine = await call("GET", "/api/resources/requests/mine", helper.token);
    expect((await helperMine.json<{ items: unknown[] }>()).items).toEqual([]);
  });

  it("keeps a link that is still waiting for review from the requester", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    await env.DB.prepare(
      "INSERT INTO resource_submissions (request_id, author_id, url, created_at) VALUES (?, ?, ?, ?)",
    )
      .bind(request.id, helper.id, driveLink, Date.now())
      .run();

    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await mine.json<{ items: MyResourceRequest[] }>();
    expect(items[0].submissions).toEqual([]);
  });
});

describe("accepting and rejecting", () => {
  it("fulfils the request with one accepted link and tells its uploader", async () => {
    const requester = await person();
    const helper = await person();
    const second = await person();
    const request = await makeRequest(requester);
    const first = await (await sendLink(helper, request.id)).json<{ id: number }>();
    const other = await (await sendLink(second, request.id)).json<{ id: number }>();

    const res = await call(
      "POST",
      `/api/resources/submissions/${first.id}/accept`,
      requester.token,
    );
    expect(res.status).toBe(200);

    const row = await stateOf(request.id);
    expect(row?.fulfilled_at).not.toBeNull();
    expect(row?.accepted_submission_id).toBe(first.id);
    expect(await typesFor(helper.id)).toEqual(["resource_accepted"]);
    expect(await typesFor(second.id)).toEqual([]);

    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await mine.json<{ items: MyResourceRequest[] }>();
    expect(items[0]).toMatchObject({ state: "fulfilled" });
    expect(items[0].submissions.map((s) => [s.id, s.decision])).toEqual([
      [first.id, "accepted"],
      [other.id, "open"],
    ]);

    // A second accept cannot fulfil it again, and the closed request takes no more links or decisions.
    const again = await call(
      "POST",
      `/api/resources/submissions/${other.id}/accept`,
      requester.token,
    );
    expect(again.status).toBe(409);
    expect((await stateOf(request.id))?.accepted_submission_id).toBe(first.id);
    const reject = await call(
      "POST",
      `/api/resources/submissions/${other.id}/reject`,
      requester.token,
    );
    expect(reject.status).toBe(409);
    expect((await sendLink(await person(), request.id)).status).toBe(409);
  });

  it("lets only the requester decide, and a stranger's attempt changes nothing", async () => {
    const requester = await person();
    const helper = await person();
    const stranger = await person();
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();

    for (const who of [stranger, helper]) {
      for (const action of ["accept", "reject"]) {
        const res = await call(
          "POST",
          `/api/resources/submissions/${link.id}/${action}`,
          who.token,
        );
        expect(res.status).toBe(404);
      }
    }
    expect((await stateOf(request.id))?.fulfilled_at).toBeNull();
    const row = await env.DB.prepare("SELECT rejected_at FROM resource_submissions").first<{
      rejected_at: number | null;
    }>();
    expect(row?.rejected_at).toBeNull();
  });

  it("turns a link down without fulfilling the request, and it cannot then be accepted", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();

    const res = await call("POST", `/api/resources/submissions/${link.id}/reject`, requester.token);
    expect(res.status).toBe(200);
    expect((await stateOf(request.id))?.fulfilled_at).toBeNull();
    expect(
      (await call("POST", `/api/resources/submissions/${link.id}/reject`, requester.token)).status,
    ).toBe(409);

    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await mine.json<{ items: MyResourceRequest[] }>();
    expect(items[0]).toMatchObject({ state: "open" });
    expect(items[0].submissions[0].decision).toBe("rejected");
  });

  it("refuses to accept a link on a request that has lapsed", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();
    await env.DB.prepare("UPDATE resource_requests SET expires_at = ?")
      .bind(Date.now() - 1000)
      .run();

    const res = await call("POST", `/api/resources/submissions/${link.id}/accept`, requester.token);
    expect(res.status).toBe(409);
    expect((await stateOf(request.id))?.fulfilled_at).toBeNull();
  });
});

describe("expiry", () => {
  it("never shows a lapsed request as open", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    await env.DB.prepare("UPDATE resource_requests SET expires_at = ?")
      .bind(Date.now() - 1000)
      .run();

    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await mine.json<{ items: MyResourceRequest[] }>();
    expect(items[0]).toMatchObject({ id: request.id, state: "expired" });

    // To everyone else it is simply gone, and it takes no links.
    expect((await call("GET", `/api/resources/requests/${request.id}`, helper.token)).status).toBe(
      404,
    );
    expect((await sendLink(helper, request.id)).status).toBe(409);
    const own = await call("GET", `/api/resources/requests/${request.id}`, requester.token);
    expect((await own.json<ResourceRequestDetail>()).state).toBe("expired");
  });

  it("does not notify for a request that already lapsed when a moderator approves it", async () => {
    const requester = await person();
    const mod = await person({ role: "mod" });
    const took = await person();
    await addAttempt(took.id, "CSE115");
    const held = await env.DB.prepare(
      "INSERT INTO resource_requests (author_id, course_code, expires_at, created_at) VALUES (?, 'CSE115', ?, ?) RETURNING id",
    )
      .bind(requester.id, Date.now() - HOUR, Date.now() - DAY)
      .first<{ id: number }>();
    const res = await call(
      "POST",
      `/api/mod/posts/resource_request/${held!.id}/approve`,
      mod.token,
      {},
    );
    expect(res.status).toBe(200);
    expect(await typesFor(took.id)).toEqual([]);
  });
});

describe("cron purge", () => {
  const insertRequest = async (authorId: number, expiresAt: number, fulfilledAt: number | null) => {
    const row = await env.DB.prepare(
      `INSERT INTO resource_requests (author_id, course_code, status, expires_at, fulfilled_at, created_at)
       VALUES (?, 'CSE115', 'published', ?, ?, ?) RETURNING id`,
    )
      .bind(authorId, expiresAt, fulfilledAt, Date.now() - 200 * DAY)
      .first<{ id: number }>();
    await env.DB.prepare(
      "INSERT INTO resource_submissions (request_id, author_id, url, status, created_at) VALUES (?, ?, ?, 'published', ?)",
    )
      .bind(row!.id, authorId, driveLink, Date.now())
      .run();
    return row!.id;
  };
  const ids = async () =>
    (
      await env.DB.prepare("SELECT id FROM resource_requests ORDER BY id").all<{ id: number }>()
    ).results.map((r) => r.id);

  it("deletes expired open requests and keeps the rest until their time", async () => {
    const who = await person();
    const now = Date.now();
    await insertRequest(who.id, now - 1000, null);
    const stillOpen = await insertRequest(who.id, now + DAY, null);
    const fulfilledRecently = await insertRequest(who.id, now - 5 * DAY, now - 30 * DAY);
    const fulfilledJustInside = await insertRequest(
      who.id,
      now - 100 * DAY,
      now - limits.resourceFulfilledKeepMs + HOUR,
    );
    await insertRequest(who.id, now - 200 * DAY, now - limits.resourceFulfilledKeepMs - HOUR);

    const removed = await runCronJobs(db(), now);

    expect(Object.values(removed).reduce((a, b) => a + b, 0)).toBe(2);
    expect(await ids()).toEqual([stillOpen, fulfilledRecently, fulfilledJustInside]);
    // Links go with their request.
    expect(await count("resource_submissions")).toBe(3);
  });

  it("keeps a fulfilled request whose expiry has passed until its own keep period ends", async () => {
    const who = await person();
    const now = Date.now();
    const id = await insertRequest(who.id, now - DAY, now - 2 * DAY);
    await runCronJobs(db(), now);
    expect(await ids()).toEqual([id]);

    await runCronJobs(db(), now + limits.resourceFulfilledKeepMs);
    expect(await ids()).toEqual([]);
  });

  it("writes one audit row per job that removed rows, and none when nothing was purged", async () => {
    const who = await person();
    const now = Date.now();
    await runCronJobs(db(), now);
    expect(await count("audit_log")).toBe(0);

    await insertRequest(who.id, now - 1000, null);
    await insertRequest(who.id, now - 200 * DAY, now - limits.resourceFulfilledKeepMs - HOUR);
    await runCronJobs(db(), now);

    const rows = (
      await env.DB.prepare(
        "SELECT actor, action, target_type, target_id, reason FROM audit_log ORDER BY id",
      ).all<Record<string, string>>()
    ).results;
    expect(rows).toEqual([
      {
        actor: "system",
        action: "cron_purge",
        target_type: "resource_request",
        target_id: "resource_requests:expired",
        reason: "removed 1 rows",
      },
      {
        actor: "system",
        action: "cron_purge",
        target_type: "resource_request",
        target_id: "resource_requests:fulfilled",
        reason: "removed 1 rows",
      },
    ]);

    await runCronJobs(db(), now);
    expect(await count("audit_log")).toBe(2);
  });

  it("counts a failed audit write as that job failing", async () => {
    const who = await person();
    const now = Date.now();
    await insertRequest(who.id, now - 1000, null);
    const removed = await runCronJobs(db(), now, [
      { ...cronJobs[0], targetType: undefined as unknown as string },
    ]);
    expect(removed).toEqual({});
  });

  it("deletes a removed (soft-deleted) request once it lapses, and runs every job even if one fails", async () => {
    const who = await person();
    const now = Date.now();
    const id = await insertRequest(who.id, now - 1000, null);
    await env.DB.prepare("UPDATE resource_requests SET deleted_at = ?").bind(now).run();

    const removed = await runCronJobs(db(), now, [
      {
        name: "broken",
        targetType: "resource_request",
        run: async () => {
          throw new Error("boom");
        },
      },
      ...cronJobs,
    ]);

    expect(removed).not.toHaveProperty("broken");
    expect(await ids()).not.toContain(id);
  });
});

describe("reports and moderation", () => {
  it("sends a report on a link to the mod queue, labelled with the link", async () => {
    const requester = await person();
    const helper = await person();
    const mod = await person({ role: "mod" });
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();

    const res = await call("POST", "/api/reports", requester.token, {
      targetType: "resource_submission",
      targetId: link.id,
      reason: "This is not what I asked for and looks suspicious",
    });
    expect(res.status).toBe(201);

    const queue = await call("GET", "/api/mod/queue", mod.token);
    expect(queue.status).toBe(200);
    const { items } = await queue.json<{ items: Record<string, unknown>[] }>();
    expect(items).toEqual([
      expect.objectContaining({
        kind: "report",
        targetType: "resource_submission",
        targetId: String(link.id),
        targetLabel: driveLink,
        reporter: requester.username,
      }),
    ]);
  });

  it("reports a request and refuses a report from a student who cannot see the link", async () => {
    const requester = await person();
    const helper = await person();
    const stranger = await person();
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();

    const ok = await call("POST", "/api/reports", stranger.token, {
      targetType: "resource_request",
      targetId: request.id,
      reason: "Looks like spam to me, please check",
    });
    expect(ok.status).toBe(201);

    const hidden = await call("POST", "/api/reports", stranger.token, {
      targetType: "resource_submission",
      targetId: link.id,
      reason: "Looks like spam to me, please check",
    });
    expect(hidden.status).toBe(404);

    const own = await call("POST", "/api/reports", helper.token, {
      targetType: "resource_submission",
      targetId: link.id,
      reason: "Reporting my own link for fun",
    });
    expect(own.status).toBe(400);
  });

  it("lets a moderator remove a link and a request without deleting the rows", async () => {
    const requester = await person();
    const helper = await person();
    const mod = await person({ role: "mod" });
    const request = await makeRequest(requester);
    const link = await (await sendLink(helper, request.id)).json<{ id: number }>();

    expect(
      await softDelete(db(), {
        actor: mod.id,
        targetType: "resource_submission",
        targetId: link.id,
        reason: "Not course material",
      }),
    ).toEqual({ ok: true });

    // The row stays, and the requester no longer sees the link.
    expect(await count("resource_submissions")).toBe(1);
    const mine = await call("GET", "/api/resources/requests/mine", requester.token);
    expect((await mine.json<{ items: MyResourceRequest[] }>()).items[0].submissions).toEqual([]);
  });
});

describe("my requests", () => {
  it("lists newest first and pages by cursor", async () => {
    const requester = await person();
    const first = await makeRequest(requester);
    const second = await makeRequest(requester);
    const third = await makeRequest(requester);

    const page1 = await (
      await call("GET", "/api/resources/requests/mine?limit=2", requester.token)
    ).json<{ items: MyResourceRequest[]; nextCursor: string | null }>();
    expect(page1.items.map((r) => r.id)).toEqual([third.id, second.id]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await (
      await call(
        "GET",
        `/api/resources/requests/mine?limit=2&cursor=${page1.nextCursor}`,
        requester.token,
      )
    ).json<{ items: MyResourceRequest[]; nextCursor: string | null }>();
    expect(page2.items.map((r) => r.id)).toEqual([first.id]);
    expect(page2.nextCursor).toBeNull();
  });
});
