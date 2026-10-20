import { buildPushPayload } from "@block65/webcrypto-web-push";
import type { PushMessage } from "../../shared/schemas/push";
import { limits } from "../limits";

/** One device's subscription as stored. */
export type PushTarget = { endpoint: string; p256dh: string; auth: string };

/** `gone` means the push service says the subscription no longer exists (404 or 410): delete it. */
export type PushResult = { ok: true } | { ok: false; gone: boolean };

/** Delivers one push message to one device. Never throws for a delivery failure. */
export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<PushResult>;
}

// Only well-known push services are accepted as endpoints, so a subscription cannot make the Worker
// call an arbitrary host.
const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
];
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

/** True for an https endpoint on a known push service host. */
export function isKnownPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

export type PushEnv = {
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

/**
 * The real sender: VAPID (RFC 8292) and aes128gcm encryption (RFC 8291) with WebCrypto, through
 * `fetch`. `fetchImpl` is only swapped in tests.
 */
export function webPushSender(
  vapid: { publicKey: string; privateKey: string; subject: string },
  fetchImpl: typeof fetch = fetch,
): PushSender {
  return {
    async send(target, message) {
      try {
        const payload = await buildPushPayload(
          { data: message, options: { ttl: limits.pushTtlSeconds, urgency: "normal" } },
          {
            endpoint: target.endpoint,
            expirationTime: null,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          vapid,
        );
        const res = await fetchImpl(target.endpoint, payload);
        // Drain the body so the connection is released.
        await res.body?.cancel();
        if (res.ok) return { ok: true };
        return { ok: false, gone: res.status === 404 || res.status === 410 };
      } catch {
        return { ok: false, gone: false };
      }
    },
  };
}

/** The sender for this deployment, or null when the VAPID secrets are not all set (push is off). */
export function pushSenderFromEnv(env: PushEnv): PushSender | null {
  const {
    VAPID_PUBLIC_KEY: publicKey,
    VAPID_PRIVATE_KEY: privateKey,
    VAPID_SUBJECT: subject,
  } = env;
  if (!publicKey || !privateKey || !subject) return null;
  return webPushSender({ publicKey, privateKey, subject });
}

/**
 * A sender for tests: records every send and answers `ok` unless `respond` says otherwise.
 * `respond` may also throw, to test a sender that blows up.
 */
export function fakePushSender(respond?: (target: PushTarget) => PushResult): PushSender & {
  sent: { target: PushTarget; message: PushMessage }[];
} {
  const sent: { target: PushTarget; message: PushMessage }[] = [];
  return {
    sent,
    async send(target, message) {
      sent.push({ target, message });
      return respond ? respond(target) : { ok: true };
    },
  };
}
