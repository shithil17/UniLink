// Calendar values ("today", the current year) are computed in Asia/Dhaka, never in UTC or the device's zone.

// Bangladesh is UTC+6 with no daylight saving time.
export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

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

/** The first instant (UTC epoch ms) of the given Asia/Dhaka calendar day. */
export function startOfDhakaDay(date: { year: number; month: number; day: number }): number {
  return Date.UTC(date.year, date.month - 1, date.day) - DHAKA_OFFSET_MS;
}

/** "YYYY-MM-DD" for a Dhaka calendar date. */
export function formatDhakaDate(date: { year: number; month: number; day: number }): string {
  const pad = (n: number, width: number) => String(n).padStart(width, "0");
  return `${pad(date.year, 4)}-${pad(date.month, 2)}-${pad(date.day, 2)}`;
}

/** The calendar date of a "YYYY-MM-DD" string, or null when it is not a real date. */
export function parseDhakaDate(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day));
  return check.getUTCFullYear() === date.year &&
    check.getUTCMonth() === date.month - 1 &&
    check.getUTCDate() === date.day
    ? date
    : null;
}
