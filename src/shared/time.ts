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

/** Minutes after midnight in Asia/Dhaka at the instant `now` (UTC epoch ms). */
export function dhakaMinutes(now: number = Date.now()): number {
  const d = new Date(now + DHAKA_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** The first instant (UTC epoch ms) of the Asia/Dhaka day after the given calendar date, so a post "until 20 Nov" is live through all of 20 Nov in Dhaka. */
export function endOfDhakaDay(date: { year: number; month: number; day: number }): number {
  return Date.UTC(date.year, date.month - 1, date.day + 1) - DHAKA_OFFSET_MS;
}
