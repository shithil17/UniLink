import { pushOk, pushPublicKey, pushSubscriptionInput } from "../../shared/schemas/push";
import { apiGet, apiPost } from "./api";
import { isIos, readInstallHintEnv } from "./installHint";

/**
 * How the "Notifications on this device" switch should look.
 * - unsupported: this browser cannot do web push
 * - needs-install: iOS only delivers push to an app added to the Home Screen
 * - denied: the browser's own setting blocks notifications for this site
 * - off / on: the switch position
 */
export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

export type PushEnv = {
  userAgent: string;
  maxTouchPoints?: number;
  standalone: boolean;
  /** `'PushManager' in window && 'serviceWorker' in navigator && 'Notification' in window`. */
  supported: boolean;
  permission: NotificationPermission;
  /** The browser holds a push subscription for this app. */
  subscribed: boolean;
};

// ceiling: logging out must not hang on a slow network. Past this the device keeps its subscription
// until the server drops it (a failed send) or the next login moves it. Revisit if stale devices pile up.
export const PUSH_LOGOUT_TIMEOUT_MS = 3000;

/** Pure: the switch state for a device. iOS outside the installed app is checked first because Safari hides `PushManager` there. */
export function decidePushState(env: PushEnv): PushState {
  if (isIos(env.userAgent, env.maxTouchPoints) && !env.standalone) return "needs-install";
  if (!env.supported) return "unsupported";
  if (env.permission === "denied") return "denied";
  return env.subscribed && env.permission === "granted" ? "on" : "off";
}

export function pushSupported(): boolean {
  return "PushManager" in window && "serviceWorker" in navigator && "Notification" in window;
}

/** Base64url (the VAPID public key) to the bytes `pushManager.subscribe` wants. */
export function keyToBytes(key: string): Uint8Array<ArrayBuffer> {
  const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

/** Reads this device's state from the browser. Never touches the network. */
export async function readPushState(): Promise<PushState> {
  const install = readInstallHintEnv();
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return decidePushState({
    userAgent: install.userAgent,
    maxTouchPoints: install.maxTouchPoints,
    standalone: install.standalone,
    // No registered service worker (dev, first visit) means there is nothing to subscribe with.
    supported: reg !== null,
    permission: pushSupported() ? Notification.permission : "default",
    subscribed: sub != null,
  });
}

/** The server's VAPID public key, or null while push is not configured. */
export async function fetchPublicKey(): Promise<string | null> {
  return (await apiGet("/api/push/public-key", pushPublicKey)).key;
}

export type EnableResult = "on" | "denied" | "unavailable";

/**
 * Turns notifications on for this device. Call it straight from the tap: the permission prompt
 * needs a user gesture, so it comes before any network call.
 */
export async function enablePush(): Promise<EnableResult> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  const key = await fetchPublicKey();
  if (!key) return "unavailable";
  const reg = await navigator.serviceWorker.ready;
  const options = { userVisibleOnly: true, applicationServerKey: keyToBytes(key) };
  let sub: PushSubscription;
  try {
    sub = await reg.pushManager.subscribe(options);
  } catch (err) {
    // A subscription made with another server key blocks a new one: drop it and try once more.
    if (!(err instanceof DOMException) || err.name !== "InvalidStateError") throw err;
    await (await reg.pushManager.getSubscription())?.unsubscribe();
    sub = await reg.pushManager.subscribe(options);
  }
  try {
    await apiPost("/api/push/subscribe", pushOk, pushSubscriptionInput.parse(sub.toJSON()));
  } catch (err) {
    // The server never heard of it, so don't leave a browser subscription it cannot use.
    await sub.unsubscribe().catch(() => undefined);
    throw err;
  }
  return "on";
}

/** Turns notifications off for this device: tell the server first, then drop the browser subscription. */
export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  await apiPost("/api/push/unsubscribe", pushOk, { endpoint: sub.endpoint });
  await sub.unsubscribe();
}

/**
 * Best effort for logout: switch this device off while the session still works. Any failure or a
 * slow network is ignored so it can never block logging out.
 */
export async function disablePushBeforeLogout(): Promise<void> {
  try {
    await Promise.race([
      disablePush(),
      new Promise<void>((resolve) => setTimeout(resolve, PUSH_LOGOUT_TIMEOUT_MS)),
    ]);
  } catch {
    // Nothing to do: the user is logging out either way.
  }
}
