import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import { notificationCopy } from "../../../shared/notificationCopy";
import { pushMessage, pushPublicKey } from "../../../shared/schemas/push";
import { fakePushSender, type PushSender } from "../../adapters/push";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { notifications, pushSubscriptions } from "../../db/schema";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { notify } from "../../notify";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);

async function call(method: string, path: string, token: string | null, body?: unknown, e = env) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  return app.request(
    path,
    { method, headers, body: body === undefined ? undefined : JSON.stringify(body) },
    e,
  );
}

async function signedIn() {
  const user = await createTestUser(db());
  return { user, token: await createTestSession(db(), user.id) };
}

let n = 0;
const subBody = (
  endpoint = `https://fcm.googleapis.com/fcm/send/dev-${(n += 1)}-${Math.random()}`,
) => ({
  endpoint,
  keys: { p256dh: "BPk-test_p256dh", auth: "test_auth" },
});

const subscribe = (token: string | null, body: unknown = subBody()) =>
  call("POST", "/api/push/subscribe", token, body);

const rowsFor = (userId: number) =>
  db().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));

describe("POST /api/push/subscribe and /unsubscribe", () => {
  it("requires a signed-in user", async () => {
    expect((await subscribe(null)).status).toBe(401);
    expect((await call("POST", "/api/push/unsubscribe", null, { endpoint: "x" })).status).toBe(401);
    expect((await call("GET", "/api/push/public-key", null)).status).toBe(401);
  });

  it("stores a device, then removes it, and removing twice is fine", async () => {
    const a = await signedIn();
    const body = subBody();
    expect((await subscribe(a.token, body)).status).toBe(200);
    expect(await rowsFor(a.user.id)).toMatchObject([
      { endpoint: body.endpoint, p256dh: body.keys.p256dh, auth: body.keys.auth },
    ]);

    const off = { endpoint: body.endpoint };
    expect((await call("POST", "/api/push/unsubscribe", a.token, off)).status).toBe(200);
    expect(await rowsFor(a.user.id)).toHaveLength(0);
    expect((await call("POST", "/api/push/unsubscribe", a.token, off)).status).toBe(200);
  });

  it("subscribing the same endpoint twice keeps one row", async () => {
    const a = await signedIn();
    const body = subBody();
    await subscribe(a.token, body);
    expect((await subscribe(a.token, body)).status).toBe(200);
    expect(await rowsFor(a.user.id)).toHaveLength(1);
  });

  it("moves an endpoint to the user who subscribes it next", async () => {
    const a = await signedIn();
    const b = await signedIn();
    const body = subBody();
    await subscribe(a.token, body);
    expect(
      (await subscribe(b.token, { ...body, keys: { p256dh: "new_p", auth: "new_a" } })).status,
    ).toBe(200);

    expect(await rowsFor(a.user.id)).toHaveLength(0);
    expect(await rowsFor(b.user.id)).toMatchObject([
      { endpoint: body.endpoint, p256dh: "new_p", auth: "new_a" },
    ]);
  });

  it("unsubscribe only removes the caller's own row", async () => {
    const a = await signedIn();
    const b = await signedIn();
    const body = subBody();
    await subscribe(a.token, body);
    expect(
      (await call("POST", "/api/push/unsubscribe", b.token, { endpoint: body.endpoint })).status,
    ).toBe(200);
    expect(await rowsFor(a.user.id)).toHaveLength(1);
  });

  it("rejects a host that is not a known push service", async () => {
    const a = await signedIn();
    const res = await subscribe(a.token, subBody("https://example.com/push/abc"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "unknown_push_service" });
    expect(await rowsFor(a.user.id)).toHaveLength(0);
  });

  it("rejects a malformed body and a plain-http endpoint", async () => {
    const a = await signedIn();
    expect((await subscribe(a.token, { endpoint: "https://fcm.googleapis.com/x" })).status).toBe(
      400,
    );
    expect((await subscribe(a.token, subBody("http://fcm.googleapis.com/x"))).status).toBe(400);
    expect((await subscribe(a.token, subBody("nonsense"))).status).toBe(400);
  });

  it("holds the per-user cap, still lets an existing device refresh, and frees a slot on unsubscribe", async () => {
    const a = await signedIn();
    const bodies = Array.from({ length: limits.pushSubscriptionsMax }, () => subBody());
    for (const b of bodies) expect((await subscribe(a.token, b)).status).toBe(200);

    const over = await subscribe(a.token, subBody());
    expect(over.status).toBe(409);
    expect(await over.json()).toMatchObject({ error: "push_subscription_limit" });
    expect(await rowsFor(a.user.id)).toHaveLength(limits.pushSubscriptionsMax);

    // Re-saving a device the user already has is not a new device.
    expect((await subscribe(a.token, bodies[0])).status).toBe(200);

    await call("POST", "/api/push/unsubscribe", a.token, { endpoint: bodies[0]!.endpoint });
    expect((await subscribe(a.token, subBody())).status).toBe(200);
  });

  it("the cap also applies when an endpoint moves in from another user", async () => {
    const a = await signedIn();
    const b = await signedIn();
    for (let i = 0; i < limits.pushSubscriptionsMax; i += 1) await subscribe(a.token);
    const stolen = subBody();
    await subscribe(b.token, stolen);
    expect((await subscribe(a.token, stolen)).status).toBe(409);
    expect(await rowsFor(b.user.id)).toHaveLength(1);
  });
});

