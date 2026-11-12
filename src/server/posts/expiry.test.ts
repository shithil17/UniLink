import { describe, expect, it } from "vite-plus/test";
import { limits } from "../limits";
import { computeExpiresAt, isExpired, NOT_RENEWABLE, RENEWABLE, renewExpiresAt } from "./expiry";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 2026-11-12 10:00 in Dhaka.
const NOW = Date.UTC(2026, 10, 12, 4, 0, 0);

describe("computeExpiresAt", () => {
  it("expires at the given instant, such as a departure", () => {
    expect(computeExpiresAt({ at: NOW + 3 * HOUR }, NOW)).toEqual({
      ok: true,
      expiresAt: NOW + 3 * HOUR,
    });
  });

  it("refuses an instant that has passed, and one past the maximum", () => {
    expect(computeExpiresAt({ at: NOW }, NOW)).toEqual({ ok: false, reason: "in_past" });
    expect(computeExpiresAt({ at: NOW - HOUR }, NOW)).toEqual({ ok: false, reason: "in_past" });
    expect(computeExpiresAt({ at: NOW + limits.postExpiry.maxMs + 1 }, NOW)).toEqual({
      ok: false,
      reason: "too_far",
    });
    expect(computeExpiresAt({ at: NOW + limits.postExpiry.maxMs }, NOW).ok).toBe(true);
  });

  it("defaults to 60 days out", () => {
    expect(computeExpiresAt({ default: true }, NOW)).toEqual({
      ok: true,
      expiresAt: NOW + 60 * DAY,
    });
  });

  it("keeps a post live through its whole end date in Asia/Dhaka", () => {
    const result = computeExpiresAt({ throughDhakaDate: { year: 2026, month: 11, day: 20 } }, NOW);
    // The Dhaka day of 20 Nov ends at 2026-11-20 18:00 UTC.
    expect(result).toEqual({ ok: true, expiresAt: Date.UTC(2026, 10, 20, 18, 0, 0) });
    if (result.ok) {
      expect(isExpired(result.expiresAt, Date.UTC(2026, 10, 20, 17, 59, 59))).toBe(false);
      expect(isExpired(result.expiresAt, Date.UTC(2026, 10, 20, 18, 0, 0))).toBe(true);
    }
  });

  it("accepts today as an end date but not yesterday", () => {
    expect(computeExpiresAt({ throughDhakaDate: { year: 2026, month: 11, day: 12 } }, NOW).ok).toBe(
      true,
    );
    expect(computeExpiresAt({ throughDhakaDate: { year: 2026, month: 11, day: 11 } }, NOW)).toEqual(
      { ok: false, reason: "in_past" },
    );
  });
});

describe("renewExpiresAt", () => {
  it("refuses a post whose rule is not renewable (a one-off ride)", () => {
    expect(renewExpiresAt(NOT_RENEWABLE, NOW + DAY, NOW)).toEqual({
      ok: false,
      reason: "not_renewable",
    });
  });

  it("extends from the current expiry while the post is live", () => {
    expect(renewExpiresAt(RENEWABLE, NOW + 10 * DAY, NOW)).toEqual({
      ok: true,
      expiresAt: NOW + 10 * DAY + limits.postExpiry.renewExtendMs,
    });
  });

  it("starts from now once the post has lapsed", () => {
    expect(renewExpiresAt(RENEWABLE, NOW - 3 * DAY, NOW)).toEqual({
      ok: true,
      expiresAt: NOW + limits.postExpiry.renewExtendMs,
    });
  });

  it("refuses a renewal that would pass the maximum", () => {
    expect(renewExpiresAt(RENEWABLE, NOW + 150 * DAY, NOW)).toEqual({
      ok: false,
      reason: "too_far",
    });
  });
});
