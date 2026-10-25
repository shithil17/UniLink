import { env } from "cloudflare:workers";
import { describe, expect, it } from "vite-plus/test";
import { notificationPage, notification, unreadCount } from "../../../shared/schemas/inbox";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { notifications } from "../../db/schema";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { notify } from "../../notify";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);

async function call(method: string, path: string, token: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.cookie = `${SESSION_COOKIE}=${token}`;
  return app.request(path, { method, headers }, env);
}

async function signedIn() {
  const user = await createTestUser(db());
  return { user, token: await createTestSession(db(), user.id) };
}

const inbox = async (token: string, query = "") =>
  notificationPage.parse(await (await call("GET", `/api/inbox${query}`, token)).json());
const unread = async (token: string) =>
  unreadCount.parse(await (await call("GET", "/api/inbox/unread-count", token)).json()).count;

describe("notify()", () => {
  it("writes one row per target and ignores duplicate ids", async () => {
    const a = await createTestUser(db());
    const b = await createTestUser(db());
    await notify(db(), [a.id, b.id, a.id], "post_approved", { title: "Hello" }, { now: 1000 });

    const rows = await db().select().from(notifications);
    const mine = rows.filter((r) => r.userId === a.id || r.userId === b.id);
    expect(mine).toHaveLength(2);
    expect(mine[0]).toMatchObject({ type: "post_approved", payload: { title: "Hello" } });
    expect(mine[0]?.readAt).toBeNull();
    expect(mine[0]?.createdAt).toBe(1000);
  });

  it("does nothing for an empty list", async () => {
    const before = (await db().select().from(notifications)).length;
    await notify(db(), [], "post_approved", {});
    expect((await db().select().from(notifications)).length).toBe(before);
  });

  it("fits a batch larger than one chunk under the bound-parameter cap", async () => {
    const total = limits.notifyChunkRows * 2 + 3;
    const users = [];
    for (let i = 0; i < total; i += 1) users.push(await createTestUser(db()));
    await notify(
      db(),
      users.map((u) => u.id),
      "resource_requested",
      {},
    );
    for (const u of [users[0], users[limits.notifyChunkRows], users[total - 1]]) {
      const token = await createTestSession(db(), u!.id);
      expect(await unread(token)).toBe(1);
    }
  });

  it("keeps a chunk within the D1 parameter cap", () => {
    expect(limits.notifyChunkRows * 6).toBeLessThanOrEqual(limits.d1MaxBoundParams);
  });

  it("rejects an unknown type", async () => {
    const u = await createTestUser(db());
    await expect(notify(db(), [u.id], "nope" as never, {})).rejects.toThrow();
  });
});

