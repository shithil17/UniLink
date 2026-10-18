// Calendar values ("today", the current year) are computed in Asia/Dhaka, never in UTC or the device's zone.

// Bangladesh is UTC+6 with no daylight saving time.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The calendar year in Asia/Dhaka at the instant `now` (UTC epoch ms). */
export function dhakaYear(now: number = Date.now()): number {
  return new Date(now + DHAKA_OFFSET_MS).getUTCFullYear();
}
