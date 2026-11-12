import { endOfDhakaDay } from "../../shared/time";
import { limits } from "../limits";

/**
 * Expiry for every post type, in one place. A type says when its post should lapse with an
 * `ExpirySpec` and whether the poster can renew with a `RenewalRule`; this works out `expires_at` (UTC
 * epoch ms) and refuses dates that make no sense. Feeds hide a row past `expires_at` in the query
 * (`notExpired()` in `src/server/repos/postLifecycle.ts`), and the type's cron job deletes it after
 * `limits.postExpiry.expiredPurgeMs`.
 *
 * Rides, for example: a one-off ride is `{ at: departure }` with `NOT_RENEWABLE`; a recurring ride is
 * `{ throughDhakaDate: endDate }` (or `{ default: true }` when no end date is given) with
 * `RENEWABLE`.
 */
export type ExpirySpec =
  /** Lapses at this instant, such as a departure. */
  | { at: number }
  /** Live through this Asia/Dhaka calendar day, so it lapses when the next day begins. */
  | { throughDhakaDate: { year: number; month: number; day: number } }
  /** No date given: lapses `limits.postExpiry.defaultMs` from now. */
  | { default: true };

export type RenewalRule = { renewable: false } | { renewable: true; extendMs: number };

export const NOT_RENEWABLE: RenewalRule = { renewable: false };
export const RENEWABLE: RenewalRule = {
  renewable: true,
  extendMs: limits.postExpiry.renewExtendMs,
};

export type ExpiryFailure = "in_past" | "too_far" | "not_renewable";
export type ExpiryResult = { ok: true; expiresAt: number } | { ok: false; reason: ExpiryFailure };

const within = (expiresAt: number, now: number): ExpiryResult => {
  if (expiresAt <= now) return { ok: false, reason: "in_past" };
  if (expiresAt > now + limits.postExpiry.maxMs) return { ok: false, reason: "too_far" };
  return { ok: true, expiresAt };
};

/** When a new post lapses: the spec's date, which must be in the future and no further than the maximum. */
export function computeExpiresAt(spec: ExpirySpec, now: number = Date.now()): ExpiryResult {
  if ("default" in spec) return { ok: true, expiresAt: now + limits.postExpiry.defaultMs };
  if ("at" in spec) return within(spec.at, now);
  return within(endOfDhakaDay(spec.throughDhakaDate), now);
}

/**
 * The new `expires_at` when the poster renews. A rule that is not renewable refuses. Otherwise the post
 * is extended from whichever is later, its current expiry or now (so a lapsed post that has not been
 * purged yet starts over from today), and the result may not pass the maximum.
 */
export function renewExpiresAt(
  rule: RenewalRule,
  currentExpiresAt: number,
  now: number = Date.now(),
): ExpiryResult {
  if (!rule.renewable) return { ok: false, reason: "not_renewable" };
  const next = Math.max(currentExpiresAt, now) + rule.extendMs;
  if (next > now + limits.postExpiry.maxMs) return { ok: false, reason: "too_far" };
  return { ok: true, expiresAt: next };
}

/** True once a post has lapsed. */
export const isExpired = (expiresAt: number, now: number = Date.now()): boolean => expiresAt <= now;
