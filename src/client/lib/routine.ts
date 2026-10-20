import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  nextEntry,
  overlapsWith,
  timeToMinutes,
  todayEntries,
  type RoutineDay,
} from "../../shared/routine";
import {
  routineEntry,
  type RoutineEntry,
  type RoutineInput,
  type RoutineUpdate,
} from "../../shared/schemas/routine";
import type { CourseMap } from "../../shared/schemas/courses";
import type { CourseChoice } from "./courseSearch";
import { apiDelete, apiPatch, apiPost } from "./api";

/** "14:30" to "2:30 PM", the way the NSU routine prints times. */
export function formatClock(time: string): string {
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;
  const hours = Math.floor(minutes / 60);
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hours % 12 === 0 ? 12 : hours % 12}:${mm} ${hours < 12 ? "AM" : "PM"}`;
}

/** "9:30 - 10:45 AM" when both ends share AM/PM, else both written out. */
export function formatRange(start: string, end: string): string {
  const [a, b] = [formatClock(start), formatClock(end)];
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} - ${b}` : `${a} - ${b}`;
}

/** "12 min", "1 h", "1 h 5 min": a gap in whole minutes, for "starts in ...". */
export function formatGap(minutes: number): string {
  const m = Math.max(0, Math.ceil(minutes));
  if (m < 60) return `${m} min`;
  return m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "CSE115" with a soft break after its letters, so a narrow block wraps it as "CSE" over "115". */
export const breakableCode = (code: string) => code.replace(/^([A-Z]+)(?=\d)/, "$1\u200B");

/** "Section 2 · Room 304 · RkZ", leaving out what was not entered. */
export function classDetails(entry: Pick<RoutineEntry, "section" | "room" | "initials">): string {
  return [`Section ${entry.section}`, entry.room && `Room ${entry.room}`, entry.initials]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The class Home's summary panel shows: the one in progress, else the next to start today. Null
 * when there is no routine, nothing today, or the day's classes are over.
 */
export function nextClassOf(entries: readonly RoutineEntry[] | undefined, now: number) {
  return entries ? nextEntry(todayEntries(entries, now), now) : null;
}

type Choice = CourseChoice;

/**
 * Every course the routine form can offer: the curriculum's courses with their alternatives, plus
 * the student's own courses, each with its state on the map. The server accepts exactly these
 * codes. Sorted by code, no repeats; a code seen twice keeps its first title and state.
 */
export function routineCourseChoices(map: Pick<CourseMap, "categories" | "extras">): Choice[] {
  const byCode = new Map<string, Choice>();
  const add = (c: Choice) => {
    if (!byCode.has(c.code)) byCode.set(c.code, c);
  };
  const own = (c: { code: string; title: string; done: boolean; waived: boolean }) =>
    add({ code: c.code, title: c.title, status: c.done ? "done" : "available", waived: c.waived });
  for (const slot of map.categories.flatMap((c) => c.slots)) {
    if (slot.kind === "course") {
      const state = { status: slot.status, waived: slot.waived };
      add({ code: slot.code, title: slot.title, ...state });
      slot.alternatives.forEach((alt) => add({ code: alt.code, title: alt.title, ...state }));
    }
    if (slot.studentCourse) own(slot.studentCourse);
  }
  map.extras.forEach(own);
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Course code to title, for rows that show both. */
export const titleByCode = (choices: readonly Choice[]) =>
  new Map(choices.map((c) => [c.code, c.title]));

/** The saved classes a draft would clash with, for the form's warning. Empty until the times make sense. */
export function clashesFor(
  draft: { id: number; days: readonly RoutineDay[]; start: string; end: string },
  entries: readonly RoutineEntry[],
): RoutineEntry[] {
  const start = timeToMinutes(draft.start);
  const end = timeToMinutes(draft.end);
  if (start === null || end === null || end <= start || draft.days.length === 0) return [];
  const ids = overlapsWith(draft, entries);
  return entries.filter((e) => ids.includes(e.id));
}

/** Any routine write can change what Home and the week show. */
function useRefreshRoutine() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["routine"] });
}

export function useAddRoutineEntry() {
  const refresh = useRefreshRoutine();
  return useMutation({
    mutationFn: (body: RoutineInput) => apiPost("/api/routine", routineEntry, body),
    onSuccess: refresh,
  });
}

export function useUpdateRoutineEntry(id: number) {
  const refresh = useRefreshRoutine();
  return useMutation({
    mutationFn: (body: RoutineUpdate) => apiPatch(`/api/routine/${id}`, routineEntry, body),
    onSuccess: refresh,
  });
}

export function useDeleteRoutineEntry(id: number) {
  const refresh = useRefreshRoutine();
  return useMutation({
    mutationFn: () => apiDelete(`/api/routine/${id}`, z.object({ ok: z.boolean() })),
    onSuccess: refresh,
  });
}

/** Clears the current term's classes. */
export function useClearRoutine() {
  const refresh = useRefreshRoutine();
  return useMutation({
    mutationFn: () => apiDelete("/api/routine", z.object({ deleted: z.number() })),
    onSuccess: refresh,
  });
}
