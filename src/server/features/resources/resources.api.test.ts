import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import type {
  HelpableResourceRequestList,
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
      note: "send it to my whatsapp, call 01712345678 or visit https://bit.ly/buy",
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

  it("is refused for http, a bare IP or a link shortener", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    for (const url of [
      "http://drive.google.com/file/d/abc",
      "https://192.168.0.1/notes.pdf",
      "https://bit.ly/abc123",
    ]) {
      expect((await sendLink(helper, request.id, url)).status).toBe(400);
    }
    expect(await count("resource_submissions")).toBe(0);
  });

  it("accepts a link from any public site, such as a YouTube playlist", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    const url = "https://www.youtube.com/playlist?list=PLabc123";
    const res = await sendLink(helper, request.id, url);
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ url, status: "published" });
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

  describe("Remove on a report", () => {
    const reasonText = "Not course material";

    async function reportedLink() {
      const requester = await person();
      const helper = await person();
      const mod = await person({ role: "mod" });
      const request = await makeRequest(requester);
      const link = await (await sendLink(helper, request.id)).json<{ id: number }>();
      const reported = await call("POST", "/api/reports", requester.token, {
        targetType: "resource_submission",
        targetId: link.id,
        reason: "This is not what I asked for",
      });
      const { id: reportId } = await reported.json<{ id: number }>();
      return { requester, helper, mod, request, link, reportId };
    }

    const myLinks = async (requester: Person) =>
      (
        await (
          await call("GET", "/api/resources/requests/mine", requester.token)
        ).json<{ items: MyResourceRequest[] }>()
      ).items[0].submissions;

    const reportRow = (id: number) =>
      env.DB.prepare("SELECT status, resolved_by, resolve_note FROM reports WHERE id = ?")
        .bind(id)
        .first<{ status: string; resolved_by: number | null; resolve_note: string | null }>();

    it("removes a reported link, closes the report and writes both audit rows", async () => {
      const { requester, mod, link, reportId } = await reportedLink();
      expect(await myLinks(requester)).toHaveLength(1);

      const res = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
        reason: reasonText,
      });
      expect(res.status).toBe(200);

      // Gone from the requester's view; the row stays for a reversal.
      expect(await myLinks(requester)).toEqual([]);
      expect(await count("resource_submissions")).toBe(1);
      expect(await reportRow(reportId)).toEqual({
        status: "resolved",
        resolved_by: mod.id,
        resolve_note: `Removed: ${reasonText}`,
      });

      const audit = (
        await env.DB.prepare(
          "SELECT action, target_type, target_id, reason FROM audit_log WHERE actor = ? ORDER BY id",
        )
          .bind(String(mod.id))
          .all<{ action: string; target_type: string; target_id: string; reason: string }>()
      ).results;
      expect(audit).toEqual([
        {
          action: "soft_delete",
          target_type: "resource_submission",
          target_id: String(link.id),
          reason: reasonText,
        },
        {
          action: "resolve_report",
          target_type: "report",
          target_id: String(reportId),
          reason: `Removed: ${reasonText}`,
        },
      ]);

      // It left the open queue.
      const queue = await call("GET", "/api/mod/queue", mod.token);
      expect((await queue.json<{ items: unknown[] }>()).items).toEqual([]);
    });

    it("closes every open report on the same target", async () => {
      const { mod, request, reportId } = await reportedLink();
      const stranger = await person();
      const second = await call("POST", "/api/reports", stranger.token, {
        targetType: "resource_request",
        targetId: request.id,
        reason: "Looks like spam to me",
      });
      const { id: requestReportId } = await second.json<{ id: number }>();
      // A second report on the link, from another reporter, is filed directly: only the requester
      // can see a link, so only they can report it through the API.
      const link = (await env.DB.prepare("SELECT id FROM resource_submissions").first<{
        id: number;
      }>())!;
      await env.DB.prepare(
        "INSERT INTO reports (target_type, target_id, reporter_id, reason, created_at) VALUES ('resource_submission', ?, ?, 'also bad', ?)",
      )
        .bind(String(link.id), stranger.id, Date.now())
        .run();

      const res = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
        reason: reasonText,
      });
      expect(res.status).toBe(200);
      const open = await env.DB.prepare("SELECT id FROM reports WHERE status = 'open'").all<{
        id: number;
      }>();
      // Only the report on the request is still open: it is a different target.
      expect(open.results.map((r) => r.id)).toEqual([requestReportId]);
    });

    it("removes a reported request so it leaves the requester's list", async () => {
      const requester = await person();
      const stranger = await person();
      const mod = await person({ role: "mod" });
      const request = await makeRequest(requester);
      const reported = await call("POST", "/api/reports", stranger.token, {
        targetType: "resource_request",
        targetId: request.id,
        reason: "Looks like spam to me",
      });
      const { id: reportId } = await reported.json<{ id: number }>();

      const res = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
        reason: reasonText,
      });
      expect(res.status).toBe(200);
      const mine = await call("GET", "/api/resources/requests/mine", requester.token);
      expect((await mine.json<{ items: unknown[] }>()).items).toEqual([]);
      const detail = await call("GET", `/api/resources/requests/${request.id}`, stranger.token);
      expect(detail.status).toBe(404);
    });

    it("refuses a student, a missing or short reason, a closed report and a user report", async () => {
      const { requester, helper, mod, reportId } = await reportedLink();
      for (const who of [requester, helper]) {
        const res = await call("POST", `/api/mod/reports/${reportId}/remove`, who.token, {
          reason: reasonText,
        });
        expect(res.status).toBe(403);
      }
      expect((await call("POST", `/api/mod/reports/${reportId}/remove`, null, {})).status).toBe(
        401,
      );
      for (const body of [{}, { reason: "no" }]) {
        const res = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, body);
        expect(res.status).toBe(400);
      }
      expect(
        (await call("POST", "/api/mod/reports/9999/remove", mod.token, { reason: reasonText }))
          .status,
      ).toBe(404);
      // Nothing was removed by any of that.
      expect(await myLinks(requester)).toHaveLength(1);
      expect((await reportRow(reportId))?.status).toBe("open");

      // A report on a user has no content to remove.
      const userReport = await call("POST", "/api/reports", requester.token, {
        targetType: "user",
        targetId: helper.id,
        reason: "Sent me something odd",
      });
      const { id: userReportId } = await userReport.json<{ id: number }>();
      const refused = await call("POST", `/api/mod/reports/${userReportId}/remove`, mod.token, {
        reason: reasonText,
      });
      expect(refused.status).toBe(409);
      expect((await refused.json<{ error: string }>()).error).toBe("not_removable");

      // Removing twice: the report is closed by the first.
      expect(
        (
          await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
            reason: reasonText,
          })
        ).status,
      ).toBe(200);
      const again = await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, {
        reason: reasonText,
      });
      expect(again.status).toBe(409);
      expect((await again.json<{ error: string }>()).error).toBe("already_resolved");
    });

    it("tells the author of a removed link, with the reason, and nobody else", async () => {
      const { requester, helper, mod, link, reportId } = await reportedLink();
      const before = (await inbox(helper.id)).length;
      await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, { reason: reasonText });

      const told = (await inbox(helper.id)).slice(before);
      expect(told).toHaveLength(1);
      expect(told[0].type).toBe("content_removed");
      // Only the kind and the reason: no URL, no ids, no one's name.
      expect(JSON.parse(told[0].payload)).toEqual({
        kind: "resource_submission",
        reason: reasonText,
      });
      expect(told[0].payload).not.toContain(driveLink);
      expect(told[0].payload).not.toContain(String(link.id));
      // The requester who reported it, and the mod, hear nothing.
      expect(await typesFor(requester.id)).not.toContain("content_removed");
      expect(await typesFor(mod.id)).toEqual([]);
    });

    it("tells the author of a removed request", async () => {
      const requester = await person();
      const stranger = await person();
      const mod = await person({ role: "mod" });
      const request = await makeRequest(requester);
      const reported = await call("POST", "/api/reports", stranger.token, {
        targetType: "resource_request",
        targetId: request.id,
        reason: "Looks like spam to me",
      });
      const { id: reportId } = await reported.json<{ id: number }>();
      await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, { reason: reasonText });

      const told = (await inbox(requester.id)).filter((n) => n.type === "content_removed");
      expect(told).toHaveLength(1);
      expect(JSON.parse(told[0].payload)).toEqual({
        kind: "resource_request",
        reason: reasonText,
      });
      expect(await typesFor(stranger.id)).toEqual([]);
    });

    it("tells no one when the author removes their own content, or when the removal is refused", async () => {
      const requester = await person({ role: "mod" });
      const request = await makeRequest(requester);
      const input = {
        actor: requester.id,
        targetType: "resource_request",
        targetId: request.id,
        reason: reasonText,
      };
      expect(await softDelete(db(), input)).toEqual({ ok: true });
      expect(await softDelete(db(), input)).toMatchObject({ ok: false });
      expect(await typesFor(requester.id)).toEqual([]);
    });

    it("does not tell the author of a link the cron purge deletes", async () => {
      const requester = await person();
      const helper = await person();
      const request = await makeRequest(requester);
      await sendLink(helper, request.id);
      const beforeHelper = (await inbox(helper.id)).length;
      const beforeRequester = (await inbox(requester.id)).length;
      await runCronJobs(db(), Date.now() + 120 * DAY);
      expect(await count("resource_requests")).toBe(0);
      expect((await inbox(helper.id)).length).toBe(beforeHelper);
      expect((await inbox(requester.id)).length).toBe(beforeRequester);
    });

    it("lets an admin reverse the removal, and the link shows again", async () => {
      const { requester, mod, link, reportId } = await reportedLink();
      const admin = await person({ role: "admin" });
      await call("POST", `/api/mod/reports/${reportId}/remove`, mod.token, { reason: reasonText });
      expect(await myLinks(requester)).toEqual([]);

      const removal = (await env.DB.prepare(
        "SELECT id FROM audit_log WHERE action = 'soft_delete' AND target_id = ?",
      )
        .bind(String(link.id))
        .first<{ id: number }>())!;
      // A mod cannot reverse it.
      expect(
        (
          await call("POST", `/api/admin/audit/${removal.id}/reverse`, mod.token, {
            reason: "oops",
          })
        ).status,
      ).toBe(403);
      const res = await call("POST", `/api/admin/audit/${removal.id}/reverse`, admin.token, {
        reason: "It was fine",
      });
      expect(res.status).toBe(201);
      expect(await myLinks(requester)).toHaveLength(1);
    });
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

