import { Hono } from "hono";
import type { z } from "zod";
import {
  idConflictQuery,
  modReportsQuery,
  modUsersQuery,
  reasonBody,
  releaseKeyRequest,
  resolveReportRequest,
  type idConflictResult,
  type modReportPage,
  type modUserPage,
  type temporaryPassword,
} from "../../../shared/schemas/moderation";
import { getDb } from "../../db/client";
import { requireRole } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { reportsRepo } from "../../repos/reports";
import { usersRepo } from "../../repos/users";
import { validateJson, validateQuery } from "../../validate";
import {
  banUser,
  logIdLookup,
  releaseKey,
  resetPassword,
  resolveReport,
  unbanUser,
} from "./actions";
import { pageParams, toPage } from "./paging";
import { reportTargets } from "./reportTargets";
import { actionFailure, actorOf, badCursor, paramId } from "./respond";

const notFound = { error: "not_found" } as const;

/**
 * Moderation for mods and admins. The server is the real guard: every route needs the mod role, and
 * every action also checks who it may act on (see `canActOn`). User lists carry the public handle and
 * state only. The ID-conflict lookup is the one response here that names a student ID. Nothing in this
 * file reads attempts, CGPA or routine data.
 */
export const modRoutes = new Hono<AppEnv>()
  .use(requireRole("mod"))
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
    // One label lookup per target type, so a page costs a query per type, not per row.
    const labels = new Map<string, string>();
    for (const [type, target] of Object.entries(reportTargets)) {
      const ids = page.items.filter((r) => r.targetType === type).map((r) => Number(r.targetId));
      for (const [id, label] of await target.labels(db, ids)) labels.set(`${type}:${id}`, label);
    }
    return c.json({
      items: page.items.map((r) => ({
        id: r.id,
        targetType: r.targetType as "user",
        targetId: r.targetId,
        targetLabel: labels.get(`${r.targetType}:${r.targetId}`) ?? null,
        reporter: r.reporter,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        resolveNote: r.resolveNote,
      })),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof modReportPage>);
  })
  .post("/reports/:id/resolve", validateJson(resolveReportRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json(notFound, 404);
    const { outcome, note } = c.req.valid("json");
    const result = await resolveReport(getDb(c.env.DB), actorOf(c), id, outcome, note ?? null);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  });
