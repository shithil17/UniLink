import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { formatPrereq, simplifyPrereq } from "../../shared/prereqText";
import {
  modCourse,
  modCurriculum,
  type CourseInput,
  type CoursePatch,
  type ModCourse,
} from "../../shared/schemas/modCourses";
import { apiGet, apiPatch, apiPost } from "./api";

/** Every imported curriculum, for the picker and the import warning. */
export const modCurriculaQuery = queryOptions({
  queryKey: ["mod", "curricula"],
  queryFn: () => apiGet("/api/mod/curricula", z.array(modCurriculum)),
});

/** Every slot of one curriculum, hidden ones included. */
export const modCoursesQuery = (curriculumId: number) =>
  queryOptions({
    queryKey: ["mod", "courses", curriculumId],
    queryFn: () => apiGet(`/api/mod/curricula/${curriculumId}/courses`, z.array(modCourse)),
  });

/** Categories in the order the course map shows them: by their first slot. */
export function categoriesOf(courses: readonly ModCourse[]): string[] {
  return [...new Set(courses.map((c) => c.category))];
}

/** Slots grouped by category, in curriculum order. */
export function groupByCategory(courses: readonly ModCourse[]) {
  return categoriesOf(courses).map((name) => ({
    name,
    courses: courses.filter((c) => c.category === name),
  }));
}

/** Matches a code (the slot's or an alternative's) or a title, ignoring case. An empty search matches all. */
export function matchesCourse(course: ModCourse, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return [course, ...course.alternatives].some(
    (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q),
  );
}

/** Every code a prerequisite may name, with the slot's own codes taken out: other course slots' codes and alternatives. */
export function prereqCodesFor(courses: readonly ModCourse[], ownId: number | null): Set<string> {
  return new Set(
    courses
      .filter((c) => c.id !== ownId && c.kind === "course")
      .flatMap((c) => [c.code, ...c.alternatives.map((a) => a.code)]),
  );
}

/** Only the fields a mod actually changed, so the audit log records just those. */
export function changedFields(original: ModCourse, values: CourseInput): CoursePatch {
  const patch: CoursePatch = {};
  if (values.kind !== original.kind) patch.kind = values.kind;
  if (values.code !== original.code) patch.code = values.code;
  if (values.title !== original.title) patch.title = values.title;
  if (values.credits !== original.credits) patch.credits = values.credits;
  if (values.category !== original.category) patch.category = values.category;
  if (values.nonCredit !== original.nonCredit) patch.nonCredit = values.nonCredit;
  if (values.semester !== original.semester) patch.semester = values.semester;
  if (JSON.stringify(values.alternatives) !== JSON.stringify(original.alternatives)) {
    patch.alternatives = values.alternatives;
  }
  if (JSON.stringify(values.prereq) !== JSON.stringify(simplifyPrereq(original.prereq))) {
    patch.prereq = values.prereq;
  }
  return patch;
}

/** A change to a course refreshes the mod lists, the student map and everything built from it. */
function useRefreshCourses() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mod", "courses"] }),
      queryClient.invalidateQueries({ queryKey: ["mod", "curricula"] }),
      queryClient.invalidateQueries({ queryKey: ["course-map"] }),
      queryClient.invalidateQueries({ queryKey: ["attempts"] }),
    ]);
}

export function useAddCourse(curriculumId: number) {
  const refresh = useRefreshCourses();
  return useMutation({
    mutationFn: (body: CourseInput) =>
      apiPost(`/api/mod/curricula/${curriculumId}/courses`, modCourse, {
        ...body,
        prereq: formatPrereq(body.prereq),
      }),
    onSuccess: refresh,
  });
}

export function useEditCourse(id: number) {
  const refresh = useRefreshCourses();
  return useMutation({
    mutationFn: (patch: CoursePatch) =>
      apiPatch(
        `/api/mod/courses/${id}`,
        modCourse,
        // The API takes the prerequisite as the text a mod typed.
        patch.prereq === undefined ? patch : { ...patch, prereq: formatPrereq(patch.prereq) },
      ),
    onSuccess: refresh,
  });
}

export function useSetCourseHidden(id: number) {
  const refresh = useRefreshCourses();
  return useMutation({
    mutationFn: ({ hidden, reason }: { hidden: boolean; reason: string }) =>
      apiPost(`/api/mod/courses/${id}/${hidden ? "hide" : "unhide"}`, modCourse, { reason }),
    onSuccess: refresh,
  });
}
