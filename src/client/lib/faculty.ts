import {
  infiniteQueryOptions,
  keepPreviousData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  facultyOptionPage,
  modFaculty,
  modFacultyPage,
  type FacultyInput,
  type FacultyPatch,
  type ModFaculty,
} from "../../shared/schemas/faculty";
import { apiGet, apiPatch, apiPost, queryString } from "./api";

/** What a faculty search asks the server: typed text over all rows, and an optional department. */
export type FacultyFilter = { q: string; department: string | null };

const filterParams = ({ q, department }: FacultyFilter) => ({
  q: q.trim(),
  department: department ?? undefined,
});

/**
 * Visible faculty for the attempt picker, one cursor page at a time. The search text and department
 * are part of the key, so a new term starts again from page one and a slow answer to an old term can
 * never replace the newer one. The previous results stay on screen while the new ones load.
 */
export const facultyOptionsList = (filter: FacultyFilter) =>
  infiniteQueryOptions({
    queryKey: ["faculty", filterParams(filter)],
    queryFn: ({ pageParam }) =>
      apiGet(
        `/api/faculty${queryString({ ...filterParams(filter), cursor: pageParam })}`,
        facultyOptionPage,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });

/** Faculty for the moderator panel, hidden rows included when asked. Keyed and paged like the picker list. */
export const modFacultyList = (filter: FacultyFilter & { showHidden: boolean }) =>
  infiniteQueryOptions({
    queryKey: ["mod", "faculty", { ...filterParams(filter), showHidden: filter.showHidden }],
    queryFn: ({ pageParam }) =>
      apiGet(
        `/api/mod/faculty${queryString({
          ...filterParams(filter),
          hidden: filter.showHidden ? "include" : undefined,
          cursor: pageParam,
        })}`,
        modFacultyPage,
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
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