describe("GET /api/inbox", () => {
  it("requires a signed-in user", async () => {
    expect((await call("GET", "/api/inbox", null)).status).toBe(401);
    expect((await call("GET", "/api/inbox/unread-count", null)).status).toBe(401);
    expect((await call("POST", "/api/inbox/1/read", null)).status).toBe(401);
    expect((await call("POST", "/api/inbox/read-all", null)).status).toBe(401);
  });

  it("shows a user only their own notifications, newest first", async () => {
    const a = await signedIn();
    const b = await signedIn();
    await notify(db(), [a.user.id], "post_approved", { n: 1 }, { now: 1 });
    await notify(db(), [b.user.id], "post_rejected", { n: 2 }, { now: 2 });
    await notify(db(), [a.user.id], "resource_accepted", { n: 3 }, { now: 3 });

    const page = await inbox(a.token);
    expect(page.items.map((i) => i.payload.n)).toEqual([3, 1]);
    expect(page.nextCursor).toBeNull();
    expect((await inbox(b.token)).items.map((i) => i.payload.n)).toEqual([2]);
  });

  it("pages with a cursor and finishes with a null cursor", async () => {
    const a = await signedIn();
    for (let n = 1; n <= 5; n += 1) await notify(db(), [a.user.id], "post_approved", { n });

    const first = await inbox(a.token, "?limit=2");
    expect(first.items.map((i) => i.payload.n)).toEqual([5, 4]);
    expect(first.nextCursor).not.toBeNull();
    const second = await inbox(a.token, `?limit=2&cursor=${first.nextCursor}`);
    expect(second.items.map((i) => i.payload.n)).toEqual([3, 2]);
    const third = await inbox(a.token, `?limit=2&cursor=${second.nextCursor}`);
    expect(third.items.map((i) => i.payload.n)).toEqual([1]);
    expect(third.nextCursor).toBeNull();
  });

  it("caps the page size and rejects a bad cursor", async () => {
    const a = await signedIn();
    const rows = Array.from({ length: limits.inboxPage.maxSize + 1 }, (_, n) => ({
      userId: a.user.id,
      type: "post_approved",
      payload: { n },
      createdAt: n,
    }));
    for (let i = 0; i < rows.length; i += limits.notifyChunkRows)
      await db()
        .insert(notifications)
        .values(rows.slice(i, i + limits.notifyChunkRows));
    const page = await inbox(a.token, "?limit=100000");
    expect(page.items).toHaveLength(limits.inboxPage.maxSize);
    expect(page.nextCursor).not.toBeNull();
    expect((await call("GET", "/api/inbox?cursor=abc", a.token)).status).toBe(400);
  });
});

describe("unread count and mark read", () => {
  it("counts unread rows and drops them as they are read", async () => {
    const a = await signedIn();
    await notify(db(), [a.user.id], "post_approved", {});
    await notify(db(), [a.user.id], "post_rejected", {});
    expect(await unread(a.token)).toBe(2);

    const [first] = (await inbox(a.token)).items;
    const res = await call("POST", `/api/inbox/${first!.id}/read`, a.token);
    expect(res.status).toBe(200);
    expect(notification.parse(await res.json()).readAt).not.toBeNull();
    expect(await unread(a.token)).toBe(1);
  });

  it("is idempotent and keeps the first read time", async () => {
    const a = await signedIn();
    await notify(db(), [a.user.id], "post_approved", {});
    const [item] = (await inbox(a.token)).items;
    const one = notification.parse(
      await (await call("POST", `/api/inbox/${item!.id}/read`, a.token)).json(),
    );
    await new Promise((r) => setTimeout(r, 5));
    const two = await call("POST", `/api/inbox/${item!.id}/read`, a.token);
    expect(two.status).toBe(200);
    expect(notification.parse(await two.json()).readAt).toBe(one.readAt);
    expect(await unread(a.token)).toBe(0);
  });

  it("answers 404 for another user's id and for a missing id, and changes nothing", async () => {
    const a = await signedIn();
    const b = await signedIn();
    await notify(db(), [a.user.id], "post_approved", {});
    const [item] = (await inbox(a.token)).items;

    const other = await call("POST", `/api/inbox/${item!.id}/read`, b.token);
    expect(other.status).toBe(404);
    expect(await other.json()).toMatchObject({ error: "not_found" });
    expect((await call("POST", "/api/inbox/99999999/read", b.token)).status).toBe(404);
    expect((await call("POST", "/api/inbox/abc/read", b.token)).status).toBe(404);
    expect(await unread(a.token)).toBe(1);
  });

  it("read-all only touches the caller's rows", async () => {
    const a = await signedIn();
    const b = await signedIn();
    await notify(db(), [a.user.id, b.user.id], "post_approved", {});
    await notify(db(), [a.user.id], "post_rejected", {});

    const res = await call("POST", "/api/inbox/read-all", a.token);
    expect(await res.json()).toEqual({ updated: 2 });
    expect(await unread(a.token)).toBe(0);
    expect(await unread(b.token)).toBe(1);
    expect(await (await call("POST", "/api/inbox/read-all", a.token)).json()).toEqual({
      updated: 0,
    });
  });
});
