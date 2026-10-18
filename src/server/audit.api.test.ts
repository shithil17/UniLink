import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { audit } from "./audit";
import { getDb } from "./db/client";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM audit_log").run();
});

describe("audit()", () => {
  it("writes the actor, target, before-snapshot and reason", async () => {
    await audit(
      getDb(env.DB),
      {
        actor: 7,
        action: "ban",
        targetType: "user",
        targetId: 9,
        before: { role: "student", bannedAt: null },
        reason: "spam",
      },
      123,
    );
    const row = await env.DB.prepare("SELECT * FROM audit_log").first();
    expect(row).toMatchObject({
      actor: "7",
      action: "ban",
      target_type: "user",
      target_id: "9",
      before: '{"role":"student","bannedAt":null}',
      reason: "spam",
      created_at: 123,
    });
  });

  it("accepts automatic actors and no snapshot", async () => {
    await audit(getDb(env.DB), {
      actor: "automod",
      action: "hold",
      targetType: "ride",
      targetId: "3",
    });
    const row = await env.DB.prepare("SELECT actor, before, reason FROM audit_log").first();
    expect(row).toEqual({ actor: "automod", before: null, reason: null });
  });
});
