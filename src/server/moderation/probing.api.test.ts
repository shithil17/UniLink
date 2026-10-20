import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { getDb } from "../db/client";
import { limits } from "../limits";
import { usersRepo } from "../repos/users";
import { createTestUser } from "../test/factories";
import { mayPost, recordRejection } from "./probing";

const db = () => getDb(env.DB);
const HOUR = 60 * 60 * 1000;
// Mid-window, so three hits in a row land in one fixed window.
const T0 = 1_000 * HOUR + 10 * 60 * 1000;
const OLD_ACCOUNT = 0;

let user: Awaited<ReturnType<typeof createTestUser>>;

beforeEach(async () => {
  for (const table of ["rate_limits", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  user = await createTestUser(db(), { createdAt: OLD_ACCOUNT });
});

describe("recordRejection", () => {
  it("does nothing for the first two rejections in an hour", async () => {
    expect(await recordRejection(db(), user.id, T0)).toBe(false);
    expect(await recordRejection(db(), user.id, T0 + 1000)).toBe(false);
    expect(await usersRepo(db()).probingState(user.id)).toEqual({
      postingBlockedUntil: null,
      probingFlaggedAt: null,
    });
    expect(await mayPost(db(), user, T0 + 2000)).toEqual({ ok: true });
  });

  it("starts a one-hour cooldown and a persistent flag on the third", async () => {
    await recordRejection(db(), user.id, T0);
    await recordRejection(db(), user.id, T0 + 1000);
    expect(await recordRejection(db(), user.id, T0 + 2000)).toBe(true);

    expect(await usersRepo(db()).probingState(user.id)).toEqual({
      postingBlockedUntil: T0 + 2000 + limits.probing.cooldownMs,
      probingFlaggedAt: T0 + 2000,
    });
    expect(await mayPost(db(), user, T0 + 3000)).toEqual({
      ok: false,
      reason: "cooldown",
      retryAfterMs: limits.probing.cooldownMs - 1000,
    });
  });

  it("lets the user post again after the cooldown, but the flag stays", async () => {
    for (let i = 0; i < limits.probing.rejections; i++)
      await recordRejection(db(), user.id, T0 + i);
    const after = T0 + limits.probing.rejections + limits.probing.cooldownMs;
    expect(await mayPost(db(), user, after)).toEqual({ ok: true });
    expect((await usersRepo(db()).probingState(user.id))?.probingFlaggedAt).not.toBeNull();
  });

  it("counts each user on their own", async () => {
    const other = await createTestUser(db(), { createdAt: OLD_ACCOUNT });
    await recordRejection(db(), user.id, T0);
    await recordRejection(db(), user.id, T0 + 1);
    await recordRejection(db(), other.id, T0 + 2);
    expect(await mayPost(db(), other, T0 + 3)).toEqual({ ok: true });
  });
});

describe("mayPost", () => {
  it("keeps the new-account wait from canPost", async () => {
    const fresh = { id: user.id, createdAt: T0 };
    expect(await mayPost(db(), fresh, T0 + 1)).toMatchObject({ ok: false, reason: "new_account" });
  });
});
