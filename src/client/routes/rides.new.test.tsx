// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));
// The form has its own tests; here it only calls back the way a post or a cancel does.
vi.mock("@/components/rides/RideForm", () => ({
  RideForm: ({ onSaved, onCancel }: { onSaved: (r: unknown) => void; onCancel: () => void }) => (
    <>
      <button onClick={() => onSaved({})}>Stub post</button>
      <button onClick={onCancel}>Stub cancel</button>
    </>
  ),
}));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Follows "Post a ride" from the rides list, which has a filter in its URL, to the form. */
async function openForm() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: !query.includes("min-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("No network in this test"))),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  queryClient.setQueryData(["rides", "feed", { vehicle: "car" }], {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [""],
  });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/rides?vehicle=car"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const [post] = await screen.findAllByRole("link", { name: "Post a ride" });
  fireEvent.click(post!);
  await screen.findByRole("button", { name: "Stub post" });
  expect(router.state.location.pathname).toBe("/rides/new");
  // The list's filters came along to the form.
  expect(router.state.location.search).toEqual({ vehicle: "car" });
  return router;
}

describe("Post a ride", () => {
  it("posting replaces the form with My rides and keeps the filters, so Back does not reopen the form", async () => {
    const router = await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Stub post" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides"));
    expect(router.state.location.search).toEqual({ vehicle: "car", tab: "mine" });
    // Only the list entry is left below, so there is no empty form to go back to.
    expect(router.history.canGoBack()).toBe(true);
    router.history.back();
    await waitFor(() => expect(router.state.location.search).toEqual({ vehicle: "car" }));
    expect(router.state.location.pathname).toBe("/rides");
    expect(router.history.canGoBack()).toBe(false);
  });

  it("Cancel goes back to the list with its filters instead of stacking another entry", async () => {
    const router = await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Stub cancel" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides"));
    expect(router.state.location.search).toEqual({ vehicle: "car" });
    expect(router.history.canGoBack()).toBe(false);
  });
});
