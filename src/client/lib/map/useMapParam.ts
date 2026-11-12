import { useCallback } from "react";
import { useSearchLayer } from "./useSearchLayer";

/** The search param that says which full-screen map is open. */
export const MAP_PARAM = "map";

const MAP_PARAM_NAME = /^[a-z][a-z0-9-]{0,31}$/;

/**
 * For a route's `validateSearch`: keep `map` when it is a short lowercase name, drop anything else.
 * A route that hosts a full-screen map must keep this param, or the router strips it from the URL.
 */
export function parseMapParam(raw: unknown): string | undefined {
  return typeof raw === "string" && MAP_PARAM_NAME.test(raw) ? raw : undefined;
}

/**
 * Whether the full-screen map called `name` is open, and how to open and close it. The state lives
 * in the URL (`?map=name`); see `useSearchLayer` for how opening and closing walk the history.
 */
export function useMapParam(name: string) {
  const layer = useSearchLayer(MAP_PARAM);
  const { open: openLayer, close } = layer;
  const open = useCallback(() => openLayer(name), [openLayer, name]);
  return { isOpen: layer.value === name, open, close };
}
