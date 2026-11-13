// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideSummary } from "../../shared/schemas/rides";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));
// The form has its own tests; here it only calls back the way a save or a cancel does.
vi.mock("@/components/rides/RideForm", () => ({
  RideForm: ({ onSaved, onCancel }: { onSaved: (r: unknown) => void; onCancel: () => void }) => (
    <>
      <button onClick={() => onSaved({})}>Stub save</button>
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

const FRI_0730 = Date.UTC(2026, 10, 20, 1, 30);

const mine: RideSummary = {
  id: 5,
  kind: "one_off",
  pickupArea: { id: 1, name: "Bashundhara R/A" },
  destinationArea: { id: 60, name: "Mirpur" },
  pickupLandmark: null,
  destinationLandmark: null,
  vehicle: "car",
  totalSeats: 4,
  seatsRemaining: 3,
  pricePerSeatTaka: 150,
  notes: null,
  departsAt: FRI_0730,
  days: null,
  departureTime: null,
  endsOn: null,
  state: "open",
  status: "published",
  expiresAt: FRI_0730,
  createdAt: FRI_0730 - 1000,
  mine: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Taps the ride's row in the list at /rides with a filter in the URL, which opens it as a phone
 * sheet at /rides/5, then follows its Edit link to the form.
 */
async function editFromDetail() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: !query.includes("min-width"),
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("No network in this test"))),
  );
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  });
  queryClient.setQueryData(["me"], me);
  queryClient.setQueryData(["inbox", "unread-count"], { count: 0 });
  queryClient.setQueryData(["rides", "detail", 5], mine);
  queryClient.setQueryData(["rides", "feed", { vehicle: "car" }], {
    pages: [{ items: [mine], nextCursor: null }],
    pageParams: [""],
  });
  queryClient.setQueryData(["ride-contacts", 5], { contacts: { phone: "+8801712345678" } });
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
  fireEvent.click(await screen.findByRole("link", { name: /Bashundhara R\/A/ }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/rides/5"));
  fireEvent.click(await screen.findByRole("link", { name: "Edit" }));
  await screen.findByRole("heading", { name: "Edit ride" });
  expect(router.state.location.pathname).toBe("/rides/5/edit");
  // The list's filters came along to the form.
  expect(router.state.location.search).toEqual({ vehicle: "car" });
  return router;
}

describe("Edit ride", () => {
  it("Save goes back to the ride it was opened from, so Back leaves the ride instead of showing it twice", async () => {
    const router = await editFromDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Stub save" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides/5"));
    expect(router.state.location.search).toEqual({ vehicle: "car" });
    router.history.back();
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides"));
    expect(router.history.canGoBack()).toBe(false);
  });

  it("closing the ride after a Save goes back to the list entry, not forward to another list", async () => {
    const router = await editFromDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Stub save" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides/5"));
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides"));
    expect(router.state.location.search).toEqual({ vehicle: "car" });
    // Replacing the ride with the list would leave the old list below it, and Back would reopen the ride.
    expect(router.history.canGoBack()).toBe(false);
  });

  it("Cancel goes back to the ride it was opened from instead of stacking another entry", async () => {
    const router = await editFromDetail();
    fireEvent.click(await screen.findByRole("button", { name: "Stub cancel" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides/5"));
    expect(router.state.location.search).toEqual({ vehicle: "car" });
    fireEvent.click(await screen.findByRole("button", { name: "Close" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/rides"));
    expect(router.history.canGoBack()).toBe(false);
  });
});
