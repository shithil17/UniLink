import { describe, expect, it } from "vite-plus/test";
import { limits } from "../limits";
import { canPost } from "./canPost";

describe("canPost", () => {
  const createdAt = 1_000_000;

  it("blocks a new account until the cooldown from created_at has passed", () => {
    const result = canPost({ createdAt }, createdAt + limits.newAccountCooldownMs - 1);
    expect(result).toEqual({ ok: false, retryAfterMs: 1 });
    expect(canPost({ createdAt }, createdAt)).toEqual({
      ok: false,
      retryAfterMs: limits.newAccountCooldownMs,
    });
  });

  it("allows posting once the cooldown has passed", () => {
    expect(canPost({ createdAt }, createdAt + limits.newAccountCooldownMs)).toEqual({ ok: true });
  });
});
