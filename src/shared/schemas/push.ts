import { z } from "zod";

// ceiling: real push endpoints are a few hundred characters (FCM, Apple, Mozilla, WNS). This bounds
// what one row can hold. Revisit if a push service starts issuing longer endpoints.
export const PUSH_ENDPOINT_MAX = 1024;

const base64Url = /^[A-Za-z0-9_-]+$/;

/** What `PushSubscription.toJSON()` gives the browser; keys are base64url without padding. */
export const pushSubscriptionInput = z.object({
  endpoint: z
    .url({ protocol: /^https$/, error: "That push address is not valid." })
    .max(PUSH_ENDPOINT_MAX),
  keys: z.object({
    // ceiling: a P-256 public key is 65 bytes (87 base64url chars); an auth secret is 16 bytes (22).
    p256dh: z.string().regex(base64Url).max(128),
    auth: z.string().regex(base64Url).max(64),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionInput>;

export const pushUnsubscribeInput = z.object({
  endpoint: z.string().max(PUSH_ENDPOINT_MAX),
});

/** The server's VAPID public key (base64url), or null while push is not configured. */
export const pushPublicKey = z.object({ key: z.string().nullable() });

/** The JSON a push carries: only server-built text and a link, never payload values or names. */
export const pushMessage = z.object({
  title: z.string(),
  body: z.string(),
  url: z.string().startsWith("/"),
});
export type PushMessage = z.infer<typeof pushMessage>;

export const pushOk = z.object({ ok: z.literal(true) });