/** A request written straight to the table, for states the API will not produce (held, lapsed, removed). */
async function insertRequest(
  authorId: number,
  row: {
    courseCode?: string | null;
    facultyId?: number | null;
    status?: string;
    expiresAt?: number;
    fulfilledAt?: number | null;
    deletedAt?: number | null;
  },
) {
  const created = await env.DB.prepare(
    "INSERT INTO resource_requests (author_id, course_code, faculty_id, status, expires_at, fulfilled_at, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
  )
    .bind(
      authorId,
      row.courseCode ?? null,
      row.facultyId ?? null,
      row.status ?? "published",
      row.expiresAt ?? Date.now() + 7 * DAY,
      row.fulfilledAt ?? null,
      row.deletedAt ?? null,
      Date.now(),
    )
    .first<{ id: number }>();
  return created!.id;
}

const helpable = async (who: Person) => {
  const res = await call("GET", "/api/resources/requests/helpable", who.token);
  expect(res.status).toBe(200);
  return (await res.json<HelpableResourceRequestList>()).items;
};

describe("requests I can help with", () => {
  it("lists a request for a course the student recorded after it was published", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester, { facultyId: faculty1 });
    expect(await helpable(helper)).toEqual([]);

    await addAttempt(helper.id, "CSE115", faculty1);

    const items = await helpable(helper);
    expect(items.map((r) => r.id)).toEqual([request.id]);
    // Recording the course later does not send the notification that was skipped at publish.
    expect(await typesFor(helper.id)).toEqual([]);
  });

  it("lists a same-course request for a different faculty member, not tagged as the same faculty", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester, { facultyId: faculty1 });
    await addAttempt(helper.id, "CSE115", faculty2);

    const items = await helpable(helper);
    expect(items.map((r) => [r.id, r.sameFaculty])).toEqual([[request.id, false]]);
  });

  it("lists a course-only request, and a helper with no faculty on the attempt is not the same faculty", async () => {
    const requester = await person();
    const helper = await person();
    const request = await makeRequest(requester);
    await addAttempt(helper.id, "CSE115");

    const items = await helpable(helper);
    expect(items.map((r) => [r.id, r.sameFaculty])).toEqual([[request.id, false]]);
  });

  it("tags the same course and faculty and sorts it ahead of one that lapses sooner", async () => {
    const requester = await person();
    const helper = await person();
    await addAttempt(helper.id, "CSE115", faculty1);
    await addAttempt(helper.id, "CSE225", faculty2);
    const sooner = await makeRequest(requester, {
      courseCode: "CSE225",
      facultyId: faculty1,
      expiresAt: Date.now() + 2 * DAY,
    });
    const same = await makeRequest(requester, {
      courseCode: "CSE115",
      facultyId: faculty1,
      expiresAt: Date.now() + 20 * DAY,
    });
    const later = await makeRequest(requester, {
      courseCode: "CSE225",
      facultyId: faculty1,
      expiresAt: Date.now() + 10 * DAY,
    });

    const items = await helpable(helper);
    expect(items.map((r) => [r.id, r.sameFaculty])).toEqual([
      [same.id, true],
      [sooner.id, false],
      [later.id, false],
    ]);
  });

  it("lists a faculty-only request for a student who had that faculty member, and not for one who did not", async () => {
    const requester = await person();
    const had = await person();
    const other = await person();
    await addAttempt(had.id, "CSE115", faculty1);
    await addAttempt(other.id, "CSE115", faculty2);
    const request = await makeRequest(requester, { courseCode: undefined, facultyId: faculty1 });

    expect((await helpable(had)).map((r) => [r.id, r.sameFaculty])).toEqual([[request.id, true]]);
    expect(await helpable(other)).toEqual([]);
  });

  it("leaves out the student's own, fulfilled, lapsed, held and removed requests", async () => {
    const requester = await person();
    const helper = await person();
    await addAttempt(helper.id, "CSE115");
    await addAttempt(requester.id, "CSE115");
    await insertRequest(helper.id, { courseCode: "CSE115" });
    await insertRequest(requester.id, { courseCode: "CSE115", fulfilledAt: Date.now() });
    await insertRequest(requester.id, { courseCode: "CSE115", expiresAt: Date.now() - HOUR });
    await insertRequest(requester.id, { courseCode: "CSE115", status: "pending_review" });
    await insertRequest(requester.id, { courseCode: "CSE115", status: "rejected" });
    await insertRequest(requester.id, { courseCode: "CSE115", deletedAt: Date.now() });
    const open = await insertRequest(requester.id, { courseCode: "CSE115" });

    expect((await helpable(helper)).map((r) => r.id)).toEqual([open]);
  });

  it("counts the links the student already sent, and ignores other helpers' and removed ones", async () => {
    const requester = await person();
    const helper = await person();
    const other = await person();
    await addAttempt(helper.id, "CSE115");
    await addAttempt(other.id, "CSE115");
    const sent = await makeRequest(requester);
    const untouched = await makeRequest(requester, { courseCode: "CSE115" });
    expect((await sendLink(helper, sent.id)).status).toBe(201);
    expect((await sendLink(helper, sent.id, "https://github.com/a/b")).status).toBe(201);
    expect((await sendLink(other, untouched.id)).status).toBe(201);
    const removed = await sendLink(helper, untouched.id);
    const { id: removedId } = await removed.json<{ id: number }>();
    await env.DB.prepare("UPDATE resource_submissions SET deleted_at = ? WHERE id = ?")
      .bind(Date.now(), removedId)
      .run();

    const items = await helpable(helper);
    expect(Object.fromEntries(items.map((r) => [r.id, r.myLinks]))).toEqual({
      [sent.id]: 2,
      [untouched.id]: 0,
    });
  });

  it("carries no requester identity and no link", async () => {
    const requester = await person();
    const helper = await person();
    const other = await person();
    await addAttempt(other.id, "CSE115");
    await addAttempt(helper.id, "CSE115");
    const request = await makeRequest(requester, { note: "Midterm notes" });
    expect((await sendLink(other, request.id)).status).toBe(201);

    const res = await call("GET", "/api/resources/requests/helpable", helper.token);
    const text = await res.text();
    expect(text).not.toContain(requester.username);
    expect(text).not.toContain(other.username);
    expect(text).not.toContain("drive.google.com");
    for (const item of JSON.parse(text).items) {
      expect(Object.keys(item)).not.toEqual(
        expect.arrayContaining(["authorId", "username", "url", "submissions"]),
      );
      expect(item).not.toHaveProperty("authorId");
      expect(item).not.toHaveProperty("submissions");
    }
  });

  it("is not shadowed by the request id route, and needs a signed-in user", async () => {
    expect((await call("GET", "/api/resources/requests/helpable", null)).status).toBe(401);
  });

  it("does not stop a student from sending a link to a request found here", async () => {
    const requester = await person();
    const helper = await person();
    await makeRequest(requester);
    await addAttempt(helper.id, "CSE115");
    const [item] = await helpable(helper);

    expect((await sendLink(helper, item.id)).status).toBe(201);
    expect((await helpable(helper))[0].myLinks).toBe(1);
  });
});

