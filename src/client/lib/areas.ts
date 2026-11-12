import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  areaList,
  modArea,
  modAreaList,
  type AreaInput,
  type AreaOption,
  type ModArea,
} from "../../shared/schemas/areas";
import { apiGet, apiPatch, apiPost } from "./api";

// ceiling: the list is about 100 rows that change when a mod edits them, and a stale list only costs a
// student an area that was just hidden (the server refuses it) or misses one just added. Ten minutes keeps
// the pickers from refetching on every open. Revisit if mods report new areas taking too long to show.
const AREAS_STALE_MS = 10 * 60_000;

/** The areas a student can pick: visible top-level areas, each with its visible sub-areas. */
export const areasQuery = queryOptions({
  queryKey: ["areas"],
  queryFn: () => apiGet("/api/areas", areaList),
  staleTime: AREAS_STALE_MS,
});

/** One line of the picker's list. A sub-area carries its parent's name for the screen reader. */
export type AreaRow = { id: number; name: string; parentName: string | null };

/**
 * The picker's rows for a search: top-level areas with their sub-areas under them. A search keeps the
 * areas whose name contains it (case-insensitive). A matching top-level area keeps all its sub-areas, so
 * a broad area can be browsed; a sub-area that matches on its own keeps its parent as a heading row, so
 * the parent stays pickable too. An empty search returns everything.
 */
export function areaRows(options: readonly AreaOption[], search: string): AreaRow[] {
  const needle = search.trim().toLowerCase();
  const matches = (name: string) => needle === "" || name.toLowerCase().includes(needle);
  const rows: AreaRow[] = [];
  for (const top of options) {
    const children = matches(top.name) ? top.children : top.children.filter((c) => matches(c.name));
    if (children.length === 0 && !matches(top.name)) continue;
    rows.push({ id: top.id, name: top.name, parentName: null });
    for (const c of children) rows.push({ id: c.id, name: c.name, parentName: top.name });
  }
  return rows;
}

/** The name of an area in the loaded list, or undefined when it is not there (hidden since, or not loaded). */
export function areaNameOf(options: readonly AreaOption[] | undefined, id: number) {
  for (const top of options ?? []) {
    if (top.id === id) return top.name;
    const child = top.children.find((c) => c.id === id);
    if (child) return child.name;
  }
  return undefined;
}

/** "Mirpur", or "Mirpur (near the metro)" when the poster gave a landmark. */
export const placeLine = (area: string, landmark: string | null): string =>
  landmark ? `${area} (${landmark})` : area;

// ---- Mod -----------------------------------------------------------------------------------------

/** Every area, hidden ones included, flat. Parents and children are told apart by `parentId`. */
export const modAreasQuery = queryOptions({
  queryKey: ["mod", "areas"],
  queryFn: () => apiGet("/api/mod/areas", modAreaList),
});

export type AreaGroup = { area: ModArea; children: ModArea[] };

/** The flat mod list as parents with their sub-areas, in the order the server sent them. */
export function groupAreas(rows: readonly ModArea[]): AreaGroup[] {
  const groups = new Map<number, AreaGroup>();
  for (const r of rows) if (r.parentId === null) groups.set(r.id, { area: r, children: [] });
  for (const r of rows) if (r.parentId !== null) groups.get(r.parentId)?.children.push(r);
  return [...groups.values()];
}

/** A change to an area refreshes the mod list and the student pickers. */
function useRefreshAreas() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["mod", "areas"] }),
      queryClient.invalidateQueries({ queryKey: ["areas"] }),
      queryClient.invalidateQueries({ queryKey: ["rides"] }),
    ]);
}

export function useAddArea() {
  const refresh = useRefreshAreas();
  return useMutation({
    mutationFn: (body: AreaInput) => apiPost("/api/mod/areas", modArea, body),
    onSuccess: refresh,
  });
}

export function useRenameArea(id: number) {
  const refresh = useRefreshAreas();
  return useMutation({
    mutationFn: (name: string) => apiPatch(`/api/mod/areas/${id}`, modArea, { name }),
    onSuccess: refresh,
  });
}

export function useSetAreaHidden(id: number) {
  const refresh = useRefreshAreas();
  return useMutation({
    mutationFn: ({ hidden, reason }: { hidden: boolean; reason: string }) =>
      apiPost(`/api/mod/areas/${id}/${hidden ? "hide" : "unhide"}`, modArea, { reason }),
    onSuccess: refresh,
  });
}
