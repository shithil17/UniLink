import { useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";

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
 * in the URL (`?map=name`), so opening pushes a history entry: the Back button, Android Back, Escape
 * and the close button all end up in `close`, and the screen underneath keeps its scroll and state.
 *
 * `close` goes back in history when this hook pushed the entry. When the page was opened straight on
 * `?map=name` (a reload, a shared link) there is nothing to go back to inside the app, so it
 * replaces the entry instead of leaving the app.
 */
export function useMapParam(name: string) {
  const navigate = useNavigate();
  const router = useRouter();
  const current = useSearch({
    strict: false,
    select: (search) => (search as Record<string, unknown>)[MAP_PARAM],
  });
  const isOpen = current === name;
  const pushed = useRef(false);

  useEffect(() => {
    if (!isOpen) pushed.current = false;
  }, [isOpen]);

  const open = useCallback(() => {
    pushed.current = true;
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        [MAP_PARAM]: name,
      })) as never,
      resetScroll: false,
    });
  }, [navigate, name]);

  const close = useCallback(() => {
    if (pushed.current) {
      router.history.back();
      return;
    }
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        [MAP_PARAM]: undefined,
      })) as never,
      replace: true,
      resetScroll: false,
    });
  }, [navigate, router]);

  return { isOpen, open, close };
}
