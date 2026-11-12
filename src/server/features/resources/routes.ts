import { Hono, type Context } from "hono";
import type { z } from "zod";
import { pageQuery } from "../../../shared/schemas/common";
import {
  resourceRequestInput,
  resourceSubmissionInput,
  type helpableResourceRequestList,
  type myResourceRequestPage,
  type resourceRequestDetail,
  type resourceSubmissionOwn,
} from "../../../shared/schemas/resources";
import { pushSenderFromEnv } from "../../adapters/push";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv, SessionUser } from "../../middleware/types";
import { notify } from "../../notify";
import { pageParams, toPage } from "../../paging";
import { submitPost, type SubmitResult } from "../../moderation/submit";
import { facultyRepo } from "../../repos/faculty";
import { resourceRequestsRepo, resourceSubmissionsRepo } from "../../repos/resources";
import { validateJson, validateQuery } from "../../validate";
import { announceRequest, announceSubmission } from "./announce";
import { requestState, toOwnSubmission, toRequestView, toRequesterSubmission } from "./view";

const user = (c: Context<AppEnv>): SessionUser => c.get("user") as SessionUser;

const notFound = (c: Context) => c.json({ error: "not_found" }, 404);

function paramId(c: Context): number | null {
  const n = Number(c.req.param("id"));
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

const noText: never[] = [];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A span as the person reads it: "an hour", "3 hours", "a day", "2 days". */
function spanWords(ms: number): string {
  const [n, one, many] =
    ms >= DAY_MS && ms % DAY_MS === 0
      ? [ms / DAY_MS, "a day", "days"]
      : [Math.round(ms / HOUR_MS), "an hour", "hours"];
  return n === 1 ? one : `${n} ${many}`;
}

/** The 429 for a post that may not be made yet: a new account, or the probing cooldown. */
function postBlocked(c: Context, blocked: Extract<SubmitResult, { ok: false }>) {
  c.header("Retry-After", String(Math.ceil(blocked.retryAfterMs / 1000)));
  return c.json(
    {
      error: blocked.reason,
      message:
        blocked.reason === "new_account"
          ? "New accounts can post after their first day. Try again later."
          : "You can post again shortly. Try again later.",
    },
    429,
  );
}

/**
 * Resource sharing. A request is a user-written post (screened on create), and so is each link sent to
 * it. Only the requester sees a link and its uploader's handle; the notification fan-out never reaches
 * the requester, and no response here lists who was told. Reports go through `POST /api/reports` with
 * the `resource_request` and `resource_submission` target types.
 */
export const resourceRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .post("/requests", validateJson(resourceRequestInput), async (c) => {
    const me = user(c);
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `resource:request:${me.id}`,
      limits.resourceRequestCreate.limit,
      limits.resourceRequestCreate.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    if (
      body.expiresAt < now + limits.resourceExpiry.minMs ||
      body.expiresAt > now + limits.resourceExpiry.maxMs
    ) {
      return c.json(
        {
          error: "invalid_expiry",
          message: `Pick an expiry between ${spanWords(limits.resourceExpiry.minMs)} and ${spanWords(limits.resourceExpiry.maxMs)} away.`,
        },
        400,
      );
    }
    if (body.facultyId !== undefined && !(await facultyRepo(db).exists(body.facultyId))) {
      return c.json(
        { error: "unknown_faculty", message: "Pick a faculty member from the list." },
        400,
      );
    }
    const requests = resourceRequestsRepo(db);
    if ((await requests.countOpenMine(me.id, now)) >= limits.resourceOpenRequestsMax) {
      return c.json(
        {
          error: "too_many_open",
          message: `You can have ${limits.resourceOpenRequestsMax} open requests at a time.`,
        },
        409,
      );
    }

    const note = body.note && body.note !== "" ? body.note : null;
    const result = await submitPost(
      db,
      c.env,
      {
        user: me,
        targetType: "resource_request",
        input: { texts: note === null ? noText : [note] },
        save: (moderation) =>
          requests.insert({
            authorId: me.id,
            courseCode: body.courseCode ?? null,
            facultyId: body.facultyId ?? null,
            note,
            expiresAt: body.expiresAt,
            createdAt: now,
            ...moderation,
          }),
      },
      { now },
    );
    if (!result.ok) return postBlocked(c, result);
    if (result.outcome.status === "published") {
      await announceRequest(db, result.id, { now, push: pushSenderFromEnv(c.env) });
    }
    const created = await requests.find(result.id);
    return created ? c.json(toRequestView(created, now), 201) : notFound(c);
  })
  // Registered before "/requests/:id" so "mine" is never read as an id.
  .get("/requests/mine", validateQuery(pageQuery), async (c) => {
    const { cursor, limit } = c.req.valid("query");
    const params = pageParams({ cursor, limit }, limits.resourcePage);
    if (!params) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const db = getDb(c.env.DB);
    const now = Date.now();
    const rows = await resourceRequestsRepo(db).listMine(
      user(c).id,
      params.size + 1,
      params.cursor,
    );
    const page = toPage(rows, params.size);
    const links = await resourceSubmissionsRepo(db).listPublishedFor(page.items.map((r) => r.id));
    return c.json({
      items: page.items.map((r) => ({
        ...toRequestView(r, now),
        submissions: links
          .filter((s) => s.requestId === r.id)
          .map((s) => toRequesterSubmission(s, r.acceptedSubmissionId)),
      })),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof myResourceRequestPage>);
  })
  // Also before "/requests/:id". Open requests for a course the student recorded (any faculty) or a
  // faculty member they had. Carries no requester identity and no link.
  .get("/requests/helpable", async (c) => {
    const me = user(c);
    const db = getDb(c.env.DB);
    const now = Date.now();
    const rows = await resourceRequestsRepo(db).listHelpable(
      me.id,
      now,
      limits.resourceHelpableMax,
    );
    const sent = await resourceSubmissionsRepo(db).countOwnByRequest(
      me.id,
      rows.map((r) => r.id),
    );
    return c.json({
      items: rows.map((r) => ({
        ...toRequestView(r, now),
        sameFaculty: r.sameFaculty,
        myLinks: sent.get(r.id) ?? 0,
      })),
    } satisfies z.infer<typeof helpableResourceRequestList>);
  })
  .get("/requests/:id", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const db = getDb(c.env.DB);
    const now = Date.now();
    const request = await resourceRequestsRepo(db).findVisible(id, { id: me.id, role: me.role });
    if (!request) return notFound(c);
    const mine = request.authorId === me.id;
    // Someone else's request that has lapsed, been fulfilled or is still held is gone as far as they can tell.
    if (!mine && (request.status !== "published" || requestState(request, now) !== "open")) {
      return notFound(c);
    }
    const own = mine ? [] : await resourceSubmissionsRepo(db).listOwn(id, me.id);
    return c.json({
      ...toRequestView(request, now),
      mine,
      mySubmissions: own.map((s) => toOwnSubmission(s, request.acceptedSubmissionId)),
    } satisfies z.infer<typeof resourceRequestDetail>);
  })
  .post("/requests/:id/submissions", validateJson(resourceSubmissionInput), async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `resource:submit:${me.id}`,
      limits.resourceSubmit.limit,
      limits.resourceSubmit.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const request = await resourceRequestsRepo(db).findVisible(id, { id: me.id, role: me.role });
    if (!request || request.status !== "published") return notFound(c);
    if (request.authorId === me.id) {
      return c.json(
        { error: "own_request", message: "You can't send a link to your own request." },
        400,
      );
    }
    if (requestState(request, now) !== "open") {
      return c.json({ error: "closed", message: "This request is no longer open." }, 409);
    }
    const links = resourceSubmissionsRepo(db);
    if (
      (await links.countLiveBy(id, me.id)) >= limits.resourceSubmissionsPerUser ||
      (await links.countLive(id)) >= limits.resourceSubmissionsPerRequest
    ) {
      return c.json(
        { error: "too_many_links", message: "This request can't take another link from you." },
        409,
      );
    }

    const note = body.note && body.note !== "" ? body.note : null;
    const result = await submitPost(
      db,
      c.env,
      {
        user: me,
        targetType: "resource_submission",
        input: { texts: note === null ? noText : [note] },
        save: (moderation) =>
          links.insert({
            requestId: id,
            authorId: me.id,
            url: body.url,
            note,
            createdAt: now,
            ...moderation,
          }),
      },
      { now },
    );
    if (!result.ok) return postBlocked(c, result);
    if (result.outcome.status === "published") {
      await announceSubmission(db, result.id, { now, push: pushSenderFromEnv(c.env) });
    }
    const created = await links.find(result.id);
    return created
      ? c.json(toOwnSubmission(created, null) satisfies z.infer<typeof resourceSubmissionOwn>, 201)
      : notFound(c);
  })
  .post("/submissions/:id/accept", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `resource:decide:${me.id}`,
      limits.resourceDecide.limit,
      limits.resourceDecide.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const link = await resourceSubmissionsRepo(db).find(id);
    const request = link && (await resourceRequestsRepo(db).find(link.requestId));
    // Someone else's link is a 404, the same as one that does not exist.
    if (!link || !request || request.authorId !== me.id || request.deletedAt !== null) {
      return notFound(c);
    }
    if (!(await resourceRequestsRepo(db).accept(request.id, me.id, id, now))) {
      return c.json(
        { error: "not_acceptable", message: "That link can't be accepted any more." },
        409,
      );
    }
    await notify(
      db,
      [link.authorId],
      "resource_accepted",
      { requestId: request.id },
      { now, push: pushSenderFromEnv(c.env) },
    );
    return c.json({ ok: true });
  })
  .post("/submissions/:id/reject", async (c) => {
    const id = paramId(c);
    if (id === null) return notFound(c);
    const me = user(c);
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `resource:decide:${me.id}`,
      limits.resourceDecide.limit,
      limits.resourceDecide.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const links = resourceSubmissionsRepo(db);
    const link = await links.find(id);
    const request = link && (await resourceRequestsRepo(db).find(link.requestId));
    if (!link || !request || request.authorId !== me.id || request.deletedAt !== null) {
      return notFound(c);
    }
    if (!(await links.reject(id, me.id, now))) {
      return c.json(
        { error: "not_rejectable", message: "That link can't be turned down any more." },
        409,
      );
    }
    return c.json({ ok: true });
  });
