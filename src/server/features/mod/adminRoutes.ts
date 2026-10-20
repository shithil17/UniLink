import { Hono, type Context } from "hono";
import type { z } from "zod";
import { reversibleActions } from "../../../shared/auditActions";
import {
  auditQuery,
  reasonBody,
  roleChangeRequest,
  type auditPage,
  type reverseResult,
} from "../../../shared/schemas/moderation";
import { getDb } from "../../db/client";
import { requireRole } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { auditLogRepo } from "../../repos/auditLog";
import { curriculaRepo } from "../../repos/curricula";
import { facultyRepo } from "../../repos/faculty";
import { usersRepo } from "../../repos/users";
import { reverse, type ReverseFailure } from "../../reverse";
import { validateJson, validateQuery } from "../../validate";
import { changeRole } from "./actions";
import { pageParams, toPage } from "./paging";
import { actionFailure, actorOf, badCursor, paramId } from "./respond";

const REVERSE_FAILURES: Record<ReverseFailure, { status: 403 | 404 | 409; message: string }> = {
  not_found: { status: 404, message: "That log entry does not exist." },
  not_reversible: { status: 409, message: "That action can't be reversed." },
  is_reversal: {
    status: 409,
    message: "That entry is already a reversal. Repeat the original action instead.",
  },
  already_reversed: { status: 409, message: "That action was already reversed." },
  target_missing: { status: 409, message: "What it changed no longer exists." },
  target_protected: {
    status: 403,
    message: "That account is an admin now, so it can't be changed.",
  },
  key_in_use: {
    status: 409,
    message: "Someone has taken that student ID since, so it can't be restored.",
  },
  value_in_use: {
    status: 409,
    message:
      "Something else has taken those values since (initials, a name or a course code), or a course depends on them, so it can't be restored.",
  },
};

function reverseFailure(c: Context, reason: ReverseFailure) {
  const { status, message } = REVERSE_FAILURES[reason];
  return c.json({ error: reason, message }, status);
}

/** Admin-only: manage mods, read the audit log and reverse logged actions. */
export const adminRoutes = new Hono<AppEnv>()
  .use(requireRole("admin"))
  .post("/users/:id/role", validateJson(roleChangeRequest), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const { role, reason } = c.req.valid("json");
    const result = await changeRole(getDb(c.env.DB), actorOf(c), id, role, reason);
    return result.ok ? c.json({ ok: true }) : actionFailure(c, result.reason);
  })
  .get("/audit", validateQuery(auditQuery), async (c) => {
    const { cursor, limit, ...filter } = c.req.valid("query");
    const params = pageParams({ cursor, limit });
    if (!params) return badCursor(c);
    const db = getDb(c.env.DB);
    const log = auditLogRepo(db);
    const page = toPage(await log.listPage(filter, params.size + 1, params.cursor), params.size);

    // Names for the actors and user targets on this page, and which rows already have a reversal.
    const userIds = page.items.flatMap((r) => [
      ...(/^\d+$/.test(r.actor) ? [Number(r.actor)] : []),
      ...(r.targetType === "user" && /^\d+$/.test(r.targetId) ? [Number(r.targetId)] : []),
    ]);
    const names = await usersRepo(db).usernamesByIds(userIds);
    const facultyNames = await facultyRepo(db).labelsByIds(
      page.items.flatMap((r) =>
        r.targetType === "faculty" && /^\d+$/.test(r.targetId) ? [Number(r.targetId)] : [],
      ),
    );
    const courseLabels = await curriculaRepo(db).courseLabelsByIds(
      page.items.flatMap((r) =>
        r.targetType === "course" && /^\d+$/.test(r.targetId) ? [Number(r.targetId)] : [],
      ),
    );
    const reversals = await log.reversalsOf(page.items.map((r) => r.id));
    const nameOf = (id: string) => names.get(Number(id)) ?? `user #${id}`;

    return c.json({
      items: page.items.map((r) => {
        const reversedBy = reversals.get(r.id) ?? null;
        return {
          id: r.id,
          actor: /^\d+$/.test(r.actor) ? nameOf(r.actor) : r.actor,
          action: r.action,
          targetType: r.targetType,
          targetId: r.targetId,
          targetLabel:
            r.targetType === "user" && /^\d+$/.test(r.targetId)
              ? nameOf(r.targetId)
              : r.targetType === "faculty"
                ? (facultyNames.get(Number(r.targetId))?.name ?? null)
                : r.targetType === "course"
                  ? (courseLabels.get(Number(r.targetId))?.code ?? null)
                  : null,
          reason: r.reason,
          createdAt: r.createdAt,
          reverses: r.reversesId,
          reversedBy,
          reversible:
            reversibleActions.includes(r.action) && r.reversesId === null && reversedBy === null,
        };
      }),
      nextCursor: page.nextCursor,
    } satisfies z.infer<typeof auditPage>);
  })
  .post("/audit/:id/reverse", validateJson(reasonBody), async (c) => {
    const id = paramId(c);
    if (id === null) return c.json({ error: "not_found" }, 404);
    const result = await reverse(getDb(c.env.DB), {
      auditId: id,
      actor: actorOf(c).id,
      reason: c.req.valid("json").reason,
    });
    if (!result.ok) return reverseFailure(c, result.reason);
    return c.json({ id: result.id } satisfies z.infer<typeof reverseResult>, 201);
  });
