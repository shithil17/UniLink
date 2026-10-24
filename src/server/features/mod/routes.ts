import { Hono } from "hono";
import type { z } from "zod";
import { pageQuery } from "../../../shared/schemas/common";
import {
  approvePostRequest,
  idConflictQuery,
  modReportsQuery,
  modUsersQuery,
  reasonBody,
  rejectPostRequest,
  releaseKeyRequest,
  resolveReportRequest,
  type idConflictResult,
  type modQueuePage,
  type modReportPage,
  type modUserPage,
  type temporaryPassword,
} from "../../../shared/schemas/moderation";
import { pushSenderFromEnv } from "../../adapters/push";
import { getDb } from "../../db/client";
import { requireRole } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { reportsRepo } from "../../repos/reports";
import { usersRepo } from "../../repos/users";
import { validateJson, validateQuery } from "../../validate";
import { courseModRoutes } from "../courses/modRoutes";
import { facultyModRoutes } from "../faculty/modRoutes";
import {
  banUser,
  clearProbingFlag,
  logIdLookup,
  releaseKey,
  resetPassword,
  resolveReport,
  unbanUser,
} from "./actions";
import { pageParams, toPage } from "../../paging";
import { decidePost, type PostDecisionFailure } from "./postActions";
import { modQueue } from "./queue";
import { toModReports } from "./reportView";
import { actionFailure, actorOf, badCursor, paramId } from "./respond";

const notFound = { error: "not_found" } as const;

const POST_FAILURES: Record<PostDecisionFailure, { status: 404 | 409; message: string }> = {
  unknown_target: { status: 404, message: "That does not exist." },
  not_found: { status: 404, message: "That post no longer exists." },
  not_held: { status: 409, message: "Another moderator already decided that post." },
};

/**
 * Moderation for mods and admins. The server is the real guard: every route needs the mod role, and
 * every action also checks who it may act on (see `canActOn`). User lists carry the public handle and
 * state only. The ID-conflict lookup is the one response here that names a student ID. Nothing in this
 * file reads attempts, CGPA or routine data.
 */
export const modRoutes = new Hono<AppEnv>()
  .use(requireRole("mod"))
  .route("/faculty", facultyModRoutes)
  .route("/", courseModRoutes)
  .get("/users", validateQuery(modUsersQuery), async (c) => {
    const { q, cursor, limit } = c.req.valid("query");
    const params = pageParams({ cursor, limit });
    if (!params) return badCursor(c);
    const rows = await usersRepo(getDb(c.env.DB)).listForMods({
      prefix: q,
      beforeId: params.cursor,
      limit: params.size + 1,
    });
    return c.json(toPage(rows, params.size) satisfies z.infer<typeof modUserPage>);
  })
  .get("/id-conflict", validateQuery(idConflictQuery), async (c) => {
    const db = getDb(c.env.DB);
    const holder = await usersRepo(db).findByStudentKey(c.req.valid("query").key);
    if (holder) await logIdLookup(db, actorOf(c), holder.id);
    return c.json({
      holder: holder && {
        id: holder.id,
        username: holder.username,
        role: holder.role,
        bannedAt: holder.bannedAt,
        mustChangePassword: holder.mustChangePassword,
        createdAt: holder.createdAt,
        probingFlaggedAt: holder.probingFlaggedAt,
        postingBlockedUntil: holder.postingBlockedUntil,
        studentId: `${holder.studentKey}${holder.studentSuffix}`,
      },
    } satisfies z.infer<typeof idConflictResult>);
  })
  .post("/id-conflict/release", validateJson(releaseKeyRequest), async (c) => {
    const { userId, reason } = c.req.valid("json");
    const result = await releaseKey(getDb(c.env.DB), actorOf(c), userId, reason);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  })
  .post("/users/:id/ban", validateJson(reasonBody), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const result = await banUser(getDb(c.env.DB), actorOf(c), id, c.req.valid("json").reason);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  })
  .post("/users/:id/unban", validateJson(reasonBody), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const result = await unbanUser(getDb(c.env.DB), actorOf(c), id, c.req.valid("json").reason);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  })
  .post("/users/:id/clear-probing", validateJson(reasonBody), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const result = await clearProbingFlag(
      getDb(c.env.DB),
      actorOf(c),
      id,
      c.req.valid("json").reason,
    );
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  })
  .post("/users/:id/reset-password", validateJson(reasonBody), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const result = await resetPassword(getDb(c.env.DB), actorOf(c), id, c.req.valid("json").reason);
    if (!result.ok) return actionFailure(c, result.reason);
    // Shown once to the mod: nothing may keep a copy.
    c.header("Cache-Control", "no-store");
    return c.json({
      temporaryPassword: result.temporaryPassword,
    } satisfies z.infer<typeof temporaryPassword>);
  })
  .get("/reports", validateQuery(modReportsQuery), async (c) => {
    const { status, cursor, limit } = c.req.valid("query");
    const params = pageParams({ cursor, limit });
    if (!params) return badCursor(c);
    const db = getDb(c.env.DB);
    const page = toPage(
      await reportsRepo(db).listPage(status, params.size + 1, params.cursor),
      params.size,
    );
    return c.json({
      items: await toModReports(db, page.items),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof modReportPage>);
  })
  // Held posts and open reports in one list, plus the size of the whole queue.
  .get("/queue", validateQuery(pageQuery), async (c) => {
    const { cursor, limit } = c.req.valid("query");
    const params = pageParams({ cursor, limit });
    if (!params) return badCursor(c);
    const page = await modQueue(getDb(c.env.DB), { cursor, size: params.size });
    if (!page) return badCursor(c);
    return c.json(page satisfies z.infer<typeof modQueuePage>);
  })
  .post("/posts/:type/:id/approve", validateJson(approvePostRequest), async (c) => {
    const id = paramId(c);
    const type = c.req.param("type");
    if (id === null) return c.json(notFound, 404);
    const result = await decidePost(
      getDb(c.env.DB),
      actorOf(c),
      { type, id },
      { decision: "approve", reason: c.req.valid("json").reason },
      { push: pushSenderFromEnv(c.env) },
    );
    if (result.ok) return c.json({ ok: true });
    const { status, message } = POST_FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  })
  .post("/posts/:type/:id/reject", validateJson(rejectPostRequest), async (c) => {
    const id = paramId(c);
    const type = c.req.param("type");
    if (id === null) return c.json(notFound, 404);
    const { reason, category } = c.req.valid("json");
    const result = await decidePost(
      getDb(c.env.DB),
      actorOf(c),
      { type, id },
      { decision: "reject", reason, category },
      { push: pushSenderFromEnv(c.env) },
    );
    if (result.ok) return c.json({ ok: true });
    const { status, message } = POST_FAILURES[result.reason];
    return c.json({ error: result.reason, message }, status);
  })
  .post("/reports/:id/resolve", validateJson(resolveReportRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const { outcome, note } = c.req.valid("json");
    const result = await resolveReport(getDb(c.env.DB), actorOf(c), id, outcome, note ?? null);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  });
