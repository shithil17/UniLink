import { Hono, type Context } from "hono";
import type { z } from "zod";
import {
  pushSubscriptionInput,
  pushUnsubscribeInput,
  type pushOk,
  type pushPublicKey,
} from "../../../shared/schemas/push";
import { isKnownPushEndpoint, pushSenderFromEnv } from "../../adapters/push";
import { audit } from "../../audit";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireRole, requireUser } from "../../middleware/auth";
import { rateLimitBy } from "../../middleware/rateLimit";
import type { AppEnv } from "../../middleware/types";
import { notify } from "../../notify";
import { pushSubscriptionsRepo } from "../../repos/pushSubscriptions";
import { validateJson } from "../../validate";

/** The signed-in user's id. `requireUser` runs first, so a missing user cannot happen. */
const userId = (c: Context<AppEnv>) => c.get("user")?.id ?? 0;

const ok = { ok: true } satisfies z.infer<typeof pushOk>;

export const pushRoutes = new Hono<AppEnv>()
  .use(requireUser)
  // Null while push is not configured, so the client can hide the switch.
  .get("/public-key", (c) => {
    const key = pushSenderFromEnv(c.env) ? (c.env.VAPID_PUBLIC_KEY ?? null) : null;
    return c.json({ key } satisfies z.infer<typeof pushPublicKey>);
  })
  .post(
    "/subscribe",
    rateLimitBy(
      (c) => `push-subscribe:${userId(c)}`,
      limits.pushSubscribe.limit,
      limits.pushSubscribe.windowMs,
    ),
    validateJson(pushSubscriptionInput),
    async (c) => {
      const { endpoint, keys } = c.req.valid("json");
      if (!isKnownPushEndpoint(endpoint)) {
        return c.json(
          {
            error: "unknown_push_service",
            message: "That browser's push service is not supported.",
          },
          400,
        );
      }
      const saved = await pushSubscriptionsRepo(getDb(c.env.DB)).upsert(
        userId(c),
        { endpoint, p256dh: keys.p256dh, auth: keys.auth },
        Date.now(),
      );
      if (!saved) {
        return c.json(
          {
            error: "push_subscription_limit",
            message: "Notifications are on for too many of your devices. Turn one off first.",
          },
          409,
        );
      }
      return c.json(ok);
    },
  )
  .post("/unsubscribe", validateJson(pushUnsubscribeInput), async (c) => {
    await pushSubscriptionsRepo(getDb(c.env.DB)).remove(userId(c), c.req.valid("json").endpoint);
    return c.json(ok);
  })
  // An admin sends one test notification to themself only (inbox row + push to their devices).
  .post(
    "/test",
    requireRole("admin"),
    rateLimitBy((c) => `push-test:${userId(c)}`, limits.pushTest.limit, limits.pushTest.windowMs),
    async (c) => {
      const push = pushSenderFromEnv(c.env);
      if (!push) {
        return c.json(
          { error: "push_not_configured", message: "Push is not set up on this server." },
          409,
        );
      }
      const db = getDb(c.env.DB);
      const me = userId(c);
      await notify(db, [me], "push_test", {}, { push });
      await audit(db, { actor: me, action: "push.test", targetType: "user", targetId: me });
      return c.json(ok);
    },
  );
