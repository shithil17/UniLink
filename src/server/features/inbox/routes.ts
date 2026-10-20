import { Hono, type Context } from "hono";
import { pageQuery } from "../../../shared/schemas/common";
import type {
  Notification,
  notificationPage,
  readAllResult,
  unreadCount,
} from "../../../shared/schemas/inbox";
import type { z } from "zod";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUser } from "../../middleware/auth";
import type { AppEnv } from "../../middleware/types";
import { notificationsRepo, type NotificationRow } from "../../repos/notifications";
import { validateQuery } from "../../validate";

const toNotification = (n: NotificationRow): Notification => ({
  id: n.id,
  type: n.type as Notification["type"],
  payload: n.payload,
  readAt: n.readAt,
  createdAt: n.createdAt,
});

/** The signed-in user's id. `requireUser` runs first, so a missing user cannot happen. */
const userId = (c: Context<AppEnv>) => c.get("user")?.id ?? 0;

const CURSOR = /^[1-9]\d{0,15}$/;

export const inboxRoutes = new Hono<AppEnv>()
  .use(requireUser)
  .get("/", validateQuery(pageQuery), async (c) => {
    const { cursor, limit } = c.req.valid("query");
    if (cursor !== undefined && !CURSOR.test(cursor)) {
      return c.json({ error: "invalid_request", message: "That page cursor is not valid." }, 400);
    }
    const size = Math.min(limit ?? limits.inboxPage.defaultSize, limits.inboxPage.maxSize);
    // One extra row tells whether another page exists without a second query.
    const rows = await notificationsRepo(getDb(c.env.DB)).listPage(
      userId(c),
      size + 1,
      cursor === undefined ? null : Number(cursor),
    );
    const items = rows.slice(0, size).map(toNotification);
    const last = items.at(-1);
    return c.json({
      items,
      nextCursor: rows.length > size && last ? String(last.id) : null,
    } satisfies z.infer<typeof notificationPage>);
  })
  .get("/unread-count", async (c) => {
    const count = await notificationsRepo(getDb(c.env.DB)).countUnread(userId(c));
    return c.json({ count } satisfies z.infer<typeof unreadCount>);
  })
  .post("/read-all", async (c) => {
    const updated = await notificationsRepo(getDb(c.env.DB)).markAllRead(userId(c), Date.now());
    return c.json({ updated } satisfies z.infer<typeof readAllResult>);
  })
  .post("/:id/read", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isSafeInteger(id) || id <= 0) return c.json({ error: "not_found" }, 404);
    const row = await notificationsRepo(getDb(c.env.DB)).markRead(userId(c), id, Date.now());
    if (!row) return c.json({ error: "not_found" }, 404);
    return c.json(toNotification(row));
  });