describe("GET /api/push/public-key", () => {
  it("is null while push is not configured", async () => {
    const a = await signedIn();
    // Explicitly unset, so a developer's own .dev.vars cannot change the result.
    const unset = {
      ...env,
      VAPID_PUBLIC_KEY: undefined,
      VAPID_PRIVATE_KEY: undefined,
      VAPID_SUBJECT: undefined,
    };
    const res = await call("GET", "/api/push/public-key", a.token, undefined, unset);
    expect(pushPublicKey.parse(await res.json())).toEqual({ key: null });
  });

  it("is null when only some VAPID values are set, and the key when all three are", async () => {
    const a = await signedIn();
    const partial = {
      ...env,
      VAPID_PUBLIC_KEY: "pub",
      VAPID_PRIVATE_KEY: undefined,
      VAPID_SUBJECT: undefined,
    };
    expect(
      await (await call("GET", "/api/push/public-key", a.token, undefined, partial)).json(),
    ).toEqual({ key: null });
    const full = { ...partial, VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.c" };
    expect(
      await (await call("GET", "/api/push/public-key", a.token, undefined, full)).json(),
    ).toEqual({ key: "pub" });
  });
});

describe("notify() with push", () => {
  const SENTINEL = "SENTINEL-payload-text-7f3a";

  async function subscribed(count = 1) {
    const u = await signedIn();
    const endpoints: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const body = subBody();
      endpoints.push(body.endpoint);
      await subscribe(u.token, body);
    }
    return { ...u, endpoints };
  }

  it("pushes only to the targets' devices, with server-built text and no payload values", async () => {
    const target = await subscribed(2);
    const other = await subscribed();
    const fake = fakePushSender();

    await notify(
      db(),
      [target.user.id],
      "post_rejected",
      { title: SENTINEL, username: SENTINEL, nested: { text: SENTINEL } },
      { push: fake },
    );

    expect(fake.sent.map((s) => s.target.endpoint).sort()).toEqual([...target.endpoints].sort());
    expect(fake.sent.some((s) => s.target.endpoint === other.endpoints[0])).toBe(false);
    const copy = notificationCopy("post_rejected");
    for (const { message } of fake.sent) {
      expect(pushMessage.parse(message)).toEqual({
        title: copy.title,
        body: copy.detail,
        url: "/inbox",
      });
      expect(JSON.stringify(message)).not.toContain(SENTINEL);
    }
  });

  it("still writes the inbox row for a target with no device", async () => {
    const noDevice = await signedIn();
    const fake = fakePushSender();
    await notify(db(), [noDevice.user.id], "post_approved", {}, { push: fake });
    expect(fake.sent).toHaveLength(0);
    const rows = await db()
      .select()
      .from(notifications)
      .where(eq(notifications.userId, noDevice.user.id));
    expect(rows).toHaveLength(1);
  });

  it("does not push when no sender is given", async () => {
    const u = await subscribed();
    await notify(db(), [u.user.id], "post_approved", {}, { push: null });
    await notify(db(), [u.user.id], "post_approved", {});
    expect(await rowsFor(u.user.id)).toHaveLength(1);
  });

  it("deletes a subscription the push service reports gone, and keeps the others", async () => {
    const u = await subscribed(2);
    const [dead, alive] = u.endpoints;
    const fake = fakePushSender((t) =>
      t.endpoint === dead ? { ok: false, gone: true } : { ok: true },
    );
    await notify(db(), [u.user.id], "post_approved", {}, { push: fake });
    expect((await rowsFor(u.user.id)).map((r) => r.endpoint)).toEqual([alive]);
  });

  it("keeps a subscription after a failure that is not gone", async () => {
    const u = await subscribed();
    const fake = fakePushSender(() => ({ ok: false, gone: false }));
    await notify(db(), [u.user.id], "post_approved", {}, { push: fake });
    expect(await rowsFor(u.user.id)).toHaveLength(1);
  });

  it("never rejects when the sender throws, and the inbox rows are still written", async () => {
    const u = await subscribed(2);
    const throwing: PushSender = {
      async send() {
        throw new Error("push service exploded");
      },
    };
    await expect(
      notify(db(), [u.user.id], "post_approved", { n: 1 }, { push: throwing }),
    ).resolves.toBeUndefined();
    const rows = await db().select().from(notifications).where(eq(notifications.userId, u.user.id));
    expect(rows).toHaveLength(1);
    expect(await rowsFor(u.user.id)).toHaveLength(2);
  });

  it("sends at most pushFanoutMax pushes per call", async () => {
    const u = await signedIn();
    // Seed devices directly: the per-user cap would stop the API at five.
    const total = limits.pushFanoutMax + 5;
    for (let i = 0; i < total; i += 1) {
      await db()
        .insert(pushSubscriptions)
        .values({
          userId: u.user.id,
          endpoint: `https://fcm.googleapis.com/fcm/send/fan-${i}-${Math.random()}`,
          p256dh: "p",
          auth: "a",
          createdAt: 1,
        });
    }
    const fake = fakePushSender();
    await notify(db(), [u.user.id], "post_approved", {}, { push: fake });
    expect(fake.sent).toHaveLength(limits.pushFanoutMax);
  });
});
