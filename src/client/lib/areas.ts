import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  areaList,
  modArea,
  modAreaList,
  type AreaInput,
  type AreaOption,
  type ModArea,
} from "../../shared/schemas/areas";
import type { GeoPoint } from "../../shared/geo";
import { apiGet, apiPatch, apiPost, apiPut } from "./api";

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

/** One of our own areas that matches a search: where it is, and the area it sits in when it is a sub-area. */
export type AreaMatch = {
  id: number;
  name: string;
  parentName: string | null;
  point: { lat: number; lng: number };
};

/**
 * The areas whose name contains `search` (case-insensitive), names that start with it first, at most
 * `max`. Each carries a point: a sub-area with none of its own stands where its parent does, and an
 * area with no point at all (Outside Dhaka) is left out, since there is nowhere to fly to. Runs in
 * the browser over the loaded list, so it costs no request.
 */
export function areaMatches(
  options: readonly AreaOption[] | undefined,
  search: string,
  max: number,
): AreaMatch[] {
  const needle = search.trim().toLowerCase();
  if (needle === "") return [];
  const found: (AreaMatch & { starts: boolean })[] = [];
  for (const top of options ?? []) {
    for (const area of [top, ...top.children]) {
      const lower = area.name.toLowerCase();
      if (!lower.includes(needle)) continue;
      const point = areaPointOf(options, area.id);
      if (!point) continue;
      found.push({
        id: area.id,
        name: area.name,
        parentName: area === top ? null : top.name,
        point,
        starts: lower.startsWith(needle),
      });
    }
  }
  // A stable sort: ties keep the list's order (Bashundhara first, then alphabetical).
  return found
    .sort((a, b) => Number(b.starts) - Number(a.starts))
    .slice(0, max)
    .map(({ starts: _starts, ...match }) => match);
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

type AreaWithPoint = { id: number; name: string; lat: number | null; lng: number | null };

/** Every visible area, sub-areas included, that has a point of its own. */
export function areasWithPoints(options: readonly AreaOption[] | undefined): AreaWithPoint[] {
  return (options ?? [])
    .flatMap((top) => [top, ...top.children])
    .filter((area) => area.lat !== null && area.lng !== null);
}

/**
 * Where an area is on the map. A sub-area with no point of its own stands where its parent does, so
 * a ride filed under it still gets a place. Null when neither has one ("Outside Dhaka") or the list
 * is not loaded.
 */
export function areaPointOf(
  options: readonly AreaOption[] | undefined,
  id: number,
): { lat: number; lng: number } | null {
  for (const top of options ?? []) {
    const own = top.id === id ? top : top.children.find((c) => c.id === id);
    if (!own) continue;
    const at = own.lat !== null && own.lng !== null ? own : top;
    return at.lat !== null && at.lng !== null ? { lat: at.lat, lng: at.lng } : null;
  }
  return null;
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

/** Sets or moves an area's map point, or clears it with null. */
export function useSetAreaPoint(id: number) {
  const refresh = useRefreshAreas();
  return useMutation({
    mutationFn: (point: GeoPoint | null) =>
      apiPut(`/api/mod/areas/${id}/point`, modArea, { point }),
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
