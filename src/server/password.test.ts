import { describe, expect, it } from "vite-plus/test";
import { timingSafeEqual } from "./crypto";
import { limits } from "./limits";
import { hashPassword, needsRehash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("uses 100,000 iterations and stores algorithm and iterations with the hash", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored.iterations).toBe(100_000);
    expect(stored.iterations).toBe(limits.pbkdf2Iterations);
    expect(stored.algo).toBe("pbkdf2-sha256");
    expect(stored.hash).not.toContain("correct horse");
  });

  it("verifies the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("wrong horse", stored)).toBe(false);
  });

  it("uses a fresh salt per hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it("verifies with the stored iteration count, and flags old ones for rehash", async () => {
    const old = await hashPassword("pw", 1000);
    expect(await verifyPassword("pw", old)).toBe(true);
    expect(needsRehash(old)).toBe(true);
    expect(needsRehash(await hashPassword("pw"))).toBe(false);
  });

  it("refuses an unknown algorithm", async () => {
    const stored = await hashPassword("pw");
    expect(await verifyPassword("pw", { ...stored, algo: "md5" })).toBe(false);
  });
});

describe("timingSafeEqual", () => {
  it("compares content and length", () => {
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true);
    expect(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false);
    expect(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 0]))).toBe(false);
  });
});
