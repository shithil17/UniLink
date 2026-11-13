import { Hono } from "hono";
import { getDb } from "../../db/client";
import { requireUser } from "../../middleware/auth";
import { rateLimitedResponse } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { askModerator } from "../../moderation/appeal";

/**
 * Actions on a user's own post that work the same for every post type, keyed by the type's name in the
 * moderated post registry (`resource_request`, later `ride` and so on).
 */
export const postRoutes = new Hono<AppEnv>()
  .use(requireUser)
  // "Ask a moderator to look": the author sends their own rejected post to the review queue.
  .post("/:type/:id/appeal", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: "not_found" }, 404);
    const result = await askModerator(getDb(c.env.DB), {
      userId: user.id,
      targetType: c.req.param("type"),
      targetId: id,
    });
    if (result.ok) return c.json({ ok: true });
    if (result.reason === "rate_limited") {
      return rateLimitedResponse(c, {
        allowed: false,
        count: 0,
        retryAfterMs: result.retryAfterMs,
      });
    }
    if (result.reason === "not_rejected") {
      return c.json(
        { error: "not_rejected", message: "Only a post a moderator turned down can be sent back." },
        409,
      );
    }
    return c.json({ error: "not_found" }, 404);
  });
