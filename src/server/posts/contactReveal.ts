import type { Context } from "hono";
import type { z } from "zod";
import type { contactReveal } from "../../shared/schemas/common";
import { getDb } from "../db/client";
import { limits } from "../limits";
import { rateLimit, rateLimitedResponse } from "../middleware/rateLimit";
import type { AppEnv } from "../middleware/types";
import { postContactsRepo, type ContactPostTable } from "../repos/postContacts";

/**
 * The handler of `GET /api/<type>/:id/contact` for any post table with contacts:
 *
 *   typeRoutes.use(requireUser).get("/:id/contact", revealContact(rides))
 *
 * The router must sit behind `requireUser` (a login is needed, and a user who must change their
 * password is refused there). The hit is counted before the post is looked up, so a loop over ids is
 * limited too. A post the viewer may not see (held, rejected, deleted, expired) is a 404, the same as a
 * missing one. Returns the contacts and nothing else.
 */
export function revealContact(table: ContactPostTable) {
  return async (c: Context<AppEnv>) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: "not_found" }, 404);
    const db = getDb(c.env.DB);
    const now = Date.now();

    const hit = await rateLimit(
      db,
      `contact:reveal:${user.id}`,
      limits.contactReveal.limit,
      limits.contactReveal.windowMs,
      now,
    );
    if (!hit.allowed) return rateLimitedResponse(c, hit);

    const contacts = await postContactsRepo(db, table).find(
      id,
      { id: user.id, role: user.role },
      now,
    );
    if (!contacts) return c.json({ error: "not_found" }, 404);
    return c.json({ contacts } satisfies z.infer<typeof contactReveal>);
  };
}
