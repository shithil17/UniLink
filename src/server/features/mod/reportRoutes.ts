import { Hono } from "hono";
import type { z } from "zod";
import { reportRequest, type reportCreated } from "../../../shared/schemas/moderation";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import { rateLimit, rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { reportsRepo } from "../../repos/reports";
import { validateJson } from "../../validate";
import { reportTargets } from "./reportTargets";

/**
 * Any signed-in user can report something. The limit is checked first, then the target must exist
 * and not be the reporter's own, and a second open report on the same target is a 409.
 * Report reasons are not screened yet: `screen()` arrives with the screening pipeline, and the reason
 * is only ever shown to mods.
 */
export const reportRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .post("/", validateJson(reportRequest), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);

    const hit = await rateLimit(
      db,
      `report:user:${user.id}`,
      limits.reportCreate.limit,
      limits.reportCreate.windowMs,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const target = await reportTargets[body.targetType].find(db, body.targetId);
    if (!target) return c.json({ error: "not_found", message: "That can't be found." }, 404);
    if (target.ownerId === user.id) {
      return c.json(
        { error: "own_target", message: "You can't report yourself or your own post." },
        400,
      );
    }

    const created = await reportsRepo(db).create({
      targetType: body.targetType,
      targetId: String(body.targetId),
      reporterId: user.id,
      reason: body.reason,
      createdAt: Date.now(),
    });
    if (!created.ok) {
      return c.json({ error: "already_reported", message: "You already reported this." }, 409);
    }
    return c.json({ id: created.id } satisfies z.infer<typeof reportCreated>, 201);
  });
