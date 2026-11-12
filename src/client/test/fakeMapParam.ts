/**
 * A stand-in for `@/lib/map/useMapParam` in component tests that render a form or a panel without a
 * router: the open map lives in a module variable instead of the URL. Tests mock the module with
 * `vi.mock("@/lib/map/useMapParam", () => import("@/test/fakeMapParam"))` and call
 * `resetFakeMapParam()` between tests.
 */
import { useSyncExternalStore } from "react";

export const MAP_PARAM = "map";

let current: string | undefined;
const listeners = new Set<() => void>();
const set = (next: string | undefined) => {
  current = next;
  for (const listener of listeners) listener();
};

export const parseMapParam = (raw: unknown): string | undefined =>
  typeof raw === "string" ? raw : undefined;

export function useMapParam(name: string) {
  const open = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
    () => undefined,
  );
  return { isOpen: open === name, open: () => set(name), close: () => set(undefined) };
}

export function resetFakeMapParam() {
  set(undefined);
}
