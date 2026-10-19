import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { attempt, type AttemptInput } from "../../shared/schemas/attempts";
import { importResult, studentCourse, type StudentCourseInput } from "../../shared/schemas/courses";
import { apiDelete, apiPatch, apiPost, ApiError, isOffline } from "./api";
import { courseMapQuery } from "./queries";

/** Refresh the map after anything that changes done courses, student courses or totals. */
function useInvalidateMap() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: courseMapQuery.queryKey });
}

export function useRecordAttempt() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: (body: AttemptInput) => apiPost("/api/attempts", attempt, body),
    onSuccess: invalidate,
  });
}

export function useAddStudentCourse() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: (body: StudentCourseInput) => apiPost("/api/student-courses", studentCourse, body),
    onSuccess: invalidate,
  });
}

export function useUpdateStudentCourse(id: number) {
  const invalidate = useInvalidateMap();
  return useMutation({
    // The code is fixed once added, so it is never sent.
    mutationFn: ({ title, credits, category, excluded }: StudentCourseInput) =>
      apiPatch(`/api/student-courses/${id}`, studentCourse, { title, credits, category, excluded }),
    onSuccess: invalidate,
  });
}

export function useDeleteStudentCourse() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: (id: number) =>
      apiDelete(`/api/student-courses/${id}`, z.object({ ok: z.boolean() })),
    onSuccess: invalidate,
  });
}

/** The import body is the parsed file, whose rows the server checks one by one. */
export function useImportCurriculum() {
  const invalidate = useInvalidateMap();
  return useMutation({
    mutationFn: (body: unknown) => apiPost("/api/courses/import", importResult, body),
    onSuccess: invalidate,
  });
}

/** Offline and rate-limit errors belong in a toast; everything else stays inline in the form. */
export function isToastError(err: unknown): boolean {
  return isOffline(err) || (err instanceof ApiError && err.status === 429);
}
