// Calendar values ("today", the current year) are computed in Asia/Dhaka, never in UTC or the device's zone.

// Bangladesh is UTC+6 with no daylight saving time.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** The calendar year in Asia/Dhaka at the instant `now` (UTC epoch ms). */
export function dhakaYear(now: number = Date.now()): number {
  return new Date(now + DHAKA_OFFSET_MS).getUTCFullYear();
}

/** Year, month (1 to 12) and day of month in Asia/Dhaka at the instant `now` (UTC epoch ms). */
export function dhakaDate(now: number = Date.now()): { year: number; month: number; day: number } {
  const d = new Date(now + DHAKA_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Day of the week in Asia/Dhaka at the instant `now` (UTC epoch ms): 0 is Sunday, 6 is Saturday. */
export function dhakaWeekday(now: number = Date.now()): number {
  return new Date(now + DHAKA_OFFSET_MS).getUTCDay();
}
