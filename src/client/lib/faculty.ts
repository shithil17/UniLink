import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  modFaculty,
  type FacultyInput,
  type FacultyPatch,
  type ModFaculty,
} from "../../shared/schemas/faculty";
import { apiGet, apiPatch, apiPost } from "./api";

/** Every faculty row, hidden ones included, for the moderator panel. */
export const modFacultyQuery = queryOptions({
  queryKey: ["mod", "faculty"],
  queryFn: () => apiGet("/api/mod/faculty", z.array(modFaculty)),
});

/** Only the fields a mod actually changed, so the audit log records just those. */
export function changedFields(original: ModFaculty, values: FacultyInput): FacultyPatch {
  const patch: FacultyPatch = {};
  if (values.name !== original.name) patch.name = values.name;
  if (values.initials !== original.initials) patch.initials = values.initials;
  if (values.designation !== original.designation) patch.designation = values.designation;
  if (values.department !== original.department) patch.department = values.department;
  if (values.nsuPage !== original.nsuPage) patch.nsuPage = values.nsuPage;
  return patch;
}

/** A change to the directory refreshes the mod list, the student picker and attempt rows that name faculty. */
function useRefreshFaculty() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mod", "faculty"] }),
      queryClient.invalidateQueries({ queryKey: ["faculty"] }),
      queryClient.invalidateQueries({ queryKey: ["attempts"] }),
    ]);
}

export function useAddFaculty() {
  const refresh = useRefreshFaculty();
  return useMutation({
    mutationFn: (body: FacultyInput) => apiPost("/api/mod/faculty", modFaculty, body),
    onSuccess: refresh,
  });
}

export function useEditFaculty(id: number) {
  const refresh = useRefreshFaculty();
  return useMutation({
    mutationFn: (patch: FacultyPatch) => apiPatch(`/api/mod/faculty/${id}`, modFaculty, patch),
    onSuccess: refresh,
  });
}

export function useSetFacultyHidden(id: number) {
  const refresh = useRefreshFaculty();
  return useMutation({
    mutationFn: ({ hidden, reason }: { hidden: boolean; reason: string }) =>
      apiPost(`/api/mod/faculty/${id}/${hidden ? "hide" : "unhide"}`, modFaculty, { reason }),
    onSuccess: refresh,
  });
}
