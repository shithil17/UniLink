import type { CourseMap } from "../../shared/schemas/courses";

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
