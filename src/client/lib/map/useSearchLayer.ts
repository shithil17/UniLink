import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

/** A search with the layer's own param left out, so two searches compare by everything else. */
export function without(search: Record<string, unknown>, name: string) {
  return JSON.stringify(
    Object.entries(search)
      .filter(([key, value]) => key !== name && value !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/**
 * One layer of a screen that lives in a search param (`?map=ride`, `?area=pickup-70`, `?ride=5`):
 * its current value, and how to open and close it. Opening pushes a history entry, so every layer is
 * one step and Back, Android Back and Escape close the top one only, in order, with the screen
 * underneath keeping its scroll and state.
 *
 * `close` goes back in history when this hook pushed the entry and nothing else in the search has
 * changed since (a filter picked while the layer was open replaces the entry, and going back would
 * undo it), so it replaces the entry without the param instead. It does the same when the page was
 * opened straight on the param (a reload, a shared link), where there is nothing to go back to
 * inside the app and going back would leave it. The route's `validateSearch` must keep
 * the param, or the router strips it.
 */
export function useSearchLayer(name: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const value = useSearch({
    strict: false,
    select: (search) => (search as Record<string, unknown>)[name],
  });
  // The rest of the search when this hook pushed the entry, or null when it did not.
  const pushedFrom = useRef<string | null>(null);

  useEffect(() => {
    if (value === undefined) pushedFrom.current = null;
  }, [value]);

  const open = useCallback(
    (next: string | number) => {
      pushedFrom.current = without(router.state.location.search, name);
      void navigate({
        to: ".",
        search: ((previous: Record<string, unknown>) => ({ ...previous, [name]: next })) as never,
        resetScroll: false,
      });
    },
    [navigate, router, name],
  );

  const close = useCallback(() => {
    if (
      pushedFrom.current !== null &&
      pushedFrom.current === without(router.state.location.search, name)
    ) {
      router.history.back();
      return;
    }
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        [name]: undefined,
      })) as never,
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router, name]);

  /** Whether this hook pushed the history entry that holds the layer now. */
  const pushed = useCallback(() => pushedFrom.current !== null, []);

  return { value, open, close, pushed };
}
