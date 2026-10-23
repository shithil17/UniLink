import type { CourseMap } from "../../shared/schemas/courses";
import { dhakaDate, dhakaMinutes, dhakaWeekday } from "../../shared/time";

type Slot = CourseMap["categories"][number]["slots"][number];

/** The parts of a query that decide what Home shows. */
export type QueryView<T> = { status: "pending" | "error" | "success"; data: T | undefined };

export type HomeState = "signedOut" | "error" | "loading" | "empty" | "ready";

/**
 * What Home shows. A failed session check is an error, never endless loading; only a 401 (the
 * query resolves to null) means signed out. The course map is only asked for once signed in.
 */
export function selectHomeState(
  me: QueryView<unknown>,
  map: QueryView<Pick<CourseMap, "curriculum">>,
): HomeState {
  if (me.status === "error") return "error";
  if (me.status === "pending") return "loading";
  if (me.data == null) return "signedOut";
  if (map.status === "error") return "error";
  if (map.status === "pending" || !map.data) return "loading";
  return map.data.curriculum ? "ready" : "empty";
}

// ceiling: Home lists this many unlocked courses and links to the map for the rest. A term is five
// or six courses; revisit if students ask for a longer list here.
export const UNLOCKED_NEXT_MAX = 6;

/**
 * Courses the student can take now: available fixed courses, earliest semester first (no semester
 * last), then in map order. Elective placeholders are skipped, since they name no course.
 */
export function unlockedNext(map: Pick<CourseMap, "categories">, limit = UNLOCKED_NEXT_MAX) {
  const available: Slot[] = map.categories
    .flatMap((c) => c.slots)
    .filter((s) => s.kind === "course" && s.status === "available");
  const ordered = available
    .map((slot, index) => ({ slot, index }))
    .sort(
      (a, b) => (a.slot.semester ?? Infinity) - (b.slot.semester ?? Infinity) || a.index - b.index,
    )
    .map(({ slot }) => slot);
  return { items: ordered.slice(0, limit), total: ordered.length };
}

export type GreetingBand = "morning" | "afternoon" | "evening";

// Display bands for the greeting, as minutes after midnight in Asia/Dhaka. Not a product limit, so
// they live here rather than in the server's limits file. Morning runs from 05:00 to 11:59,
// afternoon to 16:59, and evening takes the rest, so the small hours before 05:00 read as evening
// ("Good evening" at 04:59) rather than a morning that has not started.
const MORNING_FROM_MIN = 5 * 60;
const AFTERNOON_FROM_MIN = 12 * 60;
const EVENING_FROM_MIN = 17 * 60;

/** The greeting band at the instant `now` (UTC epoch ms), by the Asia/Dhaka hour. */
export function greetingBand(now: number): GreetingBand {
  const minutes = dhakaMinutes(now);
  if (minutes >= EVENING_FROM_MIN || minutes < MORNING_FROM_MIN) return "evening";
  return minutes >= AFTERNOON_FROM_MIN ? "afternoon" : "morning";
}

/**
 * "Good morning, apollo". Pass the username, never a student ID. Without a name (not loaded, or
 * blank) the greeting has none: "Good morning".
 */
export function greeting(now: number, name?: string | null): string {
  const base = `Good ${greetingBand(now)}`;
  const trimmed = name?.trim();
  return trimmed ? `${base}, ${trimmed}` : base;
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Saturday, 24 October" for the Asia/Dhaka calendar day at `now`. */
export function dhakaDateLine(now: number): string {
  const { month, day } = dhakaDate(now);
  return `${WEEKDAYS[dhakaWeekday(now)]}, ${day} ${MONTHS[month - 1]}`;
}
