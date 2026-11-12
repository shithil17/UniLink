// @vitest-environment happy-dom
import "@/index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { Me } from "../../shared/schemas/auth";
import type { RideFeedPage, RideSummary } from "../../shared/schemas/rides";
import { routeTree } from "../routeTree.gen";

vi.mock("@/components/pwa/UpdatePrompt", () => ({ UpdatePrompt: () => null }));
vi.mock("@/components/pwa/InstallHint", () => ({ InstallHint: () => null }));

const me: Me = {
  username: "dev_cse",
  role: "student",
  admissionYear: 22,
  mustChangePassword: false,
};

const FRI_0730 = Date.UTC(2026, 10, 20, 1, 30);

const ride = (over: Partial<RideSummary> = {}): RideSummary => ({
  id: 1,
  kind: "one_off",
  pickupArea: { id: 1, name: "Bashundhara R/A" },
  destinationArea: { id: 60, name: "Mirpur" },
  pickupLandmark: "NSU gate",
  destinationLandmark: "Mirpur 10",
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
  mine: false,
  ...over,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAt(
  path: string,
  feeds: { filters: object; page: RideFeedPage }[],
  mine: RideFeedPage = { items: [], nextCursor: null },
) {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
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
  for (const { filters, page } of feeds) {
    queryClient.setQueryData(["rides", "feed", filters], { pages: [page], pageParams: [""] });
  }
  queryClient.setQueryData(
    ["areas"],
    [
      { id: 1, slug: "bashundhara-r-a", name: "Bashundhara R/A", children: [] },
      {
        id: 60,
        slug: "mirpur",
        name: "Mirpur",
        children: [{ id: 61, slug: "mirpur-mirpur-10", name: "Mirpur 10" }],
      },
    ],
  );
  queryClient.setQueryData(["rides", "mine"], { pages: [mine], pageParams: [""] });
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("Rides screen", () => {
  it("lists rides with route, schedule, price and seats, and never a contact", async () => {
    renderAt("/rides", [
      {
        filters: {},
        page: {
          items: [
            ride({ id: 1 }),
            ride({
              id: 2,
              kind: "recurring",
              pickupArea: { id: 60, name: "Mirpur" },
              destinationArea: { id: 1, name: "Bashundhara R/A" },
              pickupLandmark: null,
              destinationLandmark: "NSU gate",
              departsAt: null,
              days: ["sun", "mon", "tue", "wed", "thu"],
              departureTime: "07:30",
              endsOn: "2027-01-19",
              vehicle: "bike",
              seatsRemaining: 0,
              state: "full",
            }),
          ],
          nextCursor: null,
        },
      },
    ]);
    const rows = await screen.findAllByRole("link", { name: /Bashundhara R\/A/ });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.getAttribute("href")).toBe("/rides/1");
    expect(rows[0]!.textContent).toContain("Bashundhara R/A (NSU gate)");
    expect(rows[0]!.textContent).toContain("Mirpur (Mirpur 10)");
    expect(rows[1]!.textContent).not.toContain("Mirpur ()");
    expect(rows[0]!.textContent).toContain("Fri 20 Nov, 7:30 am");
    expect(rows[0]!.textContent).toContain("150 taka a seat");
    expect(rows[0]!.textContent).toContain("3 of 4 seats left");
    expect(rows[1]!.textContent).toContain("Sun to Thu at 7:30 am");
    expect(rows[1]!.textContent).toContain("Full");
    // Contacts exist only behind "Show contact" on the detail.
    expect(document.body.textContent).not.toMatch(/\+8801|wa\.me|m\.me|tel:/);
    expect(screen.getByText(/doesn't arrange or guarantee rides/)).toBeTruthy();
  });

  it("reads its filters from the URL and offers to clear them when nothing matches", async () => {
    const router = renderAt("/rides?vehicle=bike&day=mon", [
      { filters: { vehicle: "bike", day: "mon" }, page: { items: [], nextCursor: null } },
      { filters: {}, page: { items: [ride()], nextCursor: null } },
    ]);
    expect(await screen.findByText("No rides match.")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Filters\s*2/ })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]!);
    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(await screen.findByRole("link", { name: /Bashundhara R\/A/ })).toBeTruthy();
  });

  it("filters by area from the URL: names them, suggests a broader area when empty, and clears one at a time", async () => {
    const router = renderAt("/rides?from=1&to=61", [
      { filters: { from: 1, to: 61 }, page: { items: [], nextCursor: null } },
      { filters: { to: 61 }, page: { items: [ride()], nextCursor: null } },
    ]);
    expect(await screen.findByText("No rides match.")).toBeTruthy();
    expect(screen.getByText(/Try a broader area/)).toBeTruthy();
    // The open panel names both areas in their pickers.
    expect(screen.getByLabelText("From").textContent).toContain("Bashundhara R/A");
    expect(screen.getByLabelText("To").textContent).toContain("Mirpur 10");

    // Closed, the panel's filters show as chips that remove one filter each.
    fireEvent.click(screen.getByRole("button", { name: /Filters\s*2/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Remove filter: From Bashundhara R/A" }),
    );
    await waitFor(() => expect(router.state.location.search).toEqual({ to: 61 }));
    expect(await screen.findByRole("link", { name: /Bashundhara R\/A/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove filter: To Mirpur 10" })).toBeTruthy();
  });

  it("picks an area in the filter panel and keeps it in the URL", async () => {
    const router = renderAt("/rides?vehicle=bike", [
      { filters: { vehicle: "bike" }, page: { items: [], nextCursor: null } },
      { filters: { vehicle: "bike", to: 60 }, page: { items: [], nextCursor: null } },
    ]);
    fireEvent.click(await screen.findByLabelText("To"));
    fireEvent.click(await screen.findByRole("option", { name: "Mirpur" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ vehicle: "bike", to: 60 }));
  });

  it("shows My rides with the expiry words and says what a held or ended ride is", async () => {
    const router = renderAt("/rides", [{ filters: {}, page: { items: [], nextCursor: null } }], {
      items: [
        ride({ id: 3, mine: true, status: "pending_review" }),
        ride({ id: 4, mine: true, state: "expired" }),
      ],
      nextCursor: null,
    });
    fireEvent.click(await screen.findByRole("tab", { name: "My rides" }));
    await waitFor(() => expect(router.state.location.search).toEqual({ tab: "mine" }));
    expect(await screen.findByText("Waiting for a moderator")).toBeTruthy();
    expect(screen.getByText("Ended")).toBeTruthy();
    expect(screen.getByText(/disappears from the feed when it departs/)).toBeTruthy();
    expect(screen.getByText(/gone for everyone right away/)).toBeTruthy();
  });
});