describe("same faculty on a link", () => {
  it("tells the requester whether each sender took the same faculty member", async () => {
    const requester = await person();
    const same = await person();
    const different = await person();
    const wrongCourse = await person();
    const noAttempt = await person();
    await addAttempt(same.id, "CSE115", faculty1);
    await addAttempt(different.id, "CSE115", faculty2);
    // Same faculty member, but not for the course the request names.
    await addAttempt(wrongCourse.id, "CSE225", faculty1);
    const withFaculty = await makeRequest(requester, { facultyId: faculty1 });
    for (const who of [same, different, wrongCourse, noAttempt]) {
      expect((await sendLink(who, withFaculty.id)).status).toBe(201);
    }

    const res = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await res.json<{ items: MyResourceRequest[] }>();
    const bySender = Object.fromEntries(
      items[0].submissions.map((l) => [l.uploader, l.sameFaculty]),
    );
    expect(bySender).toEqual({
      [same.username]: true,
      [different.username]: false,
      [wrongCourse.username]: false,
      [noAttempt.username]: false,
    });
  });

  it("is null when the request names no faculty member, and course-free requests match on faculty alone", async () => {
    const requester = await person();
    const helper = await person();
    await addAttempt(helper.id, "CSE115", faculty1);
    const noFaculty = await makeRequest(requester);
    const facultyOnly = await makeRequest(requester, {
      courseCode: undefined,
      facultyId: faculty1,
    });
    expect((await sendLink(helper, noFaculty.id)).status).toBe(201);
    expect((await sendLink(helper, facultyOnly.id)).status).toBe(201);

    const res = await call("GET", "/api/resources/requests/mine", requester.token);
    const { items } = await res.json<{ items: MyResourceRequest[] }>();
    const flag = (id: number) => items.find((r) => r.id === id)!.submissions[0].sameFaculty;
    expect(flag(noFaculty.id)).toBeNull();
    expect(flag(facultyOnly.id)).toBe(true);
  });
});
