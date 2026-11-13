// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider, QueryObserver } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { useDeletePost } from "./posts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useDeletePost", () => {
  it("skips only the deleted post's own detail, not another type's detail with the same id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(Response.json({ ok: true }))),
    );
    const queryClient = new QueryClient();
    const runs: Record<string, number> = {};
    // Observed (active) queries are the ones that invalidation refetches.
    const watch = (queryKey: (string | number)[]) => {
      const name = queryKey.join("/");
      runs[name] = 0;
      new QueryObserver(queryClient, {
        queryKey,
        staleTime: Infinity,
        queryFn: () => {
          runs[name]!++;
          return Promise.resolve(name);
        },
      }).subscribe(() => {});
    };
    watch(["rides", "detail", 5]);
    watch(["resources", "detail", 5]);
    watch(["rides", "feed"]);
    await waitFor(() => expect(Object.values(runs)).toEqual([1, 1, 1]));

    const { result } = renderHook(() => useDeletePost("/api/rides"), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await act(() => result.current.mutateAsync(5));

    // The feed and the other type's detail refetch; the deleted ride's detail does not.
    await waitFor(() => expect(runs["rides/feed"]).toBe(2));
    expect(runs["resources/detail/5"]).toBe(2);
    expect(runs["rides/detail/5"]).toBe(1);
  });
});
