import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * One layer of a screen that lives in a search param (`?map=ride`, `?area=pickup-70`, `?ride=5`):
 * its current value, and how to open and close it. Opening pushes a history entry, so every layer is
 * one step and Back, Android Back and Escape close the top one only, in order, with the screen
 * underneath keeping its scroll and state.
 *
 * `close` goes back in history when this hook pushed the entry. When the page was opened straight on
 * the param (a reload, a shared link) there is nothing to go back to inside the app, so it replaces
 * the entry without the param instead of leaving the app. The route's `validateSearch` must keep
 * the param, or the router strips it.
 */
export function useSearchLayer(name: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const value = useSearch({
    strict: false,
    select: (search) => (search as Record<string, unknown>)[name],
  });
  const pushed = useRef(false);

  useEffect(() => {
    if (value === undefined) pushed.current = false;
  }, [value]);

  const open = useCallback(
    (next: string | number) => {
      pushed.current = true;
      void navigate({
        to: ".",
        search: ((previous: Record<string, unknown>) => ({ ...previous, [name]: next })) as never,
        resetScroll: false,
      });
    },
    [navigate, name],
  );

  const close = useCallback(() => {
    if (pushed.current) {
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

  return { value, open, close };
}
