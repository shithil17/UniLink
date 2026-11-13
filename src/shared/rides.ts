// Ride helpers shared by the server, the post form and the feed: the weekday bitmask a recurring ride
// stores, and "HH:MM" departure times. Weekdays and times are Asia/Dhaka local values.

/** Index is the Asia/Dhaka weekday number (`dhakaWeekday()`): Sunday is 0. Bit `i` of a ride's `days` mask is `WEEKDAYS[i]`. */
export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The bit of one weekday in a ride's `days` mask. */
export const weekdayBit = (day: Weekday | number): number =>
  1 << (typeof day === "number" ? day : WEEKDAYS.indexOf(day));

/** The `days` mask of a set of weekdays. Repeats are harmless. */
export const daysToMask = (days: readonly Weekday[]): number =>
  days.reduce((mask, day) => mask | weekdayBit(day), 0);

/** The weekdays in a `days` mask, Sunday first. */
export const maskToDays = (mask: number): Weekday[] =>
  WEEKDAYS.filter((_, i) => (mask & (1 << i)) !== 0);

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** True for a 24-hour "HH:MM" time. */
export const isDepartureTime = (value: string): boolean => TIME.test(value);

/** Minutes after midnight for an "HH:MM" time. The caller has checked it with `isDepartureTime`. */
export function timeToMinutes(value: string): number {
  const m = TIME.exec(value);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** "HH:MM" for minutes after midnight. */
export const minutesToTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
